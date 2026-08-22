/* kinetic primitive: marquee v1.0.0
 * Infinite text marquee, CSS-animation driven (no JS loop → P0 cost while running).
 * Evidence: award corpus "Text Marquee animation" collection + Phase-1 deck studies.
 * A11y contract: reduced-motion → static single copy; pause on hover/focus.
 */
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const meta = {
  id: 'kinetic.marquee',
  version: '1.0.0',
  family: 'ambient',
  k_level: 'K1',
  p_class: 'P0', // pure CSS animation, compositor-only
};

let uid = 0;

export function mount(el, opts = {}) {
  const { speed = 40, gap = '2rem', text = null, tokens = {} } = opts;
  const sp = tokens['marquee-speed'] ?? speed; // px per second
  const content = text ?? el.textContent.trim();
  const id = `kinetic-marquee-${++uid}`;

  el.setAttribute('data-kinetic', meta.id);
  el.setAttribute('data-kinetic-version', meta.version);
  el.style.overflow = 'hidden';

  let state = 'idle';
  if (REDUCED) {
    el.textContent = content; // static, single copy
    state = 'done-reduced-motion';
    return { meta, play() {}, pause() {}, seek() {}, progress: () => 1, destroy() {}, get state() { return state; } };
  }

  const track = document.createElement('div');
  track.className = 'kinetic-marquee-track';
  track.style.cssText = `display:flex;gap:${gap};width:max-content;will-change:transform;`;
  // two copies for seamless loop
  for (let i = 0; i < 2; i++) {
    const seg = document.createElement('span');
    seg.textContent = content;
    seg.style.whiteSpace = 'nowrap';
    track.appendChild(seg);
  }
  el.textContent = '';
  el.appendChild(track);

  const style = document.createElement('style');
  const dur = Math.max(1, (track.scrollWidth / 2) / sp);
  style.textContent = `@keyframes ${id}{from{transform:translateX(0)}to{transform:translateX(-50%)}}
#${id}-host .kinetic-marquee-track{animation:${id} ${dur}s linear infinite}
#${id}-host:hover .kinetic-marquee-track,#${id}-host:focus-within .kinetic-marquee-track{animation-play-state:paused}`;
  el.id = `${id}-host`;
  document.head.appendChild(style);
  state = 'playing';

  return {
    meta,
    play() { track.style.animationPlayState = 'running'; state = 'playing'; },
    pause() { track.style.animationPlayState = 'paused'; state = 'paused'; },
    seek() { /* CSS loop: seek not meaningful */ },
    progress: () => null,
    destroy() { style.remove(); el.textContent = content; el.id = ''; state = 'destroyed'; },
    get state() { return state; },
  };
}
