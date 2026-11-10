import React, {Suspense, lazy, useEffect, useState} from 'react';

// Docs pages link to router playground cases as /router-playground#case=<id>. A plain click opens the
// case in a modal over the page instead; a click with a modifier key, a middle click, or the
// playground page itself keeps the normal link. The modal's code and the router core load on the
// first click only.

const CaseModal = lazy(() => import('./RouterPlayground/CaseModal'));

const CASE_LINK = /#case=([a-z0-9-]+)$/;

function caseOf(event) {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!link || (link.target && link.target !== '_self') || link.closest('[data-case-modal]')) return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin || !/\/router-playground\/?$/.test(url.pathname)) return null;
  if (/\/router-playground\/?$/.test(window.location.pathname)) return null;
  return CASE_LINK.exec(url.hash)?.[1] ?? null;
}

export default function PlaygroundCaseLinks() {
  const [id, setId] = useState(null);
  useEffect(() => {
    const onClick = event => {
      const found = caseOf(event);
      if (!found) return;
      event.preventDefault();
      setId(found);
    };
    // Capture, so the router's own link handling does not navigate first.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  if (!id) return null;
  return (
    <Suspense fallback={null}>
      <CaseModal key={id} id={id} onClose={() => setId(null)} />
    </Suspense>
  );
}
