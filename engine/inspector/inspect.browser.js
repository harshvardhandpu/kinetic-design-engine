/* KINETIC dev inspector — browser-injected structured feedback generator.
 * Produces machine-readable feedback targeting kinetic elements:
 *   element -> data-kinetic id -> issue class -> evidence
 * The resolver then maps id -> receipt -> source file for repair (Test 3).
 * Feedback schema: kinetic/visual-feedback@0.1 (Phase-1 schema).
 */
(() => {
  const fb = { schema: 'kinetic/visual-feedback@0.1', url: location.href, at: new Date().toISOString(), issues: [], elements: [] };

  for (const el of document.querySelectorAll('[data-kinetic]')) {
    const id = el.getAttribute('data-kinetic');
    const version = el.getAttribute('data-kinetic-version');
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const info = { kinetic_id: id, version, tag: el.tagName.toLowerCase(), rect: { w: Math.round(r.width), h: Math.round(r.height) }, opacity: cs.opacity };
    fb.elements.push(info);

    // issue: invisible element that should be visible (stuck pre-animation state)
    if (parseFloat(cs.opacity) < 0.05 && r.width > 0) {
      fb.issues.push({
        kinetic_id: id, element: info, severity: 'high',
        class: 'invisible-stuck',
        message: `${id} on <${el.tagName.toLowerCase()}> is at opacity ${cs.opacity} — likely stuck in pre-reveal state (observer never fired or play() never called).`,
        evidence: { opacity: cs.opacity, transform: cs.transform, in_viewport: r.top < innerHeight && r.bottom > 0 },
      });
    }
    // issue: zero-size mount target
    if (r.width === 0 && r.height === 0) {
      fb.issues.push({ kinetic_id: id, element: info, severity: 'medium', class: 'zero-size', message: `${id} mounted on zero-size element.` });
    }
    // issue: escaping viewport
    if (r.width > 0 && (r.right > document.documentElement.clientWidth + 2)) {
      fb.issues.push({ kinetic_id: id, element: info, severity: 'medium', class: 'overflow', message: `${id} element extends past viewport right edge.` });
    }
  }

  // console error correlation (if captured)
  if (window.__KINETIC_CONSOLE_ERRORS__) fb.console_errors = window.__KINETIC_CONSOLE_ERRORS__;

  fb.summary = { elements: fb.elements.length, issues: fb.issues.length, high: fb.issues.filter((i) => i.severity === 'high').length };
  return JSON.stringify(fb);
})()
