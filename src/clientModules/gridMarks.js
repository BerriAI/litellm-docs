// Card grids (see logo-shape.css) show a small mark where two inner hairlines
// cross. A cell's bottom-right corner is such a crossing unless the cell sits
// in the last column or the last row, and which cells those are depends on
// how many columns fit, so this measures the laid-out grid and tags the cells.

const GRIDS = [
  '.lite-cardgrid',
  "[class*='grid_']:has(> a[class*='card_'])",
  'section.row:has(> article > a.card)',
].join(',');

const observed = new WeakSet();
let observer = null;

function tag(grid) {
  const cells = [...grid.children].filter((el) => el.getClientRects().length > 0);
  if (cells.length === 0) return;
  const frame = grid.getBoundingClientRect();
  const rects = cells.map((el) => el.getBoundingClientRect());
  const lastRowTop = Math.max(...rects.map((r) => r.top));
  cells.forEach((el, i) => {
    const r = rects[i];
    const inner = r.right < frame.right - 2 && r.top < lastRowTop - 1;
    el.toggleAttribute('data-grid-mark', inner);
  });
  grid.setAttribute('data-grid-ready', '');
}

function scan() {
  let grids;
  try {
    grids = document.querySelectorAll(GRIDS);
  } catch {
    return; // no :has() support: the grid still draws, just without marks
  }
  if (!observer && 'ResizeObserver' in window) {
    observer = new ResizeObserver((entries) => entries.forEach((e) => tag(e.target)));
  }
  grids.forEach((grid) => {
    tag(grid);
    if (observer && !observed.has(grid)) {
      observed.add(grid);
      observer.observe(grid);
    }
  });
}

export function onRouteDidUpdate() {
  if (typeof window === 'undefined') return;
  // Wait a frame so the new page is laid out
  window.requestAnimationFrame(scan);
}
