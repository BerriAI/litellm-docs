// Click-to-zoom for screenshots in docs pages. PostHog shows readers clicking
// quickstart and Admin UI screenshots (dead clicks), expecting them to open
// larger. Only large images that are not already links are zoomable.

import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import './imageZoom.css';

const MIN_WIDTH = 280;

function zoomable(img) {
  return (
    img instanceof HTMLImageElement &&
    img.closest('.theme-doc-markdown') &&
    !img.closest('a, button, [role="button"]') &&
    img.getBoundingClientRect().width >= MIN_WIDTH
  );
}

function open(img) {
  const dialog = document.createElement('dialog');
  dialog.className = 'lz-zoom';
  dialog.setAttribute('aria-label', img.alt || 'Enlarged image');
  const big = document.createElement('img');
  big.src = img.currentSrc || img.src;
  big.alt = img.alt || '';
  dialog.appendChild(big);
  const close = () => dialog.close();
  dialog.addEventListener('click', close);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
  try {
    window.posthog?.capture?.('docs_image_zoomed', {path: window.location.pathname, alt: img.alt || ''});
  } catch {
    // analytics must never break the page
  }
}

if (ExecutionEnvironment.canUseDOM) {
  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && !t.classList.contains('lz-zoomable') && zoomable(t)) {
      t.classList.add('lz-zoomable');
    }
  });
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (zoomable(t)) {
      e.preventDefault();
      open(t);
    }
  });
}
