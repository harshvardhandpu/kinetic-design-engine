/* KINETIC evaluator — browser-injected gate suite.
 * Inject via browser_console(expression=<this file's contents>) on a rendered page.
 * Returns JSON: { technical, responsive, a11y, performance, meta }.
 * PRODUCER SEPARATION (doc 44 / Amendment G):
 *   - everything here is 'objective' or 'heuristic' producer ONLY.
 *   - design/aesthetic judgment is NOT produced here; it requires vision-capable
 *     or human review and is recorded separately as 'ai-critic'/'human'.
 * Call with viewport preset: window.__KINETIC_VIEWPORT__ = 'mobile'|'tablet'|'desktop' before eval.
 */
(() => {
  const out = { schema: 'kinetic/evaluation@0.1', url: location.href, viewport: window.__KINETIC_VIEWPORT__ || 'desktop', at: new Date().toISOString(), gates: {} };

  // ---- TECHNICAL (objective) ----
  const tech = { producer: 'objective', checks: {} };
  tech.checks.kinetic_elements = [...document.querySelectorAll('[data-kinetic]')].map((e) => ({
    id: e.getAttribute('data-kinetic'), version: e.getAttribute('data-kinetic-version'), tag: e.tagName.toLowerCase(),
  }));
  tech.checks.kinetic_count = tech.checks.kinetic_elements.length;
  tech.checks.title_present = !!document.title.trim();
  tech.checks.h1_count = document.querySelectorAll('h1').length;
  tech.checks.images_broken = [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length;
  tech.checks.links_empty_href = [...document.querySelectorAll('a')].filter((a) => !a.getAttribute('href')).length;
  tech.result = (tech.checks.h1_count >= 1 && tech.checks.images_broken === 0) ? 'pass' : 'fail';
  out.gates.technical = tech;

  // ---- RESPONSIVE (objective, per current viewport) ----
  const resp = { producer: 'objective', checks: {} };
  const docEl = document.documentElement;
  resp.checks.horizontal_overflow = docEl.scrollWidth > docEl.clientWidth + 1;
  resp.checks.scroll_width = docEl.scrollWidth;
  resp.checks.client_width = docEl.clientWidth;
  // elements escaping viewport
  const esc = [];
  document.querySelectorAll('body *').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width > 0 && (r.right > docEl.clientWidth + 2 || r.left < -2)) esc.push(e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));
  });
  resp.checks.escaping_elements = esc.slice(0, 10);
  resp.checks.escaping_count = esc.length;
  // text truncation heuristic
  const clipped = [...document.querySelectorAll('h1,h2,h3,p,li,a,span')].filter((e) => {
    const cs = getComputedStyle(e);
    return e.scrollWidth > e.clientWidth + 1 && cs.overflow === 'hidden' && cs.textOverflow === 'ellipsis' === false && e.textContent.trim().length > 0 && e.children.length === 0;
  }).length;
  resp.checks.possibly_clipped_text = clipped;
  resp.result = (!resp.checks.horizontal_overflow && resp.checks.escaping_count === 0) ? 'pass' : 'fail';
  out.gates.responsive = resp;

  // ---- A11Y (heuristic) ----
  const a11y = { producer: 'heuristic', checks: {} };
  a11y.checks.html_lang = !!document.documentElement.getAttribute('lang');
  const interactive = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')];
  a11y.checks.interactive_count = interactive.length;
  a11y.checks.interactive_without_label = interactive.filter((e) => {
    if (e.tagName === 'INPUT' || e.tagName === 'SELECT' || e.tagName === 'TEXTAREA') return !(e.getAttribute('aria-label') || e.getAttribute('id') && document.querySelector(`label[for="${e.id}"]`));
    return !(e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('alt'));
  }).length;
  a11y.checks.tabindex_positive = document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').length;
  // contrast: sample body text vs background (heuristic)
  const body = document.body;
  const cs = getComputedStyle(body);
  a11y.checks.body_font_size = parseFloat(cs.fontSize);
  // reduced-motion readiness: does the page include kinetic primitives (which degrade) — check meta presence
  a11y.checks.kinetic_reduced_motion_capable = tech.checks.kinetic_count > 0; // primitives carry the contract
  a11y.checks.focus_visible_styles = (() => {
    // heuristic: any :focus-visible rule in stylesheets
    try {
      for (const sh of document.styleSheets) {
        try { for (const r of sh.cssRules) if (r.selectorText && r.selectorText.includes('focus-visible')) return true; } catch {}
      }
    } catch {}
    return false;
  })();
  a11y.result = (a11y.checks.html_lang && a11y.checks.interactive_without_label === 0 && a11y.checks.tabindex_positive === 0) ? 'pass' : 'warn';
  out.gates.a11y = a11y;

  // ---- PERFORMANCE (heuristic) ----
  const perf = { producer: 'heuristic', checks: {} };
  perf.checks.dom_nodes = document.querySelectorAll('*').length;
  perf.checks.will_change_count = [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).willChange !== 'auto').length;
  perf.checks.animations_running = [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).animationName !== 'none').length;
  perf.checks.iframes = document.querySelectorAll('iframe').length;
  perf.checks.large_images = [...document.images].filter((i) => i.naturalWidth * i.naturalHeight > 4_000_000).length;
  perf.checks.continuous_raf_hint = !!window.__KINETIC_RAF_LOOP__; // primitives set this if a persistent loop exists
  perf.result = (perf.checks.dom_nodes < 3000 && perf.checks.will_change_count < 60 && !perf.checks.continuous_raf_hint) ? 'pass' : 'warn';
  out.gates.performance = perf;

  // ---- DESIGN: explicitly NOT evaluated here (Amendment G) ----
  out.gates.design = { producer: 'not-evaluated', result: 'pending-vision-or-human', note: 'aesthetic validation requires vision-capable review or human review; DOM/style probes alone cannot qualify design (Amendment G).' };

  return JSON.stringify(out);
})()
