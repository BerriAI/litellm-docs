//! The LiteLLM router core in the browser. The core is the real `litellm-router-core`; this crate
//! only supplies a host: attempts follow a per-deployment script instead of calling a provider,
//! sleeps advance a virtual clock instead of waiting, and the routing cache is in memory on the
//! same virtual clock, so cooldowns and per-minute usage expire as simulated time passes.

mod sim;

use std::{
    cell::RefCell,
    collections::{BTreeMap, HashMap, VecDeque},
    str::FromStr,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use async_trait::async_trait;
use litellm_router_core::{
    health::{cooldown_key, Clock},
    mock::MockFailure,
    Attempt, AttemptError, Deployment, Error, FailureKind, Host, Op, Output, Payload, Randomness,
    Router, RouterCache, RouterConfig, RouterDynamicConfig, RouterEvent, RouterRequest,
    RouterResponse, RoutingContext, RoutingStrategy, SeededRandomness, SelectStage,
};
use parking_lot::Mutex;
use serde_json::{json, Map, Value};
use sim::{mark_incidents, Delay, Kept, Kind, Run, Sched};
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

/// The routing cache on the virtual clock. `version` moves on every write, so a simulation can
/// share one snapshot between the steps logged while the cache stood still.
#[derive(Clone)]
struct VirtualCache {
    clock: VirtualClock,
    entries: Arc<Mutex<BTreeMap<Arc<str>, Entry>>>,
    version: Arc<AtomicU64>,
}

/// The cache's entries as they stood at one write: key, value and absolute expiry.
type Snap = Vec<(Arc<str>, Value, Option<Duration>)>;

/// A snapshot as the diagram reads it at simulated time `now`: live entries with their ttl.
fn render_snap(snap: &Snap, now: Duration) -> Value {
    snap.iter()
        .filter(|(_, _, expires)| expires.is_none_or(|at| at > now))
        .map(|(key, value, expires)| {
            json!({
                "key": &**key,
                "value": value,
                "ttl": expires.map(|at| (at - now).as_secs_f64()),
            })
        })
        .collect()
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

    /// Seconds until `key` expires, if it is live and has a ttl.
    fn ttl(&self, key: &str) -> Option<f64> {
        let now = self.clock.elapsed();
        let expires = self.entries.lock().get(key)?.expires?;
        (expires > now).then(|| (expires - now).as_secs_f64())
    }

    fn snapshot(&self) -> Vec<Value> {
        let now = self.clock.elapsed();
        let mut entries = self.entries.lock();
        entries.retain(|_, entry| entry.expires.is_none_or(|at| at > now));
        entries
            .iter()
            .map(|(key, entry)| {
                json!({
                    "key": &**key,
                    "value": entry.value,
                    "ttl": entry.expires.map(|at| (at - now).as_secs_f64()),
                })
            })
            .collect()
    }

    fn raw(&self) -> Snap {
        self.entries
            .lock()
            .iter()
            .map(|(key, entry)| (key.clone(), entry.value.clone(), entry.expires))
            .collect()
    }

    fn touch(&self) {
        self.version.fetch_add(1, Ordering::Relaxed);
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
            .insert(key.into(), Entry { value, expires });
        self.touch();
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
        entries.insert(key.into(), Entry { value, expires });
        self.touch();
        Ok(next)
    }

    async fn async_batch_get_cache(&self, keys: &[String]) -> CacheResult<Vec<Option<Value>>> {
        Ok(keys.iter().map(|key| self.live(key)).collect())
    }

    async fn async_delete_cache(&self, key: &str) -> CacheResult<()> {
        self.entries.lock().remove(key);
        self.touch();
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
    profiles: Mutex<HashMap<String, Profile>>,
    incidents: Mutex<Vec<Incident>>,
    /// Requests and tokens each deployment's provider took in the current minute, for its caps.
    taken: Mutex<HashMap<String, (u64, u32, u64)>>,
    /// What a simulation records besides the outcomes: steps, attempts, marks.
    sim: Mutex<SimLog>,
    /// Draws for latency, errors and arrivals, apart from the router's own randomness.
    rng: SeededRandomness,
    /// Tokens the single call in progress costs, when its request names them.
    single_tokens: Mutex<Option<u64>>,
}

/// How a deployment behaves during a simulation: lognormal latency from its median and p95,
/// a share of attempts that fail with a class drawn from `errors` by weight, and the provider's
/// own requests- and tokens-per-minute caps. Every request costs `tokens`.
#[derive(Clone)]
struct Profile {
    p50: f64,
    p95: f64,
    error_rate: f64,
    errors: Vec<(FailureKind, f64)>,
    rpm_cap: Option<u32>,
    tpm_cap: Option<u64>,
    tokens: u64,
}

/// A stretch of simulated time in which one deployment behaves worse.
#[derive(Clone)]
struct Incident {
    key: String,
    id: String,
    from: f64,
    to: f64,
    latency_factor: f64,
    error_rate: Option<f64>,
    rpm_cap: Option<u32>,
    tpm_cap: Option<u64>,
    outage: bool,
    /// Whether its start and end marks went out.
    marked: (bool, bool),
}

/// Which steps a simulation keeps: none, every step flat and tagged with its request (for
/// `simulate`'s `trace`), or each request's own steps with the cache as it stood (for `simTrace`).
#[derive(Clone, Copy, Default, PartialEq)]
enum Capture {
    #[default]
    Off,
    Flat,
    Steps,
}

#[derive(Default)]
struct SimLog {
    capture: Capture,
    steps: u64,
    requests: HashMap<u64, RequestLog>,
    marks: Vec<Value>,
    in_flight: HashMap<String, u32>,
    snap: Option<(u64, Arc<Snap>)>,
    /// Tokens a request costs when its kind says, in place of its deployment's profile.
    tokens: HashMap<u64, u64>,
}

#[derive(Default)]
struct RequestLog {
    steps: Vec<(Value, Duration, Arc<Snap>)>,
    attempts: Vec<Value>,
    retries: u32,
    fallbacks: u32,
}

impl ScriptedHost {
    fn simulating(&self) -> bool {
        self.sched.active.load(Ordering::Relaxed)
    }

    /// Every step carries the routing cache as it stands after it, so the diagram can show each
    /// deployment's cooldown, allowed-fails counter and usage at that step.
    fn log(&self, step: Value) {
        let mut step = step;
        let now = self.clock.elapsed();
        if !self.simulating() {
            step["t"] = json!(now.as_secs_f64());
            step["cache"] = Value::Array(self.cache.snapshot());
            self.trace.lock().push(step);
            return;
        }
        let req = self.current.load(Ordering::Relaxed);
        let mut sim = self.sim.lock();
        sim.steps += 1;
        match sim.capture {
            Capture::Off => {}
            Capture::Flat => {
                step["t"] = json!(now.as_secs_f64());
                step["req"] = json!(req);
                self.trace.lock().push(step);
            }
            Capture::Steps => {
                step["t"] = json!(now.as_secs_f64());
                let version = self.cache.version.load(Ordering::Relaxed);
                let snap = match &sim.snap {
                    Some((at, snap)) if *at == version => snap.clone(),
                    _ => {
                        let snap = Arc::new(self.cache.raw());
                        sim.snap = Some((version, snap.clone()));
                        snap
                    }
                };
                sim.requests
                    .entry(req)
                    .or_default()
                    .steps
                    .push((step, now, snap));
            }
        }
    }

    /// Wait `duration` of simulated time: a timer while a simulation runs, else a clock jump.
    async fn wait(&self, duration: Duration) {
        if self.simulating() {
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

    /// One attempt against a deployment with a profile, on simulated time. Also returns how the
    /// provider answered, for the request's attempt list.
    async fn simulated(
        &self,
        attempt: &Attempt,
        profile: Profile,
    ) -> (Result<Output, AttemptError>, String) {
        let id = attempt.deployment.id.clone();
        let now = self.clock.elapsed().as_secs_f64();
        let mut profile = profile;
        let req = self.current.load(Ordering::Relaxed);
        if let Some(tokens) = self.sim.lock().tokens.get(&req) {
            profile.tokens = *tokens;
        }
        let (mut factor, mut outage) = (1.0, false);
        for incident in self.incidents.lock().iter() {
            if incident.id == id && now >= incident.from && now < incident.to {
                factor *= incident.latency_factor;
                outage |= incident.outage;
                profile.error_rate = incident.error_rate.unwrap_or(profile.error_rate);
                profile.rpm_cap = incident.rpm_cap.or(profile.rpm_cap);
                profile.tpm_cap = incident.tpm_cap.or(profile.tpm_cap);
            }
        }
        let fail = |kind: FailureKind, ms: f64, why: String| {
            self.log(json!({"kind": "host", "call": "invoke", "deployment": id, "answer": why, "ms": ms}));
            (Err(AttemptError::new(kind, default_status(kind))), why)
        };
        let (over_rpm, over_tpm) = self.take(&id, profile.tokens, profile.rpm_cap, profile.tpm_cap);
        if over_rpm || over_tpm {
            self.wait(Duration::from_millis(20)).await;
            let why = if over_rpm { "rpm" } else { "tpm" };
            return fail(
                FailureKind::RateLimit,
                20.0,
                format!("429 over provider {why} capacity"),
            );
        }
        if outage {
            self.wait(Duration::from_millis(50)).await;
            return fail(FailureKind::ServiceUnavailable, 50.0, "503 outage".into());
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
                "timed out".into(),
            );
        }
        self.wait(Duration::from_secs_f64(latency / 1000.0)).await;
        if self.uniform() < profile.error_rate {
            let total: f64 = profile.errors.iter().map(|(_, weight)| weight).sum();
            let mut roll = self.uniform() * total;
            let mut kind = profile.errors[0].0;
            for (class, weight) in &profile.errors {
                kind = *class;
                if roll < *weight {
                    break;
                }
                roll -= weight;
            }
            let class: &'static str = kind.into();
            return fail(kind, latency, format!("raises {class}"));
        }
        self.log(json!({"kind": "host", "call": "invoke", "deployment": id, "answer": "200 OK", "ms": latency}));
        let output = Output {
            value: Payload(Arc::new(id)),
            total_tokens: profile.tokens,
            blocked: None,
            deferred: false,
            tracks_usage: None,
        };
        (Ok(output), "200 OK".into())
    }

    /// Count a request against the provider's minute and say whether it is over either cap. A
    /// request over a cap still counts towards rpm, but its tokens do not.
    fn take(
        &self,
        id: &str,
        tokens: u64,
        rpm_cap: Option<u32>,
        tpm_cap: Option<u64>,
    ) -> (bool, bool) {
        let minute = self.clock.elapsed().as_secs() / 60;
        let mut taken = self.taken.lock();
        let entry = taken.entry(id.to_owned()).or_insert((minute, 0, 0));
        if entry.0 != minute {
            *entry = (minute, 0, 0);
        }
        entry.1 += 1;
        let over_rpm = rpm_cap.is_some_and(|cap| entry.1 > cap);
        let over_tpm = !over_rpm && tpm_cap.is_some_and(|cap| entry.2 + tokens > cap);
        if !over_rpm && !over_tpm {
            entry.2 += tokens;
        }
        (over_rpm, over_tpm)
    }

    /// This minute's requests and tokens the provider took for a deployment.
    fn taken_now(&self, id: &str) -> (u32, u64) {
        let minute = self.clock.elapsed().as_secs() / 60;
        match self.taken.lock().get(id) {
            Some((at, requests, tokens)) if *at == minute => (*requests, *tokens),
            _ => (0, 0),
        }
    }

    /// One attempt that follows the deployment's script or `mock_response`.
    async fn scripted(&self, attempt: &Attempt) -> (Result<Output, AttemptError>, String) {
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
        let mut behaviour = behaviour;
        if let Some(tokens) = *self.single_tokens.lock() {
            behaviour.tokens = tokens;
        }
        if self.simulating() {
            self.take(&id, behaviour.tokens, None, None);
        }
        self.wait(Duration::from_millis(behaviour.latency_ms)).await;
        match behaviour.fail {
            Some((kind, status)) => {
                let class: &'static str = kind.into();
                let answer = format!("raises {class}");
                self.log(json!({"kind": "host", "call": "invoke", "deployment": id, "answer": answer, "status": status}));
                (Err(AttemptError::new(kind, status)), answer)
            }
            None => {
                self.log(
                    json!({"kind": "host", "call": "invoke", "deployment": id, "answer": "200 OK"}),
                );
                let output = Output {
                    value: Payload(Arc::new(id)),
                    total_tokens: behaviour.tokens,
                    blocked: None,
                    deferred: false,
                    tracks_usage: None,
                };
                (Ok(output), "200 OK".into())
            }
        }
    }
}

#[async_trait]
impl Host for ScriptedHost {
    async fn invoke(&self, attempt: &Attempt) -> Result<Output, AttemptError> {
        if !self.simulating() {
            return self.scripted(attempt).await.0;
        }
        let id = attempt.deployment.id.clone();
        let req = self.current.load(Ordering::Relaxed);
        let start = self.clock.elapsed().as_secs_f64();
        *self.sim.lock().in_flight.entry(id.clone()).or_default() += 1;
        let profile = self.profiles.lock().get(&id).cloned();
        let (outcome, answer) = match profile {
            Some(profile) => self.simulated(attempt, profile).await,
            None => self.scripted(attempt).await,
        };
        let status = match &outcome {
            Ok(_) => Some(200),
            Err(error) => error.status,
        };
        let mut sim = self.sim.lock();
        if let Some(count) = sim.in_flight.get_mut(&id) {
            *count = count.saturating_sub(1);
        }
        sim.requests.entry(req).or_default().attempts.push(json!({
            "deployment": id,
            "start": start,
            "end": self.clock.elapsed().as_secs_f64(),
            "answer": answer,
            "status": status,
        }));
        outcome
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
        if !self.simulating() {
            return;
        }
        let req = self.current.load(Ordering::Relaxed);
        let t = self.clock.elapsed().as_secs_f64();
        let mut sim = self.sim.lock();
        match event {
            RouterEvent::CooldownSet {
                deployment_id,
                cooldown,
            } => sim.marks.push(json!({"t": t, "kind": "cooldown", "deployment": deployment_id, "request": req, "seconds": cooldown.as_secs_f64()})),
            RouterEvent::Retry { .. } => sim.requests.entry(req).or_default().retries += 1,
            RouterEvent::Fallback { from, to, .. } => {
                let log = sim.requests.entry(req).or_default();
                log.fallbacks += 1;
                if log.fallbacks == 1 {
                    sim.marks.push(json!({"t": t, "kind": "fallback", "request": req, "from": from, "to": to}));
                }
            }
            _ => {}
        }
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
    let team_id = text("team_id").or_else(|| {
        value
            .pointer("/metadata/user_api_key_team_id")
            .and_then(Value::as_str)
            .map(str::to_owned)
    });
    let flag = |key: &str| value.get(key).and_then(Value::as_bool).unwrap_or(false);
    let mock_failure = [
        ("mock_testing_fallbacks", MockFailure::Fallbacks),
        ("mock_testing_context_fallbacks", MockFailure::ContextWindow),
        (
            "mock_testing_content_policy_fallbacks",
            MockFailure::ContentPolicy,
        ),
        ("mock_testing_rate_limit_error", MockFailure::RateLimit),
    ]
    .into_iter()
    .find(|(key, _)| flag(key))
    .map(|(_, mock)| mock);
    RouterRequest {
        model: text("model").unwrap_or_default(),
        body: value.clone(),
        team_id: team_id.clone(),
        listing_team_id: team_id,
        mock_failure,
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

/// `send`'s result for one call.
fn outcome(outcome: Result<RouterResponse, Error>) -> Value {
    match outcome {
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
    }
}

fn num(value: &Value, key: &str) -> Option<f64> {
    value.get(key).and_then(Value::as_f64)
}

fn failure_kind(class: &str) -> Result<FailureKind, String> {
    FailureKind::from_str(class).map_err(|_| format!("unknown exception class `{class}`"))
}

/// `{"p50_ms", "p95_ms", "error_rate", "errors": {"<class>": weight}, "rpm_cap", "tpm_cap",
/// "tokens"}`. `error` names a single class when `errors` is absent.
fn parse_profile(value: &Value, tokens: u64) -> Result<Profile, String> {
    let p50 = num(value, "p50_ms").unwrap_or(500.0);
    let mut errors = Vec::new();
    if let Some(Value::Object(weights)) = value.get("errors") {
        for (class, weight) in weights {
            let weight = weight.as_f64().unwrap_or(0.0);
            if weight > 0.0 {
                errors.push((failure_kind(class)?, weight));
            }
        }
    }
    if errors.is_empty() {
        let class = value
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("InternalServerError");
        errors.push((failure_kind(class)?, 1.0));
    }
    Ok(Profile {
        p50,
        p95: num(value, "p95_ms").unwrap_or(p50 * 2.0),
        error_rate: num(value, "error_rate").unwrap_or(0.0),
        errors,
        rpm_cap: num(value, "rpm_cap").map(|n| n as u32),
        tpm_cap: num(value, "tpm_cap").map(|n| n as u64),
        tokens: num(value, "tokens").map_or(tokens, |n| n as u64),
    })
}

fn parse_profiles(
    value: Option<&Value>,
    tokens: u64,
) -> Result<Vec<(String, Option<Profile>)>, String> {
    let mut profiles = Vec::new();
    if let Some(Value::Object(map)) = value {
        for (id, value) in map {
            let profile = (!value.is_null())
                .then(|| parse_profile(value, tokens))
                .transpose()?;
            profiles.push((id.clone(), profile));
        }
    }
    Ok(profiles)
}

/// An incident starts at `now` unless it says when.
fn parse_incident(item: &Value, now: f64) -> Incident {
    let id = item
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let from = num(item, "from").unwrap_or(now);
    Incident {
        key: item
            .get("key")
            .and_then(Value::as_str)
            .map_or_else(|| format!("{id}@{from}"), str::to_owned),
        id,
        from,
        to: num(item, "to").unwrap_or(f64::MAX),
        latency_factor: num(item, "latency_factor").unwrap_or(1.0),
        error_rate: num(item, "error_rate"),
        rpm_cap: num(item, "rpm_cap").map(|n| n as u32),
        tpm_cap: num(item, "tpm_cap").map(|n| n as u64),
        outage: item.get("outage").and_then(Value::as_bool).unwrap_or(false),
        marked: (false, false),
    }
}

fn parse_incidents(value: Option<&Value>, now: f64) -> Vec<Incident> {
    value
        .and_then(Value::as_array)
        .map(|items| items.iter().map(|item| parse_incident(item, now)).collect())
        .unwrap_or_default()
}

/// What `simulate` and `simStart` share: `{"model", "rate", "duration"?, "tokens"?, "requests"?, "profiles",
/// "incidents", "trace_last"?, "trace"?}`.
struct Spec {
    model: String,
    rate: f64,
    duration: Option<f64>,
    profiles: Vec<(String, Option<Profile>)>,
    incidents: Vec<Incident>,
    kinds: Vec<Kind>,
    trace_last: usize,
    keep_trace: bool,
}

/// Each request costs this many tokens unless its profile or the spec says otherwise.
const TOKENS: u64 = 1000;

fn parse_spec(spec: &str, now: f64) -> Result<Spec, String> {
    let spec: Value = serde_json::from_str(spec).map_err(|e| e.to_string())?;
    let tokens = num(&spec, "tokens").map_or(TOKENS, |n| n as u64);
    Ok(Spec {
        model: spec
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned(),
        rate: num(&spec, "rate").unwrap_or(1.0).max(0.0),
        duration: num(&spec, "duration"),
        profiles: parse_profiles(spec.get("profiles"), tokens)?,
        incidents: parse_incidents(spec.get("incidents"), now),
        kinds: parse_kinds(spec.get("requests")),
        trace_last: num(&spec, "trace_last").map_or(2000, |n| n as usize),
        keep_trace: spec.get("trace").and_then(Value::as_bool).unwrap_or(false),
    })
}

/// The traffic mix: `[{"label", "weight"?, "body"?, "sessions"?, "tokens"?}]`. Absent or empty, every
/// request is `{"model": <the run's model>}`.
fn parse_kinds(value: Option<&Value>) -> Vec<Kind> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
        .map(|(index, kind)| Kind {
            label: kind
                .get("label")
                .and_then(Value::as_str)
                .map_or_else(|| format!("kind{}", index + 1), str::to_owned),
            weight: num(kind, "weight").unwrap_or(1.0).max(0.0),
            body: kind.get("body").cloned().unwrap_or_else(|| json!({})),
            sessions: num(kind, "sessions").map_or(0, |n| n.max(0.0) as u32),
            tokens: num(kind, "tokens").map(|n| n.max(0.0) as u64),
        })
        .collect()
}

fn by_time(marks: &mut [Value]) {
    marks.sort_by(|a, b| a["t"].as_f64().partial_cmp(&b["t"].as_f64()).unwrap());
}

/// A router built from one config, with its own clock, cache and scripted host.
#[wasm_bindgen]
pub struct Playground {
    router: Arc<Router>,
    host: Arc<ScriptedHost>,
    seed: u64,
    /// The router settings as given, for the fallback maps the diagram draws.
    settings: Value,
    /// The incremental simulation, while one runs.
    run: RefCell<Option<Run>>,
    /// The last `trace_last` simulated requests' traces, kept past `simStop`.
    kept: RefCell<VecDeque<Kept>>,
}

impl Playground {
    /// Set the host up for a simulation from `spec` and draw the first arrival.
    fn begin(&self, spec: Spec, capture: Capture) -> Run {
        let now = self.host.clock.elapsed();
        *self.host.profiles.lock() = spec
            .profiles
            .into_iter()
            .filter_map(|(id, profile)| Some((id, profile?)))
            .collect();
        *self.host.incidents.lock() = spec.incidents;
        self.host.taken.lock().clear();
        *self.host.sim.lock() = SimLog {
            capture,
            ..SimLog::default()
        };
        self.host.trace.lock().clear();
        self.host.sched.clear();
        self.host.sched.active.store(true, Ordering::Relaxed);
        let end = spec
            .duration
            .map(|duration| now + Duration::from_secs_f64(duration.max(0.0)));
        let trace_last = if capture == Capture::Steps {
            spec.trace_last
        } else {
            0
        };
        let mut run = Run::new(spec.model, spec.kinds, spec.rate, end, trace_last);
        run.schedule(&self.host, now);
        run
    }

    /// Back to single calls: drop what a simulation left behind, except the cache and the clock.
    fn end(&self) {
        self.host.sched.active.store(false, Ordering::Relaxed);
        self.host.sched.clear();
        self.host.profiles.lock().clear();
        self.host.incidents.lock().clear();
        self.host.taken.lock().clear();
        *self.host.sim.lock() = SimLog::default();
    }

    fn take_marks(&self) -> Vec<Value> {
        let mut marks = std::mem::take(&mut self.host.sim.lock().marks);
        by_time(&mut marks);
        marks
    }

    /// Every deployment's cooldown, this minute's usage and attempts in flight.
    fn deployment_states(&self) -> Vec<Value> {
        let health = self.router.health();
        let sim = self.host.sim.lock();
        self.router
            .registry()
            .deployments_from(0)
            .iter()
            .map(|deployment| {
                let (tpm, rpm) = pollster::block_on(health.usage(deployment)).unwrap_or_default();
                let sent = self.host.taken_now(&deployment.id);
                let key = cooldown_key(&deployment.id);
                let cooling = self.host.cache.live(&key).map(|value| {
                    let status = &value["status_code"];
                    let status = status
                        .as_str()
                        .and_then(|text| text.parse::<u16>().ok())
                        .map_or_else(|| status.clone(), |code| json!(code));
                    json!({"status": status, "remaining": self.host.cache.ttl(&key)})
                });
                json!({
                    "id": deployment.id,
                    "model_name": deployment.model_name,
                    "cooling": cooling,
                    "rpm": rpm,
                    "tpm": tpm,
                    "provider": {"rpm": sent.0, "tpm": sent.1},
                    "in_flight": sim.in_flight.get(&deployment.id).copied().unwrap_or(0),
                })
            })
            .collect()
    }
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
                version: Default::default(),
            },
            clock: clock.clone(),
            behaviour: Mutex::new(HashMap::new()),
            trace: Mutex::new(Vec::new()),
            sched: Arc::new(Sched::default()),
            current: AtomicU64::new(0),
            profiles: Mutex::new(HashMap::new()),
            incidents: Mutex::new(Vec::new()),
            taken: Mutex::new(HashMap::new()),
            sim: Mutex::new(SimLog::default()),
            rng: SeededRandomness::new(seed ^ 0x5eed_5eed),
            single_tokens: Mutex::new(None),
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
            router: Arc::new(router),
            host,
            seed,
            settings,
            run: RefCell::new(None),
            kept: RefCell::new(VecDeque::new()),
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

    /// Send one `acompletion` through the router and return `{result, trace}` as JSON. A
    /// `playground_tokens` field is taken off the body and sets what the call costs in tokens.
    pub fn send(&self, request: &str) -> Result<String, JsError> {
        if self.run.borrow().is_some() {
            return Err(JsError::new("a simulation is running; call simStop first"));
        }
        let mut body: Value = serde_json::from_str(request)?;
        let tokens = body
            .as_object_mut()
            .and_then(|map| map.remove("playground_tokens"))
            .and_then(|tokens| tokens.as_u64());
        *self.host.single_tokens.lock() = tokens;
        let request = parse_request(&body);
        self.host.trace.lock().clear();
        let started = self.host.clock.elapsed();
        let result = outcome(pollster::block_on(
            self.router.call(Op::from("acompletion"), request),
        ));
        let took = (self.host.clock.elapsed() - started).as_secs_f64();
        *self.host.single_tokens.lock() = None;
        let trace = std::mem::take(&mut *self.host.trace.lock());
        Ok(json!({"result": result, "trace": trace, "took": took}).to_string())
    }

    /// Run steady traffic with many calls in flight on simulated time, start to finish. `spec`
    /// is JSON: `{"model": "gpt-4o", "rate": 3, "duration": 300, "trace": false,
    ///   "profiles": {"<id>": {"p50_ms": 800, "p95_ms": 2400, "error_rate": 0.04,
    ///                         "errors": {"InternalServerError": 3, "RateLimitError": 1},
    ///                         "rpm_cap": 120, "tpm_cap": 200000, "tokens": 1000}},
    ///   "incidents": [{"key": "slow", "id": "<id>", "from": 40, "to": 70, "latency_factor": 10}]}`.
    /// Arrivals are Poisson at `rate` per second. Returns every request's start, end, outcome and
    /// attempts.
    pub fn simulate(&self, spec: &str) -> Result<String, JsError> {
        if self.run.borrow().is_some() {
            return Err(JsError::new("a simulation is running; call simStop first"));
        }
        let mut spec = parse_spec(spec, self.now()).map_err(|e| JsError::new(&e))?;
        spec.duration = Some(spec.duration.unwrap_or(60.0));
        let capture = if spec.keep_trace {
            Capture::Flat
        } else {
            Capture::Off
        };
        let mut run = self.begin(spec, capture);
        let (mut requests, mut kept) = (Vec::new(), VecDeque::new());
        run.advance(&self.router, &self.host, None, &mut requests, &mut kept);
        let (stuck, max_in_flight, polls) = (run.in_flight(), run.max_in_flight, run.polls);
        let steps = self.host.sim.lock().steps;
        let marks = self.take_marks();
        drop(run);
        self.end();
        requests.sort_by_key(|request| request["id"].as_u64());
        let trace = std::mem::take(&mut *self.host.trace.lock());
        Ok(json!({
            "requests": requests,
            "marks": marks,
            "stuck": stuck,
            "max_in_flight": max_in_flight,
            "polls": polls,
            "steps": steps,
            "trace": if capture == Capture::Flat { Value::Array(trace) } else { Value::Null },
            "end": self.now(),
        })
        .to_string())
    }

    /// Start an incremental simulation on this router: the same spec as `simulate`, without an
    /// end unless it gives a `duration`, keeping the last `trace_last` (2000) requests' traces.
    #[wasm_bindgen(js_name = simStart)]
    pub fn sim_start(&self, spec: &str) -> Result<(), JsError> {
        self.sim_stop();
        let spec = parse_spec(spec, self.now()).map_err(|e| JsError::new(&e))?;
        self.kept.borrow_mut().clear();
        let capture = if spec.trace_last > 0 {
            Capture::Steps
        } else {
            Capture::Off
        };
        let run = self.begin(spec, capture);
        *self.run.borrow_mut() = Some(run);
        Ok(())
    }

    /// Run the simulation `seconds` of simulated time forward. Returns `{now, completed,
    /// in_flight, deployments, marks}`.
    #[wasm_bindgen(js_name = simAdvance)]
    pub fn sim_advance(&self, seconds: f64) -> Result<String, JsError> {
        let mut run = self.run.borrow_mut();
        let run = run
            .as_mut()
            .ok_or_else(|| JsError::new("no simulation is running; call simStart first"))?;
        let limit = self.host.clock.elapsed() + Duration::from_secs_f64(seconds.max(0.0));
        let mut completed = Vec::new();
        run.advance(
            &self.router,
            &self.host,
            Some(limit),
            &mut completed,
            &mut self.kept.borrow_mut(),
        );
        Ok(json!({
            "now": self.now(),
            "completed": completed,
            "in_flight": run.in_flight(),
            "deployments": self.deployment_states(),
            "marks": self.take_marks(),
        })
        .to_string())
    }

    /// Change the running simulation from now on: `{"rate"?, "profiles"?: {"<id>": profile or
    /// null}, "incidents_add"?: [incident], "incidents_end"?: ["<key>"]}`. Profiles merge by id.
    #[wasm_bindgen(js_name = simSet)]
    pub fn sim_set(&self, change: &str) -> Result<(), JsError> {
        let change: Value = serde_json::from_str(change)?;
        let mut run = self.run.borrow_mut();
        let run = run
            .as_mut()
            .ok_or_else(|| JsError::new("no simulation is running; call simStart first"))?;
        let now = self.now();
        let profiles =
            parse_profiles(change.get("profiles"), TOKENS).map_err(|e| JsError::new(&e))?;
        {
            let mut all = self.host.profiles.lock();
            for (id, profile) in profiles {
                match profile {
                    Some(profile) => all.insert(id, profile),
                    None => all.remove(&id),
                };
            }
        }
        {
            let mut incidents = self.host.incidents.lock();
            incidents.extend(parse_incidents(change.get("incidents_add"), now));
            for key in text_list(change.get("incidents_end")) {
                for incident in incidents.iter_mut().filter(|incident| incident.key == key) {
                    incident.to = incident.to.min(now);
                }
            }
        }
        mark_incidents(&self.host);
        if let Some(rate) = num(&change, "rate") {
            run.set_rate(&self.host, rate);
        }
        if change.get("requests").is_some() {
            run.kinds = parse_kinds(change.get("requests"));
        }
        Ok(())
    }

    /// One simulated request's trace in the shape `send` returns, plus its `id`, `model`,
    /// `start` and `end`; `null` once it has left the last `trace_last`.
    #[wasm_bindgen(js_name = simTrace)]
    pub fn sim_trace(&self, id: u32) -> String {
        self.kept
            .borrow()
            .iter()
            .find(|kept| kept.id == u64::from(id))
            .map_or(Value::Null, Kept::render)
            .to_string()
    }

    /// End the incremental simulation. Calls still in flight are dropped; the cache and clock stay
    /// as they are, and the kept traces stay readable.
    #[wasm_bindgen(js_name = simStop)]
    pub fn sim_stop(&self) {
        if self.run.borrow_mut().take().is_some() {
            self.end();
        }
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
