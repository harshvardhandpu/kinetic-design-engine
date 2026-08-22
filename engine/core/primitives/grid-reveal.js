/* kinetic primitive: grid-reveal v1.0.0
 * Pixel/cell grid reveal (DOM grid, staggered scale-in) — the swisspixelreveal pattern.
 * Evidence: swisspixelreveal (Phase 1 DIRECTLY-INSPECTED): 25x14 grid, scale(0->1),
 * will-change per cell. This version caps cell count and drops will-change after settle.
 * A11y contract: reduced-motion → content visible immediately, no grid.
 */
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const meta = {
  id: 'kinetic.grid-reveal',
  version: '1.0.0',
  family: 'reveal',
  k_level: 'K3',
  p_class: 'P2', // many nodes; bounded by maxCells
};

export function mount(el, opts = {}) {
  const { cols = 16, rows = 9, duration = 500, stagger = 14, maxCells = 200, tokens = {} } = opts;
  el.setAttribute('data-kinetic', meta.id);
  el.setAttribute('data-kinetic-version', meta.version);

  let state = 'idle';
  if (REDUCED) {
    state = 'done-reduced-motion';
    return { meta, play() {}, pause() {}, seek() {}, progress: () => 1, destroy() {}, get state() { return state; } };
  }

  const dur = tokens['duration-med'] ?? duration;
  const c = Math.min(cols, Math.floor(maxCells / rows));
  const grid = document.createElement('div');
  grid.setAttribute('aria-hidden', 'true');
  grid.style.cssText = `position:absolute;inset:0;display:grid;grid-template-columns:repeat(${c},1fr);grid-template-rows:repeat(${rows},1fr);pointer-events:none;`;
  const cells = [];
  for (let i = 0; i < c * rows; i++) {
    const cell = document.createElement('div');
    cell.style.cssText = `background:currentColor;transform:scale(0);`;
    grid.appendChild(cell);
    cells.push(cell);
  }
  el.style.position = el.style.position || 'relative';
  el.appendChild(grid);

  let timeouts = [];
  function play() {
    if (state === 'playing' || state === 'done') return;
    state = 'playing';
    cells.forEach((cell, i) => {
      const delay = (i % c) * stagger + Math.floor(i / c) * stagger;
      timeouts.push(setTimeout(() => {
        cell.style.transition = `transform ${dur}ms cubic-bezier(0.16,1,0.3,1)`;
        cell.style.transform = 'scale(1)';
      }, delay));
      // reveal = cells cover then fade: fade out after cover
      timeouts.push(setTimeout(() => {
        cell.style.transition = `opacity ${dur}ms ease`;
        cell.style.opacity = '0';
      }, delay + dur + 80));
    });
    timeouts.push(setTimeout(() => { grid.remove(); state = 'done'; }, (c + rows) * stagger + dur * 2 + 200));
  }
  function pause() { timeouts.forEach(clearTimeout); timeouts = []; if (state === 'playing') state = 'paused'; }
  function destroy() { pause(); grid.remove(); state = 'destroyed'; }

  let io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { play(); io.disconnect(); } }, { threshold: 0.2 });
  io.observe(el);

  return { meta, play, pause, seek() {}, progress: () => (state === 'done' ? 1 : 0), destroy, get state() { return state; } };
}
