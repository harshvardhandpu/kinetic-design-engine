#!/usr/bin/env node
/* Generates registry manifests from primitive meta (single source of truth).
 * Usage: node engine/cli/gen-manifests.mjs
 */
import { readdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const primDir = join(root, 'core', 'primitives');
const itemsDir = join(root, 'registry', 'items');

const files = (await readdir(primDir)).filter((f) => f.endsWith('.js'));
const items = [];

for (const f of files) {
  const mod = await import(pathToFileURL(join(primDir, f)).href);
  const meta = mod.meta;
  const src = await readFile(join(primDir, f), 'utf8');
  const manifest = {
    schema: 'kinetic/primitive-manifest@0.1',
    id: meta.id,
    version: meta.version,
    name: meta.id.replace('kinetic.', ''),
    family: meta.family,
    k_level: meta.k_level,
    p_class: meta.p_class,
    description: src.split('\n')[0].replace(/^\/\*\s*kinetic primitive:\s*/i, '').trim() || meta.id,
    files: [{ path: `core/primitives/${f}`, sha256: createHash('sha256').update(src).digest('hex') }],
    exports: ['meta', 'mount'],
    handle_contract: ['play', 'pause', 'seek', 'progress', 'state', 'destroy'],
    a11y: {
      reduced_motion: 'final-state-immediate',
      keyboard: meta.family === 'hover' ? 'focus-triggers-state' : 'not-applicable',
      aria: 'decorative-marked-aria-hidden',
    },
    tokens_consumed: [...src.matchAll(/tokens\['([^']+)'\]/g)].map((m) => m[1]),
    evidence: src.match(/Evidence: ([^\n]+)/)?.[1]?.trim() ?? 'unrecorded',
    framework: 'vanilla-esm',
    dependencies: [],
  };
  await writeFile(join(itemsDir, `${meta.id}.json`), JSON.stringify(manifest, null, 2));
  items.push({ id: meta.id, version: meta.version, family: meta.family, k_level: meta.k_level, p_class: meta.p_class, manifest: `items/${meta.id}.json` });
  console.log('manifest:', meta.id, `(${manifest.files[0].sha256.slice(0, 12)}…)`);
}

const registry = {
  schema: 'kinetic/registry@0.1',
  name: 'kinetic',
  version: '0.2.0-phase2',
  generated: new Date().toISOString(),
  items,
};
await writeFile(join(root, 'registry', 'registry.json'), JSON.stringify(registry, null, 2));
console.log(`registry.json: ${items.length} items`);
