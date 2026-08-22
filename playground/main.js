/* KINETIC playground — pre-existing behavior (regression baseline).
 * These behaviors must survive every visual transformation (Test 4). */

// theme toggle (both pages)
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
  const apply = (dark) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    themeBtn.setAttribute('aria-pressed', String(dark));
  };
  apply(false);
  themeBtn.addEventListener('click', () => {
    apply(document.documentElement.dataset.theme !== 'dark');
  });
}

// monitor: counter
const inc = document.getElementById('counter-inc');
const counterOut = document.getElementById('counter-out');
if (inc && counterOut) {
  let n = 0;
  inc.addEventListener('click', () => { counterOut.textContent = String(++n); });
}

// monitor: input echo
const echoIn = document.getElementById('echo-in');
const echoOut = document.getElementById('echo-out');
if (echoIn && echoOut) {
  echoIn.addEventListener('input', () => { echoOut.textContent = echoIn.value.toUpperCase(); });
}

// monitor: flag toggle
const flagIn = document.getElementById('flag-in');
const flagOut = document.getElementById('flag-out');
if (flagIn && flagOut) {
  flagIn.addEventListener('change', () => { flagOut.textContent = flagIn.checked ? 'on' : 'off'; });
}

// expose a stable API for regression checks
window.__PG_BASELINE__ = { version: 1, features: ['theme-toggle', 'counter', 'echo', 'flag'] };

// ---- KINETIC bootstrap (installed by engine/cli/install.mjs) ----
// Mounts installed recipes onto their declared targets. Each mounted element
// gets data-kinetic + data-kinetic-version for traceability (Test 2).
async function kineticBootstrap() {
  const handles = [];
  const receipt = await fetch('.kinetic/installed.json').then((r) => r.json()).catch(() => null);
  if (!receipt) return handles;
  let tokens = {};
  try { tokens = await fetch('.kinetic/tokens.json').then((r) => r.json()); } catch {}

  for (const item of receipt.items) {
    if (item.kind !== 'recipe') continue;
    const recipe = await fetch(item.recipe_file).then((r) => r.json());
    for (const p of recipe.primitives) {
      const mod = await import(`./kinetic/core/primitives/${p.id.replace('kinetic.', '')}.js`);
      const els = [...document.querySelectorAll(p.target)];
      for (const el of els) {
        try { handles.push(mod.mount(el, { ...(p.opts || {}), tokens })); }
        catch (e) { console.error('[kinetic] mount failed', p.id, e); }
      }
    }
  }
  window.__KINETIC_HANDLES__ = handles;
  return handles;
}
kineticBootstrap();
