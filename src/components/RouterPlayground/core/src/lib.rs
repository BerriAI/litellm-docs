//! The LiteLLM router core in the browser. The core is the real `litellm-router-core`; this crate
//! only supplies a host: attempts follow a per-deployment script instead of calling a provider,
//! sleeps advance a virtual clock instead of waiting, and the routing cache is in memory on the
//! same virtual clock, so cooldowns and per-minute usage expire as simulated time passes.

use std::{
    collections::{BTreeMap, HashMap},
    str::FromStr,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use litellm_router_core::{
    health::{cooldown_key, Clock},
    Attempt, AttemptError, Deployment, Error, FailureKind, Host, Op, Output, Payload, Randomness,
    Router, RouterCache, RouterConfig, RouterDynamicConfig, RouterEvent, RouterRequest,
    RoutingContext, RoutingStrategy, SeededRandomness, SelectStage,
};
use parking_lot::Mutex;
use serde_json::{json, Map, Value};
use wasm_bindgen::prelude::*;

/// 2026-01-01T12:00:00Z: where simulated time starts.
const EPOCH_SECONDS: u64 = 1_767_268_800;

#[derive(Clone, Default)]
struct VirtualClock(Arc<Mutex<Duration>>);

impl VirtualClock {
    fn elapsed(&self) -> Duration {
        *self.0.lock()
    }
    fn advance(&self, by: Duration) {
        *self.0.lock() += by;
    }
}

impl Clock for VirtualClock {
    fn now(&self) -> SystemTime {
        UNIX_EPOCH + Duration::from_secs(EPOCH_SECONDS) + self.elapsed()
    }
}

struct Entry {
    value: Value,
    expires: Option<Duration>,
}

/// The routing cache on the virtual clock.
#[derive(Clone)]
struct VirtualCache {
    clock: VirtualClock,
    entries: Arc<Mutex<BTreeMap<String, Entry>>>,
}

impl VirtualCache {
    fn live(&self, key: &str) -> Option<Value> {
        let now = self.clock.elapsed();
        let mut entries = self.entries.lock();
        if entries
            .get(key)
            .is_some_and(|entry| entry.expires.is_some_and(|at| at <= now))
        {
            entries.remove(key);
        }
        entries.get(key).map(|entry| entry.value.clone())
    }

    fn snapshot(&self) -> Vec<Value> {
        let now = self.clock.elapsed();
        let mut entries = self.entries.lock();
        entries.retain(|_, entry| entry.expires.is_none_or(|at| at > now));
        entries
            .iter()
            .map(|(key, entry)| {
                json!({
                    "key": key,
                    "value": entry.value,
                    "ttl": entry.expires.map(|at| (at - now).as_secs_f64()),
                })
            })
            .collect()
    }
}

type CacheResult<T> = Result<T, litellm_cache::Error>;

#[async_trait]
impl RouterCache for VirtualCache {
    async fn async_get_cache(&self, key: &str) -> CacheResult<Option<Value>> {
        Ok(self.live(key))
    }

    async fn async_set_cache(
        &self,
        key: &str,
        value: Value,
        ttl: Option<Duration>,
    ) -> CacheResult<()> {
        let expires = ttl.map(|ttl| self.clock.elapsed() + ttl);
        self.entries
            .lock()
            .insert(key.to_owned(), Entry { value, expires });
        Ok(())
    }

    async fn async_increment(
        &self,
        key: &str,
        amount: f64,
        ttl: Option<Duration>,
    ) -> CacheResult<f64> {
        let current = self.live(key).and_then(|value| value.as_f64());
        let next = current.unwrap_or(0.0) + amount;
        let now = self.clock.elapsed();
        let mut entries = self.entries.lock();
        let expires = match (current, entries.get(key)) {
            (Some(_), Some(entry)) => entry.expires,
            _ => ttl.map(|ttl| now + ttl),
        };
        let value = if next.fract() == 0.0 {
            json!(next as i64)
        } else {
            json!(next)
        };
        entries.insert(key.to_owned(), Entry { value, expires });
        Ok(next)
    }

    async fn async_batch_get_cache(&self, keys: &[String]) -> CacheResult<Vec<Option<Value>>> {
        Ok(keys.iter().map(|key| self.live(key)).collect())
    }

    async fn async_delete_cache(&self, key: &str) -> CacheResult<()> {
        self.entries.lock().remove(key);
        Ok(())
    }
}

/// How one deployment answers: `fail` with an exception class for the next `times` attempts
/// (every attempt when `times` is absent), then succeed.
#[derive(Clone, Default)]
struct Behaviour {
    fail: Option<(FailureKind, Option<u16>)>,
    times: Option<u32>,
    latency_ms: u64,
    tokens: u64,
}

struct ScriptedHost {
    clock: VirtualClock,
    cache: VirtualCache,
    behaviour: Mutex<HashMap<String, Behaviour>>,
    trace: Mutex<Vec<Value>>,
}

impl ScriptedHost {
    /// Every step carries the routing cache as it stands after it, so the diagram can show each
    /// deployment's cooldown, allowed-fails counter and usage at that step.
    fn log(&self, step: Value) {
        let mut step = step;
        step["t"] = json!(self.clock.elapsed().as_secs_f64());
        step["cache"] = Value::Array(self.cache.snapshot());
        self.trace.lock().push(step);
    }
}

#[async_trait]
impl Host for ScriptedHost {
    async fn invoke(&self, attempt: &Attempt) -> Result<Output, AttemptError> {
        let id = attempt.deployment.id.clone();
        let behaviour = {
            let mut all = self.behaviour.lock();
            let entry = all
                .entry(id.clone())
                .or_insert_with(|| from_mock_response(&attempt.deployment));
            let now = entry.clone();
            if entry.fail.is_some() {
                if let Some(times) = entry.times.as_mut() {
                    *times = times.saturating_sub(1);
                    if *times == 0 {
                        entry.fail = None;
                        entry.times = None;
                    }
                }
            }
            now
        };
        self.clock
            .advance(Duration::from_millis(behaviour.latency_ms));
        match behaviour.fail {
            Some((kind, status)) => {
                let class: &'static str = kind.into();
                self.log(json!({"kind": "host", "call": "invoke", "deployment": id, "answer": format!("raises {class}"), "status": status}));
                Err(AttemptError::new(kind, status))
            }
            None => {
                self.log(
                    json!({"kind": "host", "call": "invoke", "deployment": id, "answer": "200 OK"}),
                );
                Ok(Output {
                    value: Payload(Arc::new(id)),
                    total_tokens: behaviour.tokens,
                    blocked: None,
                    deferred: false,
                    tracks_usage: None,
                })
            }
        }
    }

    async fn select(
        &self,
        stage: &SelectStage,
        _ctx: &RoutingContext<'_>,
        candidates: Vec<Arc<Deployment>>,
    ) -> Result<Vec<Arc<Deployment>>, Error> {
        self.log(json!({"kind": "host", "call": "select", "stage": format!("{stage:?}"), "answer": "unchanged (Python-only stage, not simulated)"}));
        Ok(candidates)
    }

    async fn allow_fallback(
        &self,
        _request: &RouterRequest,
        target: &str,
    ) -> Result<bool, AttemptError> {
        self.log(
            json!({"kind": "host", "call": "allow_fallback", "target": target, "answer": true}),
        );
        Ok(true)
    }

    async fn sleep(&self, duration: Duration) {
        self.log(json!({"kind": "host", "call": "sleep", "seconds": duration.as_secs_f64()}));
        self.clock.advance(duration);
    }

    fn observe(&self, event: &RouterEvent) {
        let text = format!("{event:?}");
        let name = text
            .split([' ', '{', '('])
            .next()
            .unwrap_or_default()
            .to_owned();
        self.log(json!({"kind": "event", "event": name, "detail": text}));
    }

    fn cache(&self) -> Arc<dyn RouterCache> {
        Arc::new(self.cache.clone())
    }
}

/// The seeded randomness the core draws from, with every draw logged, so the diagram can show
/// where simple-shuffle's roll landed.
struct RecordingRandomness {
    inner: SeededRandomness,
    host: Arc<ScriptedHost>,
}

impl Randomness for RecordingRandomness {
    fn next_f64(&self) -> f64 {
        let value = self.inner.next_f64();
        self.host.log(json!({"kind": "random", "value": value}));
        value
    }
}

/// The status code litellm gives each exception class.
fn default_status(kind: FailureKind) -> Option<u16> {
    Some(match kind {
        FailureKind::RateLimit => 429,
        FailureKind::Authentication => 401,
        FailureKind::PermissionDenied => 403,
        FailureKind::NotFound => 404,
        FailureKind::Timeout => 408,
        FailureKind::InternalServer | FailureKind::ApiConnection => 500,
        FailureKind::BadGateway => 502,
        FailureKind::ServiceUnavailable => 503,
        FailureKind::ContextWindowExceeded
        | FailureKind::ContentPolicyViolation
        | FailureKind::BadRequest => 400,
        _ => return None,
    })
}

/// A deployment whose `mock_response` names an exception (`"litellm.RateLimitError"`) raises it on
/// every attempt, as `litellm.acompletion` does; any other deployment succeeds.
fn from_mock_response(deployment: &Deployment) -> Behaviour {
    let class = deployment
        .raw_params
        .get("mock_response")
        .and_then(Value::as_str)
        .and_then(|text| text.strip_prefix("litellm."));
    let kind = class.and_then(|class| FailureKind::from_str(class).ok());
    Behaviour {
        fail: kind.map(|kind| (kind, default_status(kind))),
        tokens: 10,
        ..Behaviour::default()
    }
}

fn parse_behaviour(value: &Value) -> Result<Behaviour, String> {
    let fail = match value.get("fail").and_then(Value::as_str) {
        None | Some("") | Some("none") => None,
        Some(class) => {
            let kind = FailureKind::from_str(class)
                .map_err(|_| format!("unknown exception class `{class}`"))?;
            let status = value
                .get("status")
                .and_then(Value::as_u64)
                .map(|s| s as u16)
                .or_else(|| default_status(kind));
            Some((kind, status))
        }
    };
    Ok(Behaviour {
        fail,
        times: value.get("times").and_then(Value::as_u64).map(|t| t as u32),
        latency_ms: value.get("latency_ms").and_then(Value::as_u64).unwrap_or(0),
        tokens: value.get("tokens").and_then(Value::as_u64).unwrap_or(10),
    })
}

fn text_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

fn parse_request(value: &Value) -> RouterRequest {
    let text = |key: &str| value.get(key).and_then(Value::as_str).map(str::to_owned);
    RouterRequest {
        model: text("model").unwrap_or_default(),
        body: value.clone(),
        team_id: text("team_id"),
        listing_team_id: text("team_id"),
        proxy_admin: value
            .get("proxy_admin")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        allowed_models: text_list(value.get("allowed_models")),
        num_retries: value
            .get("num_retries")
            .and_then(Value::as_u64)
            .map(|n| n as u32),
        disable_fallbacks: value
            .get("disable_fallbacks")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        specific_deployment: value
            .get("specific_deployment")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        ..RouterRequest::default()
    }
}

/// A router built from one config, with its own clock, cache and scripted host.
#[wasm_bindgen]
pub struct Playground {
    router: Router,
    host: Arc<ScriptedHost>,
    seed: u64,
    /// The router settings as given, for the fallback maps the diagram draws.
    settings: Value,
}

#[wasm_bindgen]
impl Playground {
    /// `config` is JSON: `{"model_list": [...], "router_settings": {...}}`, as in a proxy
    /// config.yaml. Router settings may also sit at the top level, as `Router(**kwargs)` takes them.
    #[wasm_bindgen(constructor)]
    pub fn new(config: &str, seed: u64) -> Result<Playground, JsError> {
        let parsed: Value = serde_json::from_str(config)?;
        let mut merged = Map::new();
        if let Value::Object(top) = &parsed {
            for (key, value) in top {
                if key != "router_settings"
                    && key != "litellm_settings"
                    && key != "general_settings"
                {
                    merged.insert(key.clone(), value.clone());
                }
            }
            for section in ["litellm_settings", "router_settings"] {
                if let Some(Value::Object(settings)) = top.get(section) {
                    merged.extend(settings.clone());
                }
            }
        }
        let merged = Value::Object(merged);
        let settings = merged.clone();
        let config: RouterConfig = serde_json::from_value(merged.clone())
            .map_err(|e| JsError::new(&format!("router config: {e}")))?;
        let dynamic: RouterDynamicConfig = serde_json::from_value(merged)
            .map_err(|e| JsError::new(&format!("router settings: {e}")))?;
        if config.routing_strategy != RoutingStrategy::SimpleShuffle {
            return Err(JsError::new(&format!(
                "routing_strategy `{}` still runs in Python, so the playground does not offer it yet. \
                 Use simple-shuffle (the default).",
                config.routing_strategy
            )));
        }
        let clock = VirtualClock::default();
        let host = Arc::new(ScriptedHost {
            cache: VirtualCache {
                clock: clock.clone(),
                entries: Default::default(),
            },
            clock: clock.clone(),
            behaviour: Mutex::new(HashMap::new()),
            trace: Mutex::new(Vec::new()),
        });
        let router = Router::builder(config, dynamic, host.clone())
            .randomness(Arc::new(RecordingRandomness {
                inner: SeededRandomness::new(seed),
                host: host.clone(),
            }))
            .clock(Arc::new(clock))
            .build()
            .map_err(|e| JsError::new(&format!("{e}")))?;
        Ok(Playground {
            router,
            host,
            seed,
            settings,
        })
    }

    /// Replace every deployment's behaviour: `{"<deployment id>": {"fail": "RateLimitError",
    /// "status": 429, "times": 2, "latency_ms": 300, "tokens": 50}}`. Ids left out follow their
    /// `mock_response`.
    #[wasm_bindgen(js_name = setBehaviour)]
    pub fn set_behaviour(&self, behaviour: &str) -> Result<(), JsError> {
        let parsed: Value = serde_json::from_str(behaviour)?;
        let mut all = HashMap::new();
        if let Value::Object(map) = parsed {
            for (id, value) in map {
                all.insert(id, parse_behaviour(&value).map_err(|e| JsError::new(&e))?);
            }
        }
        *self.host.behaviour.lock() = all;
        Ok(())
    }

    /// Send one `acompletion` through the router and return `{result, trace}` as JSON.
    pub fn send(&self, request: &str) -> Result<String, JsError> {
        let request = parse_request(&serde_json::from_str(request)?);
        self.host.trace.lock().clear();
        let started = self.host.clock.elapsed();
        let outcome = pollster::block_on(self.router.call(Op::from("acompletion"), request));
        let result = match outcome {
            Ok(response) => json!({
                "ok": true,
                "deployment": response.deployment_id,
                "model_group": response.model_group,
                "retries": response.attempted_retries,
                "fallbacks": response.attempted_fallbacks,
            }),
            Err(error) => {
                json!({"ok": false, "error": error.to_string(), "detail": format!("{error:?}")})
            }
        };
        let took = (self.host.clock.elapsed() - started).as_secs_f64();
        let trace = std::mem::take(&mut *self.host.trace.lock());
        Ok(json!({"result": result, "trace": trace, "took": took}).to_string())
    }

    /// Move the virtual clock forward.
    pub fn advance(&self, seconds: f64) {
        self.host
            .clock
            .advance(Duration::from_secs_f64(seconds.max(0.0)));
    }

    /// Seconds of simulated time since the router was built.
    pub fn now(&self) -> f64 {
        self.host.clock.elapsed().as_secs_f64()
    }

    /// The router's effective settings and every deployment's routing parameters, as JSON: what
    /// the diagram's globals band and deployment objects show.
    pub fn describe(&self) -> Result<String, JsError> {
        let settings = self.router.settings();
        let given = |key: &str| self.settings.get(key).cloned().unwrap_or(Value::Null);
        let registry = self.router.registry();
        let deployments: Vec<Value> = registry
            .deployments_from(0)
            .iter()
            .map(|deployment| {
                json!({
                    "id": deployment.id,
                    "model_name": deployment.model_name,
                    "model": deployment.params.model,
                    "weight": deployment.raw_params.get("weight").and_then(Value::as_f64),
                    "rpm": deployment.metric("rpm"),
                    "tpm": deployment.metric("tpm"),
                    "order": deployment.order(),
                    "tags": deployment.raw_params.get("tags"),
                })
            })
            .collect();
        Ok(json!({
            "seed": self.seed,
            "settings": {
                "routing_strategy": settings.routing_strategy.to_string(),
                "num_retries": settings.num_retries,
                "allowed_fails": settings.allowed_fails_set().then(|| settings.effective_allowed_fails()),
                "cooldown_time": settings.cooldown_time.as_secs_f64(),
                "disable_cooldowns": settings.disable_cooldowns,
                "max_fallbacks": settings.max_fallbacks,
                "retry_after": settings.retry_after.as_secs_f64(),
                "retry_policy": settings.retry_policy.is_some(),
                "fallbacks": given("fallbacks"),
                "context_window_fallbacks": given("context_window_fallbacks"),
                "content_policy_fallbacks": given("content_policy_fallbacks"),
                "default_fallbacks": given("default_fallbacks"),
            },
            "deployments": deployments,
        })
        .to_string())
    }

    /// Every deployment with its cooldown, this minute's usage and the raw routing cache.
    pub fn state(&self) -> Result<String, JsError> {
        let registry = self.router.registry();
        let health = self.router.health();
        let mut deployments = Vec::new();
        for deployment in registry.deployments_from(0) {
            let (tpm, rpm) = pollster::block_on(health.usage(deployment)).unwrap_or_default();
            let cooldown = self.host.cache.live(&cooldown_key(&deployment.id));
            let ttl = self
                .host
                .cache
                .snapshot()
                .into_iter()
                .find(|entry| entry["key"] == cooldown_key(&deployment.id))
                .and_then(|entry| entry["ttl"].as_f64());
            deployments.push(json!({
                "id": deployment.id,
                "model_name": deployment.model_name,
                "model": deployment.params.model,
                "rpm": rpm,
                "tpm": tpm,
                "cooldown": cooldown.map(|value| json!({"value": value, "remaining": ttl})),
            }));
        }
        Ok(json!({"now": self.now(), "deployments": deployments, "cache": self.host.cache.snapshot()}).to_string())
    }
}
