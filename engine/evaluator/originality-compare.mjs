#!/usr/bin/env node
/* Originality comparison (Amendment E): reference-distance between two fingerprints.
 * Usage: node engine/evaluator/originality-compare.mjs --ref <fp.json> --candidate <fp.json>
 * Outputs structural and visual similarity separately. V0 exemption remains runner-owned.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
};

const seqSim = (a, b) => {
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
  for (const key of keys) {
    const x = a[key] || 0, y = b[key] || 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const popcount = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function perceptualHashSimilarity(reference = {}, candidate = {}) {
  const keys = Object.keys(reference).filter((key) => key in candidate).sort();
  if (keys.length === 0) return null;
  const similarities = keys.map((key) => {
    const a = reference[key], b = candidate[key];
    if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) {
      throw Object.assign(new Error(`invalid 16x16 perceptual hash at ${key}`), { code: 'KINETIC_PHASH_INVALID' });
    }
    let distance = 0;
    for (let index = 0; index < 64; index++) distance += popcount[Number.parseInt(a[index], 16) ^ Number.parseInt(b[index], 16)];
    return 1 - distance / 256;
  });
  return +(similarities.reduce((sum, value) => sum + value, 0) / similarities.length).toFixed(3);
}

export function compareOriginality(ref, cand) {
  const dimensions = {
    section_order_similarity: +seqSim(ref.section_order, cand.section_order).toFixed(3),
    layout_similarity: +seqSim(ref.layout_sig, cand.layout_sig).toFixed(3),
    typographic_similarity: +histSim(ref.font_size_histogram, cand.font_size_histogram).toFixed(3),
    font_family_overlap: +jaccard(Object.keys(ref.font_families), Object.keys(cand.font_families)).toFixed(3),
    color_role_overlap: +jaccard(Object.keys(ref.color_roles), Object.keys(cand.color_roles)).toFixed(3),
    copy_similarity: +seqSim(ref.headings, cand.headings).toFixed(3),
    interaction_overlap: +jaccard(ref.kinetic_ids, cand.kinetic_ids).toFixed(3),
    asset_reuse: +jaccard(ref.image_hosts, cand.image_hosts).toFixed(3),
  };
  const weights = { section_order_similarity: 0.2, layout_similarity: 0.2, typographic_similarity: 0.15, font_family_overlap: 0.1, color_role_overlap: 0.1, copy_similarity: 0.15, interaction_overlap: 0.05, asset_reuse: 0.05 };
  const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + weight * dimensions[key], 0);
  return {
    schema: 'kinetic/originality-report@0.1',
    ref: ref.url,
    candidate: cand.url,
    dimensions,
    weighted_similarity: +score.toFixed(3),
    visual_fingerprint_similarity: perceptualHashSimilarity(ref.visual_phashes, cand.visual_phashes),
    verdict: score > 0.75 ? 'FAIL-materially-reproduces-reference' : score > 0.5 ? 'WARN-review-required' : 'PASS-distinct',
    note: 'V0 fidelity studies are exempt (doc 36); V1+ must PASS or get explicit human waiver.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((values, current, index, all) => {
    if (current.startsWith('--')) values.push([current.slice(2), all[index + 1]?.startsWith('--') ? true : all[index + 1]]);
    return values;
  }, []));
  const ref = JSON.parse(await readFile(args.ref, 'utf8'));
  const candidate = JSON.parse(await readFile(args.candidate, 'utf8'));
  console.log(JSON.stringify(compareOriginality(ref, candidate), null, 2));
}
