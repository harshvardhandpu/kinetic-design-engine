#!/usr/bin/env node
/* Originality comparison (Amendment E): reference-distance between two fingerprints.
 * Usage: node engine/evaluator/originality-compare.mjs --ref <fp.json> --candidate <fp.json>
 * Outputs per-dimension similarity + verdict. V0 exemption is enforced by the runner, not here.
 */
import { readFile } from 'node:fs/promises';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, c, i, arr) => {
  if (c.startsWith('--')) a.push([c.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]]);
  return a;
}, []));
const ref = JSON.parse(await readFile(args.ref, 'utf8'));
const cand = JSON.parse(await readFile(args.candidate, 'utf8'));

const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
};
const seqSim = (a, b) => {
  // order-sensitive: LCS ratio
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[m][n] / Math.max(m, n);
};
const histSim = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) { const x = a[k] || 0, y = b[k] || 0; dot += x * y; na += x * x; nb += y * y; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const dims = {
  section_order_similarity: +seqSim(ref.section_order, cand.section_order).toFixed(3),
  layout_similarity: +seqSim(ref.layout_sig, cand.layout_sig).toFixed(3),
  typographic_similarity: +histSim(ref.font_size_histogram, cand.font_size_histogram).toFixed(3),
  font_family_overlap: +jaccard(Object.keys(ref.font_families), Object.keys(cand.font_families)).toFixed(3),
  color_role_overlap: +jaccard(Object.keys(ref.color_roles), Object.keys(cand.color_roles)).toFixed(3),
  copy_similarity: +seqSim(ref.headings, cand.headings).toFixed(3),
  interaction_overlap: +jaccard(ref.kinetic_ids, cand.kinetic_ids).toFixed(3),
  asset_reuse: +jaccard(ref.image_hosts, cand.image_hosts).toFixed(3),
};

// weighted distance → verdict
const weights = { section_order_similarity: 0.2, layout_similarity: 0.2, typographic_similarity: 0.15, font_family_overlap: 0.1, color_role_overlap: 0.1, copy_similarity: 0.15, interaction_overlap: 0.05, asset_reuse: 0.05 };
const score = Object.entries(weights).reduce((s, [k, w]) => s + w * dims[k], 0);
const verdict = score > 0.75 ? 'FAIL-materially-reproduces-reference' : score > 0.5 ? 'WARN-review-required' : 'PASS-distinct';

console.log(JSON.stringify({ schema: 'kinetic/originality-report@0.1', ref: ref.url, candidate: cand.url, dimensions: dims, weighted_similarity: +score.toFixed(3), verdict, note: 'V0 fidelity studies are exempt (doc 36); V1+ must PASS or get explicit human waiver.' }, null, 2));
