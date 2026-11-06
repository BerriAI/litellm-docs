//! Many router calls in flight at once on simulated time. Calls are futures polled by a small
//! single-threaded executor; the host's waits (attempt latency, retry sleeps) are timers on the
//! virtual clock, and when no call can make progress the clock jumps to the next timer or arrival.
//! Nothing waits in real time, and a run replays exactly from its seed.

use std::{
    collections::{BTreeMap, HashMap, VecDeque},
    future::Future,
    pin::Pin,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    task::{Context, Poll, Wake, Waker},
    time::Duration,
};

use litellm_router_core::{Op, Router};
use parking_lot::Mutex;
use serde_json::{json, Value};

use crate::{outcome, parse_request, render_snap, RequestLog, ScriptedHost, Snap, VirtualClock};

/// Timers keyed by (due time, registration order), so equal due times fire in a fixed order.
#[derive(Default)]
pub(crate) struct Sched {
    timers: Mutex<BTreeMap<(Duration, u64), Waker>>,
    seq: AtomicU64,
    /// While false, waits complete at once by moving the clock, as a single `send` does.
    pub(crate) active: AtomicBool,
}

impl Sched {
    pub(crate) fn next_due(&self) -> Option<Duration> {
        self.timers.lock().keys().next().map(|(at, _)| *at)
    }

    /// Forget every timer, for calls dropped mid-flight.
    pub(crate) fn clear(&self) {
        self.timers.lock().clear();
    }

    /// Wake every timer due at or before `now`.
    pub(crate) fn fire(&self, now: Duration) {
        let due: Vec<Waker> = {
            let mut timers = self.timers.lock();
            let later = timers.split_off(&(now, u64::MAX));
            std::mem::replace(&mut *timers, later)
                .into_values()
                .collect()
        };
        for waker in due {
            waker.wake();
        }
    }
}

/// Resolves once the virtual clock reaches `at`.
pub(crate) struct Delay {
    pub(crate) sched: Arc<Sched>,
    pub(crate) clock: VirtualClock,
    pub(crate) at: Duration,
}

impl Future for Delay {
    type Output = ();
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<()> {
        if self.clock.elapsed() >= self.at {
            return Poll::Ready(());
        }
        let seq = self.sched.seq.fetch_add(1, Ordering::Relaxed);
        self.sched
            .timers
            .lock()
            .insert((self.at, seq), cx.waker().clone());
        Poll::Pending
    }
}

struct Flag(AtomicBool);

impl Wake for Flag {
    fn wake(self: Arc<Self>) {
        self.0.store(true, Ordering::Relaxed);
    }
}

pub(crate) struct Task<'a, T> {
    pub(crate) id: usize,
    future: Pin<Box<dyn Future<Output = T> + 'a>>,
    flag: Arc<Flag>,
    waker: Waker,
}

impl<'a, T> Task<'a, T> {
    pub(crate) fn new(id: usize, future: impl Future<Output = T> + 'a) -> Self {
        let flag = Arc::new(Flag(AtomicBool::new(true)));
        Task {
            id,
            future: Box::pin(future),
            waker: Waker::from(flag.clone()),
            flag,
        }
    }

    /// Poll if woken since the last poll. `None` while it is still running.
    pub(crate) fn poll_if_woken(&mut self) -> Option<Option<T>> {
        if !self.flag.0.swap(false, Ordering::Relaxed) {
            return None;
        }
        let mut cx = Context::from_waker(&self.waker);
        match self.future.as_mut().poll(&mut cx) {
            Poll::Ready(value) => Some(Some(value)),
            Poll::Pending => Some(None),
        }
    }
}

/// A completed request's trace, kept for `simTrace`.
pub(crate) struct Kept {
    pub(crate) id: u64,
    pub(crate) model: String,
    pub(crate) start: f64,
    pub(crate) end: f64,
    pub(crate) result: Value,
    steps: Vec<(Value, Duration, Arc<Snap>)>,
}

impl Kept {
    /// The shape `send` returns, so the state diagram folds it unchanged.
    pub(crate) fn render(&self) -> Value {
        let trace: Vec<Value> = self
            .steps
            .iter()
            .map(|(step, at, snap)| {
                let mut step = step.clone();
                step["cache"] = render_snap(snap, *at);
                step
            })
            .collect();
        json!({
            "id": self.id,
            "model": self.model,
            "start": self.start,
            "end": self.end,
            "result": self.result,
            "trace": trace,
            "took": self.end - self.start,
        })
    }
}

