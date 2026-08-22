#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultOutput = join(root, 'gym', 'exports', 'obsidian');
const derivedHeader = 'DERIVED — REGENERATE FROM KINETIC REPOSITORY';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function inside(path, base) {
  const local = relative(base, path);
  return local === '' || (local !== '..' && !local.startsWith(`..${sep}`));
}

async function sourceFiles() {
  const registry = join(root, 'gym', 'knowledge', 'sources', 'registry.json');
  const casesDir = join(root, 'gym', 'corpus', 'cases');
  const cases = (await readdir(casesDir)).filter((name) => name.endsWith('.json')).sort().map((name) => join(casesDir, name));
  return [registry, ...cases];
}

export async function generateMirror({ outputRoot = defaultOutput } = {}) {
  const output = resolve(outputRoot);
  const gymOutput = join(resolve(process.env.KINETIC_GYM_ROOT || join(root, 'gym')), 'exports', 'obsidian');
  if (![defaultOutput, gymOutput].some((base) => inside(output, resolve(base)))) {
    throw Object.assign(new Error('mirror output must remain in project-local Obsidian export staging'), { code: 'KINETIC_OBSIDIAN_OUTPUT_FORBIDDEN' });
  }

  const files = await sourceFiles();
  const sources = await Promise.all(files.map(async (path) => {
    const bytes = await readFile(path);
    return { path: relative(root, path).split(sep).join('/'), sha256: sha256(bytes) };
  }));
  const registry = JSON.parse(await readFile(files[0], 'utf8'));
  const cases = await Promise.all(files.slice(1).map(async (path) => JSON.parse(await readFile(path, 'utf8'))));
  const notes = [
    {
      path: '04-Sources/KINETIC Source Registry.md',
      content: `${derivedHeader}\n\n# KINETIC Source Registry\n\nRegistry version: ${registry.registry_version}\n\n${registry.sources.map((source) => `- ${source.source_id} — ${source.title} — ${source.rights_status} — ${source.canonical_url}`).join('\n')}\n`,
    },
    {
      path: '01-Projects/KINETIC/Design Cases.md',
      content: `${derivedHeader}\n\n# KINETIC Design Cases\n\n${cases.map((designCase) => `- ${designCase.case_id} — ${designCase.title} — ${designCase.status}`).join('\n')}\n`,
    },
    {
      path: '05-Decisions/KINETIC Authority Boundary.md',
      content: `${derivedHeader}\n\n# KINETIC Authority Boundary\n\nThe KINETIC repository is authoritative for schemas, source rights, receipts, DesignCases, runs, tests, and build provenance. This mirror is read-side design memory and cannot upgrade rights.\n`,
    },
  ];

  await rm(output, { recursive: true, force: true });
  for (const note of notes) {
    const path = join(output, note.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, note.content);
    note.sha256 = sha256(note.content);
  }
  const manifest = {
    schema: 'kinetic/obsidian-mirror-manifest@0.1',
    derived: true,
    authority: 'KINETIC_REPOSITORY',
    sources,
    generated_notes: notes.map(({ path, sha256: hash }) => ({ path, sha256: hash })),
  };
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(join(output, 'GENERATED.sha256'), `${manifest.generated_notes.map(({ path, sha256: hash }) => `${hash}  ${path}`).join('\n')}\n`);
  const applyScript = `#!/bin/sh
set -eu
DEST=\${1:-}
case "$DEST" in */HermesVault) ;; *) echo "Refusing destination: expected a HermesVault root" >&2; exit 2;; esac
[ -d "$DEST/.obsidian" ] || { echo "Refusing destination without .obsidian" >&2; exit 2; }
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
(cd "$HERE" && sha256sum -c GENERATED.sha256)
for dir in 01-Projects 04-Sources 05-Decisions; do
  [ ! -d "$HERE/$dir" ] || { mkdir -p "$DEST/$dir"; cp -R "$HERE/$dir/." "$DEST/$dir/"; }
done
`;
  await writeFile(join(output, 'APPLY_TO_VAULT.sh'), applyScript);
  await chmod(join(output, 'APPLY_TO_VAULT.sh'), 0o755);
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await generateMirror(), null, 2));
}
