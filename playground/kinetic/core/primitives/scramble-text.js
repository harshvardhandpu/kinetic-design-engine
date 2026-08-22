/* kinetic primitive: scramble-text v1.0.0
 * Text scramble/decode effect (award-site staple; fullstack-studio uses GSAP ScrambleTextPlugin — paid.
 * This is the dependency-free equivalent: rAF-driven character resolution.
 * Evidence: Phase-1 fullstack-studio study (ScrambleTextPlugin observed in bundle).
 * A11y contract: reduced-motion → instant final text; aria-label holds real text, scramble is aria-hidden.
 */
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLYPHS = '█▓▒░<>/\\|ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const meta = {
  id: 'kinetic.scramble-text',
  version: '1.0.0',
  family: 'text',
  k_level: 'K2',
  p_class: 'P2', // rAF loop, bounded duration
};

export function mount(el, opts = {}) {
  const { duration = 900, charset = GLYPHS, trigger = 'view', tokens = {} } = opts;
  const dur = tokens['duration-med'] ?? duration;
  const finalText = el.textContent;
  el.setAttribute('data-kinetic', meta.id);
  el.setAttribute('data-kinetic-version', meta.version);
  el.setAttribute('aria-label', finalText.trim());

  let state = 'idle';
  let raf = null;
  let io = null;
  let start = 0;

  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  el.textContent = '';
  el.appendChild(vis);

  if (REDUCED) {
    vis.textContent = finalText;
    state = 'done-reduced-motion';
    return { meta, play() {}, pause() {}, seek() {}, progress: () => 1, destroy() { el.textContent = finalText; }, get state() { return state; } };
  }

  function frame(now) {
    const t = Math.min(1, (now - start) / dur);
    const resolved = Math.floor(t * finalText.length);
    let out = '';
    for (let i = 0; i < finalText.length; i++) {
      const ch = finalText[i];
      if (ch === ' ' || ch === '\n') { out += ch; continue; }
      out += i < resolved ? ch : charset[Math.floor(Math.random() * charset.length)];
    }
    vis.textContent = out;
    if (t < 1 && state === 'playing') raf = requestAnimationFrame(frame);
    else if (t >= 1) { vis.textContent = finalText; state = 'done'; }
  }
  function play() {
    if (state === 'playing' || state === 'done') return;
    state = 'playing';
    start = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (raf) cancelAnimationFrame(raf);
    if (state === 'playing') state = 'paused';
  }
  function seek(p) {
    const resolved = Math.floor(p * finalText.length);
    vis.textContent = finalText.slice(0, resolved) + finalText.slice(resolved).replace(/[^ \n]/g, () => charset[Math.floor(Math.random() * charset.length)]);
    if (p >= 1) vis.textContent = finalText;
    state = p >= 1 ? 'done' : 'seeked';
  }
  function destroy() {
    pause();
    io?.disconnect();
    el.textContent = finalText;
    state = 'destroyed';
  }

  if (trigger === 'view') {
    io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { play(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
  } else play();

  return { meta, play, pause, seek, progress: () => (state === 'done' ? 1 : state === 'idle' ? 0 : null), destroy, get state() { return state; } };
}
