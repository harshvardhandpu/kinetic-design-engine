#!/usr/bin/env node
/* KINETIC resolver — SOURCE RESOLUTION stage.
 * Maps a feedback target (kinetic id | css selector | role) to:
 *   rendered element -> kinetic id -> receipt -> component -> source file:range
 * Usage: node engine/cli/resolve.mjs --target <dir> --query "kinetic.reveal-stagger" [--selector "[data-kinetic]"]
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, c, i, arr) => {
  if (c.startsWith('--')) a.push([c.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]]);
  return a;
}, []));
const target = args.target;
const query = String(args.query || '');
if (!target || !query) { console.error('usage: resolve.mjs --target <dir> --query <kinetic-id|selector>'); process.exit(2); }

// 1. receipt lookup
let receipt = null;
try { receipt = JSON.parse(await readFile(join(target, '.kinetic', 'installed.json'), 'utf8')); } catch {}

const resolution = {
  schema: 'kinetic/resolution@0.1',
  query,
  kinetic_id: null,
  receipt_entry: null,
  component_files: [],
  source_refs: [],
  confidence: 'none',
};

if (receipt) {
  // direct item match
  let entry = receipt.items.find((i) => i.id === query || i.id.includes(query));
  let via_recipe = null;
  if (!entry) {
    // traverse recipes: a primitive installed via recipe is receipt-backed through the recipe entry
    for (const item of receipt.items.filter((i) => i.kind === 'recipe')) {
      try {
        const recipe = JSON.parse(await readFile(join(target, item.recipe_file), 'utf8'));
        const p = recipe.primitives.find((pp) => pp.id === query || pp.id.includes(query));
        if (p) { entry = item; via_recipe = { recipe_id: item.id, primitive: p.id, target_selector: p.target }; break; }
      } catch {}
    }
  }
  if (entry) {
    resolution.kinetic_id = query.includes('kinetic.') ? (via_recipe ? via_recipe.primitive : entry.id) : entry.id;
    resolution.receipt_entry = { kind: entry.kind, version: entry.version, files: entry.files, via_recipe };
    resolution.component_files = entry.files.map((f) => join(target, f.path));
    resolution.confidence = 'high'; // receipt-backed
  }
}

// 2. grep source for usage sites (file:line)
const SKIP = new Set(['node_modules', '.git', 'dist', '.kinetic']);
async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (['.html', '.js', '.jsx', '.mjs', '.css', '.ts', '.tsx', '.svelte', '.vue'].includes(extname(e.name))) yield p;
  }
}
const needle = resolution.kinetic_id || query;
for await (const f of walk(target)) {
  const lines = (await readFile(f, 'utf8')).split('\n');
  lines.forEach((ln, i) => {
    if (ln.includes(needle)) resolution.source_refs.push({ file: f, line: i + 1, snippet: ln.trim().slice(0, 120) });
  });
}
if (resolution.confidence === 'none' && resolution.source_refs.length) resolution.confidence = 'medium'; // grep-only, no receipt

console.log(JSON.stringify(resolution, null, 2));
