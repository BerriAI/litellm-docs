import legacy from '@site/docs/proxy/deploy/legacy-links.json';

// Keep bookmarked section links working after the deployment guide is split.
export function onRouteDidUpdate({location}) {
  if (location.pathname.replace(/\/$/, '') !== '/docs/proxy/deploy') return;
  const section = location.hash.slice(1);
  if (Object.prototype.hasOwnProperty.call(legacy, section)) {
    window.location.replace(legacy[section]);
  }
}
