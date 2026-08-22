#!/usr/bin/env node
/* KINETIC installer — copies registry items into a target project, wires a
 * bootstrap, and writes the install receipt (.kinetic/installed.json).
 * Copy-source model (Phase 1 P14): project owns the result.
 *
 * Usage:
 *   node engine/cli/install.mjs --target <dir> --items kinetic.reveal-stagger,kinetic.recipe.hero-cinematic [--tokens k=v,...]
 */
import { readdir, readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, c, i, arr) => {
  if (c.startsWith('--')) a.push([c.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]]);
  return a;
}, []));

const target = args.target;
const items = String(args.items || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!target || !items.length) { console.error('usage: install.mjs --target <dir> --items id1,id2'); process.exit(2); }

const registry = JSON.parse(await readFile(join(root, 'registry', 'registry.json'), 'utf8'));
const recipesDir = join(root, 'recipes');
const installed = {
  schema: 'kinetic/installed-receipt@0.1',
  kinetic_version: registry.version,
  installed_at: new Date().toISOString(),
  target,
  items: [],
};

const kinDir = join(target, '.kinetic');
const libDir = join(target, 'kinetic');
await mkdir(kinDir, { recursive: true });
await mkdir(libDir, { recursive: true });

const sha = (b) => createHash('sha256').update(b).digest('hex');

for (const id of items) {
  // recipe?
  const recipeName = id.replace('kinetic.recipe.', '');
  let recipePath = null;
  try {
    const st = await stat(join(recipesDir, `${recipeName}.json`));
    if (st.isFile()) recipePath = join(recipesDir, `${recipeName}.json`);
  } catch {}

  if (recipePath) {
    const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
    const files = [];
    // install each primitive the recipe uses
    for (const p of recipe.primitives) {
      const reg = registry.items.find((i) => i.id === p.id);
      if (!reg) throw new Error(`recipe ${id} needs unregistered primitive ${p.id}`);
      const mf = JSON.parse(await readFile(join(root, 'registry', reg.manifest), 'utf8'));
      for (const f of mf.files) {
        const srcP = join(root, '..', f.path.startsWith('core/') ? join('engine', f.path) : f.path);
        const dstP = join(libDir, f.path);
        await mkdir(dirname(dstP), { recursive: true });
        await copyFile(srcP, dstP);
        const bytes = await readFile(dstP);
        files.push({ path: relative(target, dstP), sha256: sha(bytes), source_sha256: f.sha256, verified: sha(bytes) === f.sha256 });
      }
    }
    const recipeDst = join(libDir, 'recipes', `${recipeName}.json`);
    await mkdir(dirname(recipeDst), { recursive: true });
    await writeFile(recipeDst, JSON.stringify(recipe, null, 2));
    installed.items.push({ kind: 'recipe', id, version: recipe.version, files, recipe_file: relative(target, recipeDst), targets: recipe.primitives.map((p) => ({ primitive: p.id, target: p.target, opts: p.opts })) });
    console.log(`installed recipe ${id} (${files.length} primitive files)`);
    continue;
  }

  // primitive?
  const reg = registry.items.find((i) => i.id === id);
  if (!reg) throw new Error(`unknown item: ${id}`);
  const mf = JSON.parse(await readFile(join(root, reg.manifest), 'utf8'));
  const files = [];
  for (const f of mf.files) {
    const srcP = join(root, '..', join('engine', f.path));
    const dstP = join(libDir, f.path);
    await mkdir(dirname(dstP), { recursive: true });
    await copyFile(srcP, dstP);
    const bytes = await readFile(dstP);
    files.push({ path: relative(target, dstP), sha256: sha(bytes), source_sha256: f.sha256, verified: sha(bytes) === f.sha256 });
  }
  installed.items.push({ kind: 'primitive', id, version: reg.version, files });
  console.log(`installed primitive ${id}`);
}

// tokens
if (args.tokens && args.tokens !== true) {
  const tokens = Object.fromEntries(String(args.tokens).split(',').map((kv) => kv.split('=')));
  await writeFile(join(kinDir, 'tokens.json'), JSON.stringify(tokens, null, 2));
  installed.tokens = tokens;
}

await writeFile(join(kinDir, 'installed.json'), JSON.stringify(installed, null, 2));
console.log(`receipt: ${join(kinDir, 'installed.json')} (${installed.items.length} items)`);
