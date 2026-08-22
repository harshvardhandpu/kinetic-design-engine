#!/usr/bin/env node
/* KINETIC project scanner — SCAN + CLASSIFY stages.
 * Detects framework, kinetic-installed items, surfaces, design tokens.
 * Usage: node engine/cli/scan.mjs --target <dir> [--out <file>]
 */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, c, i, arr) => {
  if (c.startsWith('--')) a.push([c.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]]);
  return a;
}, []));
const target = args.target;
if (!target) { console.error('usage: scan.mjs --target <dir>'); process.exit(2); }

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.kinetic', '.next', 'coverage']);
const found = { files: [], kinetic_ids: new Set(), frameworks: new Set(), html_files: [], css_files: [], js_files: [] };

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { await walk(p); continue; }
    const ext = extname(e.name);
    found.files.push(p);
    if (ext === '.html') found.html_files.push(p);
    if (ext === '.css') found.css_files.push(p);
    if (['.js', '.jsx', '.mjs', '.ts', '.tsx', '.svelte', '.vue'].includes(ext)) found.js_files.push(p);
  }
}
await walk(target);

// framework detection from package.json
try {
  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [k, fw] of [['react', 'react'], ['svelte', 'svelte'], ['vue', 'vue'], ['next', 'next'], ['vite', 'vite'], ['astro', 'astro']]) {
    if (deps[k]) found.frameworks.add(fw);
  }
  found.package_name = pkg.name;
} catch {}

// kinetic id detection in source
for (const f of [...found.html_files, ...found.js_files]) {
  const src = await readFile(f, 'utf8');
  for (const m of src.matchAll(/data-kinetic=["']([^"']+)["']/g)) found.kinetic_ids.add(m[1]);
  for (const m of src.matchAll(/kinetic\.(recipe\.)?[a-z-]+/g)) found.kinetic_ids.add(m[0]);
}

// installed receipt
let receipt = null;
try { receipt = JSON.parse(await readFile(join(target, '.kinetic', 'installed.json'), 'utf8')); } catch {}

// surface classification heuristic (Phase-1 taxonomy, simplified)
const surfaces = [];
const allSrc = (await Promise.all(found.html_files.slice(0, 20).map((f) => readFile(f, 'utf8')))).join('\n');
if (/hero|landing/i.test(allSrc)) surfaces.push('landing');
if (/dashboard|metrics|admin/i.test(allSrc)) surfaces.push('monitor');
if (/product|pricing|features/i.test(allSrc)) surfaces.push('product');
if (/portfolio|works|gallery/i.test(allSrc)) surfaces.push('portfolio');
if (/article|blog|editorial/i.test(allSrc)) surfaces.push('editorial');

// design tokens: css custom properties
const tokens = {};
for (const f of found.css_files.slice(0, 20)) {
  const src = await readFile(f, 'utf8');
  for (const m of src.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) tokens[`--${m[1]}`] = m[2].trim();
}

const report = {
  schema: 'kinetic/scan-report@0.1',
  scanned_at: new Date().toISOString(),
  target,
  framework: [...found.frameworks],
  package_name: found.package_name ?? null,
  file_counts: { html: found.html_files.length, css: found.css_files.length, js: found.js_files.length, total: found.files.length },
  kinetic_installed: receipt ? receipt.items.map((i) => ({ id: i.id, version: i.version, kind: i.kind })) : [],
  kinetic_ids_in_source: [...found.kinetic_ids],
  surfaces,
  css_custom_properties: Object.keys(tokens).length,
  tokens_sample: Object.fromEntries(Object.entries(tokens).slice(0, 30)),
};
const out = args.out && args.out !== true ? args.out : null;
if (out) await writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
