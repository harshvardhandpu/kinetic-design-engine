/* kinetic primitive: reveal-stagger v1.0.0
 * Evidence: thoughtful-focus hero (Phase 1 DIRECTLY-INSPECTED):
 * per-char inline-block spans, opacity+translateY, 1.2s cubic-bezier(0.16,1,0.3,1), 120ms stagger.
 * Framework-independent. Handle contract: progress/pause/play/seek/state/destroy.
 * A11y contract: under prefers-reduced-motion renders final state immediately (no animation).
 */
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const meta = {
  id: 'kinetic.reveal-stagger',
  version: '1.0.0',
  family: 'reveal',
  k_level: 'K2',
  p_class: 'P1', // transform/opacity only, no continuous loops
};

export function mount(el, opts = {}) {
  const {
    selector = '[data-reveal-item]',
    splitChars = false,
    duration = 1200,
    stagger = 120,
    easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
    y = '0.6em',
    threshold = 0.2,
    tokens = {},
  } = opts;
  // clamp: IntersectionObserver requires threshold in [0,1]; out-of-range throws
  // RangeError AFTER setPre() would hide content (defect found in Phase-2 Test 3)
  const safeThreshold = Math.min(1, Math.max(0, threshold));
  const d = tokens['duration-slow'] ?? duration;
  const st = tokens['stagger-base'] ?? stagger;

  let targets = [];
  if (splitChars && el.textContent) {
    const text = el.textContent;
    el.setAttribute('aria-label', text.trim());
    el.textContent = '';
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    for (const ch of text) {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.display = 'inline-block';
      wrap.appendChild(s);
    }
    el.appendChild(wrap);
    targets = [...wrap.children];
  } else {
    targets = [...el.querySelectorAll(selector)];
    if (!targets.length) targets = [el];
  }

  const initial = targets.map((t) => ({
    opacity: getComputedStyle(t).opacity,
    transform: getComputedStyle(t).transform,
  }));

  const setPre = () => targets.forEach((t) => {
    t.style.opacity = '0';
    t.style.transform = `translateY(${y})`;
  });
  const setFinal = () => targets.forEach((t, i) => {
    t.style.transition = `opacity ${d}ms ${easing} ${i * st}ms, transform ${d}ms ${easing} ${i * st}ms`;
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
  });

  let state = 'idle';
  let io = null;
  let timeouts = [];

  if (REDUCED) {
    state = 'done-reduced-motion';
    // final state, no animation (a11y contract)
  } else {
    setPre();
    io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && state === 'idle') play();
    }, { threshold: safeThreshold });
    io.observe(el);
  }

  function play() {
    if (state === 'playing' || state === 'done') return;
    state = 'playing';
    setFinal();
    const total = d + st * (targets.length - 1);
    timeouts.push(setTimeout(() => { state = 'done'; }, total));
  }
  function pause() {
    if (state !== 'playing') return;
    // freeze current computed styles
    targets.forEach((t) => {
      const cs = getComputedStyle(t);
      t.style.transition = 'none';
      t.style.opacity = cs.opacity;
      t.style.transform = cs.transform;
    });
    timeouts.forEach(clearTimeout); timeouts = [];
    state = 'paused';
  }
  function seek(p) {
    // p in [0,1]: approximate by applying final state to first p-fraction
    const n = Math.round(p * targets.length);
    targets.forEach((t, i) => {
      t.style.transition = 'none';
      t.style.opacity = i < n ? '1' : '0';
      t.style.transform = i < n ? 'translateY(0)' : `translateY(${y})`;
    });
    state = p >= 1 ? 'done' : 'seeked';
  }
  function progress() {
    if (state === 'done' || state === 'done-reduced-motion') return 1;
    if (state === 'idle') return 0;
    return null; // mid-flight unknown without rAF bookkeeping
  }
  function destroy() {
    io?.disconnect();
    timeouts.forEach(clearTimeout);
    targets.forEach((t, i) => {
      t.style.transition = '';
      t.style.opacity = initial[i].opacity;
      t.style.transform = initial[i].transform === 'none' ? '' : initial[i].transform;
    });
    state = 'destroyed';
  }

  el.setAttribute('data-kinetic', meta.id);
  el.setAttribute('data-kinetic-version', meta.version);

  return { meta, play, pause, seek, progress, destroy, get state() { return state; }, targets };
}
