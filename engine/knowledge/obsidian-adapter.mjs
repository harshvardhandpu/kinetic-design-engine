import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tokenize } from './retrieval.mjs';

const DEFAULT_ROOT = '/knowledge/HermesVault';
const ROOT_ALLOWLIST = [
  '01-Projects/KINETIC',
  '02-Research/Design',
  '03-Concepts',
  '04-Sources',
  '05-Decisions',
];
const TRUST_LEVELS = new Set([
  'ACCEPTED_DECISION',
  'CANONICAL_CONCEPT',
  'VERIFIED_SOURCE_SYNTHESIS',
  'UNVERIFIED_NOTE',
]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function parseNote(bytes) {
  let body = bytes;
  const metadata = {};
  if (bytes.startsWith('---\n')) {
    const end = bytes.indexOf('\n---\n', 4);
    if (end !== -1) {
      for (const line of bytes.slice(4, end).split('\n')) {
        const split = line.indexOf(':');
        if (split === -1) continue;
        metadata[line.slice(0, split).trim()] = line.slice(split + 1).trim().replace(/^['"]|['"]$/g, '');
      }
      body = bytes.slice(end + 5);
    }
  }
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
  return { body, metadata, title };
}

async function markdownFiles(directory) {
  const rows = [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return rows;
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) rows.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) rows.push(path);
  }
  return rows;
}

function excerpt(body, queryTokens, maxChars) {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const relevant = lines.filter((line) => {
    const lineTokens = tokenize(line);
    return queryTokens.some((token) => lineTokens.includes(token));
  });
  return (relevant.length ? relevant : lines.slice(0, 1)).join('\n').slice(0, maxChars);
}

export async function searchVault({
  query,
  root = process.env.KINETIC_OBSIDIAN_ROOT || DEFAULT_ROOT,
  allowedRoots = ROOT_ALLOWLIST,
  limit = 5,
  excerptChars = 1200,
} = {}) {
  try { await readdir(root); }
  catch (error) {
    return { availability: 'unavailable', notes: [], reason: `vault root unavailable (${error.code ?? 'ERROR'})` };
  }

  const queryText = String(query ?? '');
  const queryTokens = tokenize(queryText);
  const roots = [...new Set(allowedRoots)].filter((path) => ROOT_ALLOWLIST.includes(path)).sort();
  const files = (await Promise.all(roots.map((path) => markdownFiles(join(root, path))))).flat();
  const ranked = [];
  for (const path of files) {
    let bytes;
    try { bytes = await readFile(path, 'utf8'); } catch { continue; }
    const { body, metadata, title } = parseNote(bytes);
    const notePath = relative(root, path).split('\\').join('/');
    const sourceId = /^src-[a-z0-9-]+$/.test(metadata.kinetic_source_id ?? '') ? metadata.kinetic_source_id : null;
    const trustLevel = TRUST_LEVELS.has(metadata.trust_level) ? metadata.trust_level : 'UNVERIFIED_NOTE';
    const pathTokens = tokenize(`${notePath} ${title}`);
    const bodyTokens = tokenize(body);
    const exactSource = sourceId !== null && queryText.toLowerCase().includes(sourceId);
    const pathMatches = queryTokens.filter((token) => pathTokens.includes(token)).length;
    const bodyMatches = queryTokens.filter((token) => bodyTokens.includes(token)).length;
    if (!exactSource && pathMatches === 0 && bodyMatches === 0) continue;
    const used = excerpt(body, queryTokens, Math.min(Math.max(1, excerptChars), 1200));
    if (!used) continue;
    ranked.push({
      rank: [exactSource ? 1 : 0, trustLevel === 'ACCEPTED_DECISION' ? 1 : 0, pathMatches, bodyMatches],
      row: {
        note_path: notePath,
        kinetic_source_id: sourceId,
        reason_retrieved: exactSource ? `exact kinetic_source_id match: ${sourceId}` : `lexical query match: ${queryTokens.join(', ')}`,
        knowledge_used: [used],
        trust_level: trustLevel,
        content_sha256: sha256(bytes),
      },
    });
  }
  ranked.sort((a, b) => {
    for (let index = 0; index < a.rank.length; index += 1) {
      if (a.rank[index] !== b.rank[index]) return b.rank[index] - a.rank[index];
    }
    return a.row.note_path.localeCompare(b.row.note_path);
  });
  return { availability: 'available', notes: ranked.slice(0, Math.min(Math.max(0, limit), 5)).map(({ row }) => row) };
}

export { ROOT_ALLOWLIST };
