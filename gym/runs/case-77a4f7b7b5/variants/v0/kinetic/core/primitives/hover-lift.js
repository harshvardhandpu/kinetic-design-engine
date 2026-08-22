/* kinetic primitive: hover-lift v1.0.0
 * Card hover: transform lift + shadow, transition-only (no JS per-frame).
 * Evidence: elated-convention bento deck (Phase 1 DIRECTLY-INSPECTED):
 * transform-only 0.45s transitions on role=list items, tabindex=0.
 * A11y contract: reduced-motion → no transform, focus outline preserved; keyboard focus triggers same state.
 */
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const meta = {
  id: 'kinetic.hover-lift',
  version: '1.0.0',
  family: 'hover',
  k_level: 'K1',
  p_class: 'P0',
};

let uid = 0;

export function mount(el, opts = {}) {
  const { lift = 6, duration = 450, easing = 'cubic-bezier(0.16, 1, 0.3, 1)', tokens = {} } = opts;
  const dur = tokens['duration-fast'] ?? duration;
  const id = `kinetic-hover-${++uid}`;
  el.setAttribute('data-kinetic', meta.id);
  el.setAttribute('data-kinetic-version', meta.version);
  el.classList.add(id);
  if (!el.hasAttribute('tabindex') && !el.closest('a,button')) el.setAttribute('tabindex', '0');

  const style = document.createElement('style');
  if (REDUCED) {
    style.textContent = `.${id}:focus-visible{outline:2px solid currentColor;outline-offset:2px}`;
  } else {
    style.textContent = `.${id}{transition:transform ${dur}ms ${easing},box-shadow ${dur}ms ${easing};will-change:transform}
.${id}:hover,.${id}:focus-visible{transform:translateY(-${lift}px);box-shadow:0 12px 32px rgba(0,0,0,.12)}
.${id}:focus-visible{outline:2px solid currentColor;outline-offset:2px}`;
  }
  document.head.appendChild(style);

  let state = REDUCED ? 'done-reduced-motion' : 'armed';
  return {
    meta,
    play() { state = 'armed'; },
    pause() { state = 'paused'; },
    seek() {},
    progress: () => null,
    destroy() { style.remove(); el.classList.remove(id); state = 'destroyed'; },
    get state() { return state; },
  };
}
