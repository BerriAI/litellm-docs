//! Many router calls in flight at once on simulated time. Calls are futures polled by a small
//! single-threaded executor; the host's waits (attempt latency, retry sleeps) are timers on the
//! virtual clock, and when no call can make progress the clock jumps to the next timer or arrival.
//! Nothing waits in real time, and a run replays exactly from its seed.

use std::{
    collections::BTreeMap,
    future::Future,
    pin::Pin,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    task::{Context, Poll, Wake, Waker},
    time::Duration,
};

use parking_lot::Mutex;

use crate::VirtualClock;

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