/// One kind of request in the traffic mix: its share of arrivals, the body it sends (merged over
/// `{"model": <the run's model>}`), how many distinct session ids it spreads over, and the tokens
/// each one costs when not its profile's.
#[derive(Clone)]
pub(crate) struct Kind {
    pub(crate) label: String,
    pub(crate) weight: f64,
    pub(crate) body: Value,
    pub(crate) sessions: u32,
    pub(crate) tokens: Option<u64>,
}

/// Who a simulated request is: its kind, session and requested model, for the outcome list.
#[derive(Clone, Default)]
struct Who {
    kind: Option<String>,
    session: Option<String>,
    model: String,
    start: f64,
}

/// One run of Poisson traffic on the virtual clock: the calls in flight and the next arrival.
pub(crate) struct Run {
    pub(crate) model: String,
    pub(crate) kinds: Vec<Kind>,
    rate: f64,
    /// Arrivals stop here, when the run has a duration.
    end: Option<Duration>,
    next_arrival: Option<Duration>,
    tasks: Vec<Task<'static, Value>>,
    starts: HashMap<usize, Who>,
    next_id: usize,
    pub(crate) trace_last: usize,
    pub(crate) max_in_flight: usize,
    pub(crate) polls: u64,
}

impl Run {
    pub(crate) fn new(
        model: String,
        kinds: Vec<Kind>,
        rate: f64,
        end: Option<Duration>,
        trace_last: usize,
    ) -> Self {
        Run {
            model,
            kinds,
            rate,
            end,
            next_arrival: None,
            tasks: Vec::new(),
            starts: HashMap::new(),
            next_id: 0,
            trace_last,
            max_in_flight: 0,
            polls: 0,
        }
    }

    pub(crate) fn in_flight(&self) -> usize {
        self.tasks.len()
    }

    /// Draw the next arrival after `from` at the current rate.
    pub(crate) fn schedule(&mut self, host: &ScriptedHost, from: Duration) {
        self.next_arrival = (self.rate > 0.0)
            .then(|| from + Duration::from_secs_f64(-(1.0 - host.uniform()).ln() / self.rate))
            .filter(|at| self.end.is_none_or(|end| *at < end));
    }

    pub(crate) fn set_rate(&mut self, host: &ScriptedHost, rate: f64) {
        self.rate = rate.max(0.0);
        self.schedule(host, host.clock.elapsed());
    }

    /// The next arrival's body: a kind drawn by weight, its session drawn from its pool.
    fn draw(&self, host: &ScriptedHost, start: f64, id: u64) -> (Value, Who) {
        let total: f64 = self.kinds.iter().map(|kind| kind.weight).sum();
        let mut roll = if total > 0.0 {
            host.uniform() * total
        } else {
            0.0
        };
        let kind = self.kinds.iter().find(|kind| {
            if roll < kind.weight {
                return true;
            }
            roll -= kind.weight;
            false
        });
        let Some(kind) = kind.or(self.kinds.last()) else {
            return (
                json!({"model": self.model}),
                Who {
                    model: self.model.clone(),
                    start,
                    ..Who::default()
                },
            );
        };
        let mut body = match &kind.body {
            Value::Object(map) => Value::Object(map.clone()),
            _ => json!({}),
        };
        if body
            .get("model")
            .and_then(Value::as_str)
            .is_none_or(str::is_empty)
        {
            body["model"] = json!(self.model);
        }
        let session = (kind.sessions > 0).then(|| {
            let n = ((host.uniform() * f64::from(kind.sessions)) as u32).min(kind.sessions - 1);
            format!("{}-{}", kind.label, n + 1)
        });
        if let Some(session) = &session {
            if !body["metadata"].is_object() {
                body["metadata"] = json!({});
            }
            body["metadata"]["session_id"] = json!(session);
            body["litellm_session_id"] = json!(session);
        }
        if let Some(tokens) = kind.tokens {
            host.sim.lock().tokens.insert(id, tokens);
        }
        let model = body["model"].as_str().unwrap_or_default().to_owned();
        (
            body,
            Who {
                kind: Some(kind.label.clone()),
                session,
                model,
                start,
            },
        )
    }

