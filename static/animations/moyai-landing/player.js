// Web playback is separate from the finite, paused HyperFrames composition.
if (new URLSearchParams(location.search).has('embed')) {
  const timeline = window.__timelines.moyai;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let settings = {paused: reducedMotion.matches, theme: 'light', visible: true};
  let hasPlayed = false;
  const apply = () => {
    document.documentElement.dataset.theme = settings.theme;
    if (settings.paused) {
      timeline.pause(hasPlayed ? undefined : 8);
    } else if (document.hidden || !settings.visible) {
      timeline.pause();
    } else {
      if (!hasPlayed) timeline.seek(0);
      hasPlayed = true;
      timeline.repeat(-1).play();
    }
  };
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'moyai-landing-hero') return;
    settings = event.data;
    apply();
  });
  document.addEventListener('visibilitychange', apply);
  reducedMotion.addEventListener('change', event => {
    settings.paused = event.matches;
    apply();
  });
  apply();
}
