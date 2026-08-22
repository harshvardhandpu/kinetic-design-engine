/* kinetic primitive: cursor-glow v1.0.0
 * Pointer-following radial glow (canvas-free: single div + transform, rAF-lerped).
 * Evidence: ambient-cursor patterns in award corpus (experimental category).
 * A11y contract: reduced-motion OR coarse pointer (touch) → disabled entirely.
 */
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export const meta = {
  id: 'kinetic.cursor-glow',
  version: '1.0.0',
  family: 'ambient',
  k_level: 'K2',
  p_class: 'P2', // rAF loop while pointer active
};

export function mount(el, opts = {}) {
  const { size = 480, color = 'rgba(120,120,255,0.16)', lerp = 0.12 } = opts;
  el.setAttribute('data-kinetic', meta.id);
  el.setAttribute('data-kinetic-version', meta.version);

  let state = 'idle';
  if (REDUCED || COARSE) {
    state = 'done-reduced-motion';
    return { meta, play() {}, pause() {}, seek() {}, progress: () => null, destroy() {}, get state() { return state; } };
  }

  const glow = document.createElement('div');
  glow.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,${color},transparent 70%);pointer-events:none;transform:translate(-50%,-50%);left:0;top:0;will-change:transform;`;
  el.style.position = el.style.position || 'relative';
  el.style.overflow = 'hidden';
  el.appendChild(glow);

  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null, active = false;

  function onMove(e) {
    const r = el.getBoundingClientRect();
    tx = e.clientX - r.left; ty = e.clientY - r.top;
    if (!active) { active = true; loop(); }
  }
  function loop() {
    cx += (tx - cx) * lerp; cy += (ty - cy) * lerp;
    glow.style.transform = `translate(${cx - size / 2}px,${cy - size / 2}px)`;
    if (active && state === 'playing') raf = requestAnimationFrame(loop);
  }
  function play() {
    if (state === 'playing') return;
    state = 'playing';
    el.addEventListener('pointermove', onMove);
  }
  function pause() {
    state = 'paused';
    active = false;
    if (raf) cancelAnimationFrame(raf);
    el.removeEventListener('pointermove', onMove);
  }
  function destroy() { pause(); glow.remove(); state = 'destroyed'; }
  play();

  return { meta, play, pause, seek() {}, progress: () => null, destroy, get state() { return state; } };
}
