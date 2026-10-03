import legacy from '@site/docs/proxy/lens/legacy-links.json';

// Preserve section and framework links from the original single-page guide.
export function onRouteDidUpdate({location}) {
  if (location.pathname.replace(/\/$/, '') !== '/docs/proxy/lens') return;
  const framework = new URLSearchParams(location.search).get('framework');
  const target = framework && legacy.frameworks[framework]
    || legacy.anchors[location.hash.slice(1)];
  if (target && target.split('#')[0] !== '/docs/proxy/lens') window.location.replace(target);
}
