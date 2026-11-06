//! The LiteLLM router core in the browser. The core is the real `litellm-router-core`; this crate
//! only supplies a host: attempts follow a per-deployment script instead of calling a provider,
//! sleeps advance a virtual clock instead of waiting, and the routing cache is in memory on the
//! same virtual clock, so cooldowns and per-minute usage expire as simulated time passes.

mod sim;

use std::{
    collections::{BTreeMap, HashMap},
    str::FromStr,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
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
use sim::{Delay, Sched, Task};
use wasm_bindgen::prelude::*;

/// 2026-01-01T12:00:00Z: where simulated time starts.
const EPOCH_SECONDS: u64 = 1_767_268_800;

#[derive(Clone, Default)]
pub(crate) struct VirtualClock(Arc<Mutex<Duration>>);

impl VirtualClock {
    pub(crate) fn elapsed(&self) -> Duration {
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
    sched: Arc<Sched>,
    /// The simulated request whose future is being polled, tagged onto every step it logs.
    current: AtomicU64,
    /// During a simulation, steps skip the cache snapshot.
    light: AtomicBool,
    profiles: Mutex<HashMap<String, Profile>>,
    incidents: Mutex<Vec<Incident>>,
    /// Requests each deployment's provider took in the current minute, for `rpm_cap`.
    taken: Mutex<HashMap<String, (u64, u32)>>,
    /// Draws for latency, errors and arrivals, apart from the router's own randomness.
    rng: SeededRandomness,
}

/// How a deployment behaves during a simulation: lognormal latency from its median and p95,
/// a share of attempts that fail with `error`, and the provider's own requests-per-minute cap.
#[derive(Clone)]
struct Profile {
    p50: f64,
    p95: f64,
    error_rate: f64,
    error: FailureKind,
    rpm_cap: Option<u32>,
}

/// A stretch of simulated time in which one deployment behaves worse.
#[derive(Clone)]
struct Incident {
    id: String,
    from: f64,
    to: f64,
    latency_factor: f64,
    error_rate: Option<f64>,
    rpm_cap: Option<u32>,
    outage: bool,
}

impl ScriptedHost {
    /// Every step carries the routing cache as it stands after it, so the diagram can show each
    /// deployment's cooldown, allowed-fails counter and usage at that step.
    fn log(&self, step: Value) {
        let mut step = step;
        step["t"] = json!(self.clock.elapsed().as_secs_f64());
        if self.light.load(Ordering::Relaxed) {
            step["req"] = json!(self.current.load(Ordering::Relaxed));
        } else {
            step["cache"] = Value::Array(self.cache.snapshot());
        }
        self.trace.lock().push(step);
    }

    /// Wait `duration` of simulated time: a timer while a simulation runs, else a clock jump.
    async fn wait(&self, duration: Duration) {
        if self.sched.active.load(Ordering::Relaxed) {
            let at = self.clock.elapsed() + duration;
            Delay {
                sched: self.sched.clone(),
                clock: self.clock.clone(),
                at,
            }
            .await;
        } else {
            self.clock.advance(duration);
        }
    }

    fn uniform(&self) -> f64 {
        self.rng.next_f64()
    }

    fn lognormal(&self, p50: f64, p95: f64) -> f64 {
        let sigma = (p95.max(p50) / p50.max(1e-9)).ln() / 1.645;
        let (u1, u2) = (self.uniform().max(1e-12), self.uniform());
        let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
        p50 * (sigma * z).exp()
    }

    /// One attempt against a deployment with a profile, on simulated time.
    async fn simulated(&self, attempt: &Attempt, profile: Profile) -> Result<Output, AttemptError> {
        let id = attempt.deployment.id.clone();
        let now = self.clock.elapsed().as_secs_f64();
        let mut profile = profile;
        let (mut factor, mut outage) = (1.0, false);
        let incidents = self.incidents.lock().clone();
        for incident in incidents {
            if incident.id == id && now >= incident.from && now < incident.to {
                factor *= incident.latency_factor;
                outage |= incident.outage;
                profile.error_rate = incident.error_rate.unwrap_or(profile.error_rate);
                profile.rpm_cap = incident.rpm_cap.or(profile.rpm_cap);
            }
        }
        let fail = |kind: FailureKind, ms: f64, why: &str| {
            self.log(json!({"kind": "host", "call": "invoke", "deployment": id, "answer": why, "ms": ms}));
            Err(AttemptError::new(kind, default_status(kind)))
        };
        let over_capacity = profile.rpm_cap.is_some_and(|cap| {
            let minute = now as u64 / 60;
            let mut taken = self.taken.lock();
            let entry = taken.entry(id.clone()).or_insert((minute, 0));
            if entry.0 != minute {
                *entry = (minute, 0);
            }
            entry.1 += 1;
            entry.1 > cap
        });
        if over_capacity {
            self.wait(Duration::from_millis(20)).await;
            return fail(FailureKind::RateLimit, 20.0, "429 over provider capacity");
        }
        if outage {
            self.wait(Duration::from_millis(50)).await;
            return fail(FailureKind::ServiceUnavailable, 50.0, "503 outage");
        }
        let latency = self.lognormal(profile.p50, profile.p95) * factor;
        if let Some(timeout) = attempt
            .timeout
            .filter(|t| t.as_secs_f64() * 1000.0 < latency)
        {
            self.wait(timeout).await;
            return fail(
                FailureKind::Timeout,
                timeout.as_secs_f64() * 1000.0,
                "timed out",
            );
        }
        self.wait(Duration::from_secs_f64(latency / 1000.0)).await;
        if self.uniform() < profile.error_rate {
            let class: &'static str = profile.error.into();
            return fail(profile.error, latency, &format!("raises {class}"));
        }
        self.log(json!({"kind": "host", "call": "invoke", "deployment": id, "answer": "200 OK", "ms": latency}));
        Ok(Output {
            value: Payload(Arc::new(id)),
            total_tokens: 10,
            blocked: None,
            deferred: false,
            tracks_usage: None,
        })
    }
}

#[async_trait]
impl Host for ScriptedHost {
    async fn invoke(&self, attempt: &Attempt) -> Result<Output, AttemptError> {
        let id = attempt.deployment.id.clone();
        if self.sched.active.load(Ordering::Relaxed) {
            let profile = self.profiles.lock().get(&id).cloned();
            if let Some(profile) = profile {
                return self.simulated(attempt, profile).await;
            }
        }
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
        self.wait(Duration::from_millis(behaviour.latency_ms)).await;
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
        self.wait(duration).await;
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
            sched: Arc::new(Sched::default()),
            current: AtomicU64::new(0),
            light: AtomicBool::new(false),
            profiles: Mutex::new(HashMap::new()),
            incidents: Mutex::new(Vec::new()),
            taken: Mutex::new(HashMap::new()),
            rng: SeededRandomness::new(seed ^ 0x5eed_5eed),
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

    /// Run steady traffic with many calls in flight on simulated time. `spec` is JSON:
    /// `{"model": "gpt-4o", "rate": 3, "duration": 300, "trace": false,
    ///   "profiles": {"<id>": {"p50_ms": 800, "p95_ms": 2400, "error_rate": 0.04,
    ///                         "error": "InternalServerError", "rpm_cap": 120}},
    ///   "incidents": [{"id": "<id>", "from": 40, "to": 70, "latency_factor": 10}]}`.
    /// Arrivals are Poisson at `rate` per second. Returns every request's start, end and outcome.
    pub fn simulate(&self, spec: &str) -> Result<String, JsError> {
        let spec: Value = serde_json::from_str(spec)?;
        let num = |value: &Value, key: &str| value.get(key).and_then(Value::as_f64);
        let model = spec
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        let rate = num(&spec, "rate").unwrap_or(1.0).max(1e-6);
        let duration = num(&spec, "duration").unwrap_or(60.0);
        let keep_trace = spec.get("trace").and_then(Value::as_bool).unwrap_or(false);
        let mut profiles = HashMap::new();
        if let Some(Value::Object(map)) = spec.get("profiles") {
            for (id, value) in map {
                let p50 = num(value, "p50_ms").unwrap_or(500.0);
                let error = value
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("InternalServerError");
                profiles.insert(
                    id.clone(),
                    Profile {
                        p50,
                        p95: num(value, "p95_ms").unwrap_or(p50 * 2.0),
                        error_rate: num(value, "error_rate").unwrap_or(0.0),
                        error: FailureKind::from_str(error).map_err(|_| {
                            JsError::new(&format!("unknown exception class `{error}`"))
                        })?,
                        rpm_cap: num(value, "rpm_cap").map(|n| n as u32),
                    },
                );
            }
        }
        let incidents = spec
            .get("incidents")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|item| Incident {
                        id: item
                            .get("id")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_owned(),
                        from: num(item, "from").unwrap_or(0.0),
                        to: num(item, "to").unwrap_or(f64::MAX),
                        latency_factor: num(item, "latency_factor").unwrap_or(1.0),
                        error_rate: num(item, "error_rate"),
                        rpm_cap: num(item, "rpm_cap").map(|n| n as u32),
                        outage: item.get("outage").and_then(Value::as_bool).unwrap_or(false),
                    })
                    .collect()
            })
            .unwrap_or_default();
        *self.host.profiles.lock() = profiles;
        *self.host.incidents.lock() = incidents;
        self.host.trace.lock().clear();
        self.host.sched.active.store(true, Ordering::Relaxed);
        self.host.light.store(true, Ordering::Relaxed);

        let clock = self.host.clock.clone();
        let origin = clock.elapsed();
        let end = origin + Duration::from_secs_f64(duration);
        let gap =
            |host: &ScriptedHost| Duration::from_secs_f64(-(1.0 - host.uniform()).ln() / rate);
        let mut next_arrival = Some(origin + gap(&self.host)).filter(|at| *at < end);
        let mut tasks: Vec<Task<'_, Value>> = Vec::new();
        let mut requests = Vec::new();
        let mut started = Vec::new();
        let (mut max_in_flight, mut polls) = (0usize, 0u64);
        loop {
            while let Some(at) = next_arrival.filter(|at| *at <= clock.elapsed()) {
                let id = started.len();
                started.push(at.as_secs_f64());
                let request = parse_request(&json!({"model": model}));
                let router = &self.router;
                tasks.push(Task::new(id, async move {
                    match router.call(Op::from("acompletion"), request).await {
                        Ok(response) => json!({
                            "ok": true,
                            "deployment": response.deployment_id,
                            "model_group": response.model_group,
                            "retries": response.attempted_retries,
                            "fallbacks": response.attempted_fallbacks,
                        }),
                        Err(error) => json!({"ok": false, "error": error.to_string()}),
                    }
                }));
                next_arrival = Some(at + gap(&self.host)).filter(|at| *at < end);
            }
            max_in_flight = max_in_flight.max(tasks.len());
            loop {
                let mut progressed = false;
                let mut index = 0;
                while index < tasks.len() {
                    self.host
                        .current
                        .store(tasks[index].id as u64, Ordering::Relaxed);
                    match tasks[index].poll_if_woken() {
                        None => index += 1,
                        Some(None) => {
                            progressed = true;
                            polls += 1;
                            index += 1;
                        }
                        Some(Some(mut outcome)) => {
                            progressed = true;
                            polls += 1;
                            let task = tasks.swap_remove(index);
                            outcome["id"] = json!(task.id);
                            outcome["start"] = json!(started[task.id]);
                            outcome["end"] = json!(clock.elapsed().as_secs_f64());
                            requests.push(outcome);
                        }
                    }
                }
                if !progressed {
                    break;
                }
            }
            let next = match (self.host.sched.next_due(), next_arrival) {
                (Some(a), Some(b)) => a.min(b),
                (a, b) => match a.or(b) {
                    Some(next) => next,
                    None => break,
                },
            };
            let now = clock.elapsed();
            if next > now {
                clock.advance(next - now);
            }
            self.host.sched.fire(clock.elapsed());
        }
        self.host.sched.active.store(false, Ordering::Relaxed);
        self.host.light.store(false, Ordering::Relaxed);
        let stuck = tasks.len();
        requests.sort_by_key(|request| request["id"].as_u64());
        let trace = std::mem::take(&mut *self.host.trace.lock());
        Ok(json!({
            "requests": requests,
            "stuck": stuck,
            "max_in_flight": max_in_flight,
            "polls": polls,
            "steps": trace.len(),
            "trace": if keep_trace { Value::Array(trace) } else { Value::Null },
            "end": clock.elapsed().as_secs_f64(),
        })
        .to_string())
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