    /// Run until the clock reaches `limit`, or with no limit until nothing is left to do.
    /// Completed requests go to `completed`, their traces to `kept`.
    pub(crate) fn advance(
        &mut self,
        router: &Arc<Router>,
        host: &ScriptedHost,
        limit: Option<Duration>,
        completed: &mut Vec<Value>,
        kept: &mut VecDeque<Kept>,
    ) {
        let clock = host.clock.clone();
        loop {
            while let Some(at) = self.next_arrival.filter(|at| *at <= clock.elapsed()) {
                let id = self.next_id;
                self.next_id += 1;
                let (body, who) = self.draw(host, at.as_secs_f64(), id as u64);
                self.starts.insert(id, who);
                let request = parse_request(&body);
                let router = router.clone();
                self.tasks.push(Task::new(id, async move {
                    outcome(router.call(Op::from("acompletion"), request).await)
                }));
                self.schedule(host, at);
            }
            self.max_in_flight = self.max_in_flight.max(self.tasks.len());
            loop {
                let mut progressed = false;
                let mut index = 0;
                while index < self.tasks.len() {
                    host.current
                        .store(self.tasks[index].id as u64, Ordering::Relaxed);
                    match self.tasks[index].poll_if_woken() {
                        None => index += 1,
                        Some(None) => {
                            progressed = true;
                            self.polls += 1;
                            index += 1;
                        }
                        Some(Some(result)) => {
                            progressed = true;
                            self.polls += 1;
                            let task = self.tasks.swap_remove(index);
                            self.finish(host, task.id as u64, result, completed, kept);
                        }
                    }
                }
                if !progressed {
                    break;
                }
            }
            mark_incidents(host);
            let next = match (host.sched.next_due(), self.next_arrival) {
                (Some(a), Some(b)) => Some(a.min(b)),
                (a, b) => a.or(b),
            };
            let now = clock.elapsed();
            match (next, limit) {
                (Some(next), Some(limit)) if next > limit => {
                    clock.advance(limit.saturating_sub(now));
                    mark_incidents(host);
                    break;
                }
                (None, Some(limit)) => {
                    clock.advance(limit.saturating_sub(now));
                    mark_incidents(host);
                    break;
                }
                (None, None) => break,
                (Some(next), _) => {
                    if next > now {
                        clock.advance(next - now);
                    }
                    host.sched.fire(clock.elapsed());
                }
            }
        }
    }

    fn finish(
        &mut self,
        host: &ScriptedHost,
        id: u64,
        result: Value,
        completed: &mut Vec<Value>,
        kept: &mut VecDeque<Kept>,
    ) {
        let log: RequestLog = {
            let mut sim = host.sim.lock();
            sim.tokens.remove(&id);
            sim.requests.remove(&id).unwrap_or_default()
        };
        let who = self.starts.remove(&(id as usize)).unwrap_or_default();
        let start = who.start;
        let end = host.clock.elapsed().as_secs_f64();
        let ok = result["ok"] == true;
        let pick = |key: &str| if ok { result[key].clone() } else { Value::Null };
        completed.push(json!({
            "id": id,
            "start": start,
            "end": end,
            "ok": ok,
            "deployment": pick("deployment"),
            "model_group": pick("model_group"),
            "retries": if ok { result["retries"].clone() } else { json!(log.retries) },
            "fallbacks": if ok { result["fallbacks"].clone() } else { json!(log.fallbacks) },
            "error": if ok { Value::Null } else { result["error"].clone() },
            "attempts": log.attempts,
            "kind": who.kind,
            "session": who.session,
            "model": who.model,
        }));
        if self.trace_last > 0 {
            kept.push_back(Kept {
                id,
                model: who.model.clone(),
                start,
                end,
                result,
                steps: log.steps,
            });
            while kept.len() > self.trace_last {
                kept.pop_front();
            }
        }
    }
}

/// Mark each incident's start and end once the clock has passed it.
pub(crate) fn mark_incidents(host: &ScriptedHost) {
    let now = host.clock.elapsed().as_secs_f64();
    let mut marks = Vec::new();
    for incident in host.incidents.lock().iter_mut() {
        for (phase, at, done) in [
            ("start", incident.from, &mut incident.marked.0),
            ("end", incident.to, &mut incident.marked.1),
        ] {
            if !*done && now >= at {
                *done = true;
                marks.push(json!({"t": at, "kind": "incident", "phase": phase, "key": incident.key, "deployment": incident.id}));
            }
        }
    }
    host.sim.lock().marks.extend(marks);
}
