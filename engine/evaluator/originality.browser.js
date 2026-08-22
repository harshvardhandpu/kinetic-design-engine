/* KINETIC originality gate — browser-injected structural fingerprint.
 * Inject on BOTH reference and candidate; compare fingerprints with
 * engine/evaluator/originality-compare.mjs (Amendment E reference-distance check).
 * V0 fidelity studies are EXEMPT by design (doc 36) — the runner never runs this on V0.
 */
(() => {
  const fp = { schema: 'kinetic/originality-fingerprint@0.1', url: location.href, at: new Date().toISOString() };

  // section order: top-level semantic blocks
  const blocks = [...document.querySelectorAll('main > *, body > section, body > header, body > footer, body > nav')];
  fp.section_order = blocks.slice(0, 30).map((b) => {
    const tag = b.tagName.toLowerCase();
    const cls = (b.className && typeof b.className === 'string') ? b.className.split(/\s+/).slice(0, 2).join('.') : '';
    const h = b.querySelector('h1,h2,h3');
    return `${tag}${cls ? '.' + cls : ''}${h ? '>' + h.tagName.toLowerCase() : ''}`;
  });

  // layout signature: grid/flex usage pattern of top blocks
  fp.layout_sig = blocks.slice(0, 20).map((b) => {
    const cs = getComputedStyle(b);
    return cs.display === 'grid' ? `grid:${cs.gridTemplateColumns.split(' ').length}c` : cs.display === 'flex' ? `flex:${cs.flexDirection}` : cs.display;
  });

  // typographic composition: font families + size histogram
  const fonts = {};
  const sizes = {};
  document.querySelectorAll('h1,h2,h3,h4,p,a,li,span,button').forEach((e) => {
    const cs = getComputedStyle(e);
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    fonts[fam] = (fonts[fam] || 0) + 1;
    const s = Math.round(parseFloat(cs.fontSize));
    sizes[s] = (sizes[s] || 0) + 1;
  });
  fp.font_families = Object.fromEntries(Object.entries(fonts).sort((a, b) => b[1] - a[1]).slice(0, 6));
  fp.font_size_histogram = Object.fromEntries(Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 10));

  // color roles
  const colors = {};
  document.querySelectorAll('body *').forEach((e) => {
    const cs = getComputedStyle(e);
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') colors['bg:' + cs.backgroundColor] = (colors['bg:' + cs.backgroundColor] || 0) + 1;
    if (cs.color) colors['fg:' + cs.color] = (colors['fg:' + cs.color] || 0) + 1;
  });
  fp.color_roles = Object.fromEntries(Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 12));

  // distinctive interactions: kinetic ids + event-heavy elements
  fp.kinetic_ids = [...new Set([...document.querySelectorAll('[data-kinetic]')].map((e) => e.getAttribute('data-kinetic')))].sort();
  fp.canvas_count = document.querySelectorAll('canvas').length;
  fp.video_count = document.querySelectorAll('video').length;

  // asset reuse: image src hosts
  fp.image_hosts = [...new Set([...document.images].map((i) => { try { return new URL(i.src).host; } catch { return 'inline'; } }))].slice(0, 10);

  // text similarity corpus: visible headings (for copy similarity)
  fp.headings = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.textContent.trim().toLowerCase()).filter(Boolean).slice(0, 20);

  return JSON.stringify(fp);
})()
