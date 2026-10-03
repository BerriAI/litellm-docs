import legacy from '@site/docs/proxy/lens/legacy-links.json';

const own = (map, key) => (key && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined);

// Preserve section and framework links from the original single-page guide.
export function onRouteDidUpdate({location}) {
  if (location.pathname.replace(/\/$/, '') !== '/docs/proxy/lens') return;
  const hash = location.hash.slice(1);
  const section = own(legacy.anchors, hash);
  const framework = own(legacy.frameworks, new URLSearchParams(location.search).get('framework'));
  const target = framework && (!section || hash === 'send-your-first-trace') ? framework : section;
  if (target && target.split('#')[0] !== '/docs/proxy/lens') window.location.replace(target);
}
