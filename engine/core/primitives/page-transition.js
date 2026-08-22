/* kinetic primitive: page-transition v1.0.0
 * Overlay wipe transition for SPA-style route changes (CSS transform, no library).
 * Evidence: IZANAMI transition elements (Awwwards element highlights), BARBA.js-class pattern.
 * A11y contract: reduced-motion → instant swap, focus moved to new main heading.
 */
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const meta = {
  id: 'kinetic.page-transition',
  version: '1.0.0',
  family: 'transition',
  k_level: 'K3',
  p_class: 'P1',
};

export function mount(root, opts = {}) {
  const { duration = 600, color = 'currentColor', tokens = {} } = opts;
  const dur = tokens['duration-page'] ?? duration;
  root.setAttribute('data-kinetic', meta.id);
  root.setAttribute('data-kinetic-version', meta.version);

  const overlay = document.createElement('div');
  overlay.className = 'kinetic-page-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:${color};transform:scaleY(0);transform-origin:bottom;z-index:9999;pointer-events:none;transition:transform ${dur}ms cubic-bezier(0.7,0,0.3,1);`;
  document.body.appendChild(overlay);

  let state = 'idle';

  async function go(fn) {
    // fn: swap the content (returns promise or sync)
    if (REDUCED) {
      await fn();
      const h = document.querySelector('main h1, main h2');
      h?.setAttribute('tabindex', '-1');
      h?.focus();
      state = 'done-reduced-motion';
      return;
    }
    state = 'covering';
    overlay.style.transformOrigin = 'bottom';
    overlay.style.transform = 'scaleY(1)';
    await new Promise((r) => setTimeout(r, dur));
    await fn();
    const h = document.querySelector('main h1, main h2');
    h?.setAttribute('tabindex', '-1');
    h?.focus();
    state = 'revealing';
    overlay.style.transformOrigin = 'top';
    overlay.style.transform = 'scaleY(0)';
    await new Promise((r) => setTimeout(r, dur));
    state = 'done';
  }
  function destroy() { overlay.remove(); state = 'destroyed'; }

  return { meta, go, play: go, pause() {}, seek() {}, progress: () => null, destroy, get state() { return state; } };
}
