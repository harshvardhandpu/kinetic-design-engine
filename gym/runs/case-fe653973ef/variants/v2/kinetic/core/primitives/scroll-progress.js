/* kinetic primitive: scroll-progress v1.0.0
 * Scroll-driven transforms via native scroll listener + rAF throttle (no library).
 * Evidence: IZANAMI-class scrollytelling (Phase-1.5 corpus), Locomotive-style sites.
 * Modes: 'parallax' (translateY by depth), 'fade' (opacity by progress), 'scale'.
 * A11y contract: reduced-motion → no transforms applied.
 */
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const meta = {
  id: 'kinetic.scroll-progress',
  version: '1.0.0',
  family: 'scroll',
  k_level: 'K3',
  p_class: 'P1', // rAF-throttled, transform-only
};

export function mount(el, opts = {}) {
  const { mode = 'parallax', depth = 0.2, from = 0, to = 1, tokens = {} } = opts;
  el.setAttribute('data-kinetic', meta.id);
  el.setAttribute('data-kinetic-version', meta.version);

  let state = 'idle';
  let raf = null;
  let lastP = null;

  if (REDUCED) {
    state = 'done-reduced-motion';
    return { meta, play() {}, pause() {}, seek() {}, progress: () => 1, destroy() {}, get state() { return state; } };
  }

  const d = tokens['parallax-depth'] ?? depth;

  function compute() {
    const r = el.getBoundingClientRect();
    const vh = innerHeight || 1;
    // 0 when element top at viewport bottom, 1 when element bottom at viewport top
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    return p;
  }
  function apply(p) {
    lastP = p;
    const t = Math.min(1, Math.max(0, (p - from) / ((to - from) || 1)));
    if (mode === 'parallax') {
      const shift = (t - 0.5) * 2 * d * 100; // percent of element height
      el.style.transform = `translateY(${shift}%)`;
    } else if (mode === 'slide-x') {
      // horizontal scroll-driven translation: t=0 -> +depth*100% right, t=1 -> -depth*100% left
      const shift = (0.5 - t) * 2 * d * 100;
      el.style.transform = `translateX(${shift}%)`;
    } else if (mode === 'fade') {
      el.style.opacity = String(0.15 + 0.85 * t);
    } else if (mode === 'scale') {
      el.style.transform = `scale(${0.92 + 0.08 * t})`;
    }
  }
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; apply(compute()); });
  }
  function play() {
    if (state === 'playing') return;
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    onScroll();
    state = 'playing';
  }
  function pause() {
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
    state = 'paused';
  }
  function seek(p) { apply(p); state = 'seeked'; }
  function destroy() {
    pause();
    if (raf) cancelAnimationFrame(raf);
    el.style.transform = '';
    el.style.opacity = '';
    state = 'destroyed';
  }
  play();

  return { meta, play, pause, seek, progress: () => lastP, destroy, get state() { return state; } };
}
