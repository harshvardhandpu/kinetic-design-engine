import { lstat, readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs']);
const EXCLUDED_DIRECTORIES = new Set(['node_modules', '.kinetic', 'vendor', 'vendors']);
const GENERATED_FILE = /(?:\.min\.(?:js|css)$|\.map$|(?:^|[-_.])generated(?:[-_.]|$))/i;
const MOTION_SOURCE = /\b(?:transition|animation|animate|duration|delay|stagger|easing|distance|spring|parallax|requestAnimationFrame)\b|--kinetic-|tokens\s*\[/i;
const TOKEN_REFERENCE = /var\(\s*--kinetic-([0-9a-z-]+)\s*\)|tokens\s*\[\s*['"]([0-9a-z.-]+)['"]\s*\]/gi;
const RAW_EASING = /cubic-bezier\([^)]*\)|\bease(?:-in-out|-in|-out)?\b|\blinear\b/i;
const EXCEPTION_KEYS = ['file', 'line_or_symbol', 'property', 'raw_value', 'reason', 'evidence_ref', 'scope'];
const WILDCARD = /[*?\[\]]/;
const AESTHETIC_REASON = /\b(?:aesthetic|beautiful|prettier|looks?\s+better|design\s+choice|feels?\s+(?:better|nicer)|visually\s+pleasing|vibes?|desirab(?:le|ility))\b/i;
const TECHNICAL_REASON = /^\s*(?:cited\s+)?(?:source\s+(?:clip|recording|capture)|capture|benchmark|measurement|trace|test)\s+(?:requires?|shows?|demonstrates?|establishes?)\s+([a-z -]+?)[.!]?\s*$/i;
const TECHNICAL_WORDS = new Set(['measured', 'measurement', 'timing', 'synchronization', 'synchronized', 'frame', 'frames', 'millisecond', 'milliseconds', 'latency', 'velocity', 'physics', 'accessibility', 'reduced', 'motion', 'constraint', 'constraints']);

function stripComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (comment, prefix) => prefix + ' '.repeat(comment.length - prefix.length));
}

function balancedBlockBoundsAfter(source, start) {
  const open = source.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  let quote = null;
  for (let index = open; index < source.length; index += 1) {
    if (quote) {
      if (source[index] === quote && source[index - 1] !== '\\') quote = null;
      continue;
    }
    if (source[index] === '"' || source[index] === "'") { quote = source[index]; continue; }
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return { open, close: index };
  }
  return null;
}

function balancedBlockAfter(source, start) {
  const bounds = balancedBlockBoundsAfter(source, start);
  return bounds ? source.slice(bounds.open + 1, bounds.close) : null;
}

function hasReducedMotionBehavior(source) {
  const disablesMotion = (body) => body && /(?:transition|animation)(?:-(?:duration|delay))?\s*:\s*(?:none|0(?:ms|s)?|1ms)\b|transform\s*:\s*none\b|scroll-behavior\s*:\s*auto\b|\b(?:return|cancel|finish|pause)\b|\b(?:duration|delay|stagger)\s*[:=]\s*0\b|\.style\.(?:transition|animation)\s*=\s*['"]none['"]/i.test(body);
  for (const match of source.matchAll(/@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce[^)]*\)/gi)) {
    if (disablesMotion(balancedBlockAfter(source, match.index + match[0].length))) return true;
  }
  const queryVariables = new Set([...source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:window\.)?matchMedia\s*\(\s*['"]\(prefers-reduced-motion:\s*reduce\)['"]\s*\)/gi)].map((match) => match[1]));
  for (const match of source.matchAll(/if\s*\(\s*([A-Za-z_$][\w$]*)\.matches\s*\)/g)) {
    if (queryVariables.has(match[1]) && disablesMotion(balancedBlockAfter(source, match.index + match[0].length))) return true;
  }
  for (const match of source.matchAll(/if\s*\(\s*(?:window\.)?matchMedia\s*\(\s*['"]\(prefers-reduced-motion:\s*reduce\)['"]\s*\)\.matches\s*\)/gi)) {
    if (disablesMotion(balancedBlockAfter(source, match.index + match[0].length))) return true;
  }
  return false;
}

function catalogReferences(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)
    || !catalog.tokens || typeof catalog.tokens !== 'object' || Array.isArray(catalog.tokens)
    || !catalog.aliases || typeof catalog.aliases !== 'object' || Array.isArray(catalog.aliases)
    || !catalog.evidence_tags || typeof catalog.evidence_tags !== 'object' || Array.isArray(catalog.evidence_tags)) {
    throw Object.assign(new Error('motion token catalog is malformed'), { code: 'KINETIC_MOTION_CATALOG_INVALID' });
  }
  const tokens = new Set(Object.keys(catalog.tokens));
  if (tokens.size === 0) throw Object.assign(new Error('motion token catalog is empty'), { code: 'KINETIC_MOTION_CATALOG_INVALID' });
  for (const token of Object.values(catalog.tokens)) {
    if (!token || typeof token !== 'object' || !Object.hasOwn(catalog.evidence_tags, token.evidence_tag)) {
      throw Object.assign(new Error('motion token evidence tag is unresolved'), { code: 'KINETIC_MOTION_CATALOG_INVALID' });
    }
  }
  const references = new Set(tokens);
  for (const [alias, target] of Object.entries(catalog.aliases)) {
    if (!tokens.has(target)) throw Object.assign(new Error(`motion token alias target is unresolved: ${alias}`), { code: 'KINETIC_MOTION_CATALOG_INVALID' });
    references.add(alias);
    references.add(alias.replaceAll('.', '-'));
  }
  return references;
}

async function sourceFiles(root) {
  const files = [];
  async function visit(directory, relativeDirectory = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name) || relativePath === 'kinetic/core') continue;
        await visit(join(directory, entry.name), relativePath);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name)) && !GENERATED_FILE.test(entry.name)) {
        files.push(relativePath);
      }
    }
  }
  await visit(root);
  return files.sort();
}

function addFinding(findings, file, line, property, value, symbol = null) {
  findings.push({ kind: 'unapproved_raw_value', file, line, property, value: String(value).trim(), ...(symbol ? { symbol } : {}) });
}

function scanTokenReferences(findings, file, lineNumber, line, references, symbol = null) {
  for (const match of line.matchAll(TOKEN_REFERENCE)) {
    const name = match[1] ?? match[2];
    if (!references.has(name)) findings.push({
      kind: 'unknown_token_reference', file, line: lineNumber, property: 'token-reference', value: name, ...(symbol ? { symbol } : {}),
    });
  }
}

function isExactTokenReference(value, references) {
  const matches = [...value.matchAll(TOKEN_REFERENCE)];
  return matches.length === 1 && matches[0].index === 0 && matches[0][0].length === value.length
    && references.has(matches[0][1] ?? matches[0][2]);
}

function splitTopLevel(value) {
  const items = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== '\\') quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) { items.push(value.slice(start, index).trim()); start = index + 1; }
  }
  items.push(value.slice(start).trim());
  return items;
}

function adjustedCssToken(value, references) {
  const adjusted = value.match(/calc\((?:[^()]|\([^()]*\))*\)/i)?.[0] ?? null;
  return adjusted && [...adjusted.matchAll(TOKEN_REFERENCE)].some((match) => references.has(match[1] ?? match[2])) ? adjusted : null;
}

function scanCssLine(findings, file, lineNumber, line, animated, references) {
  for (const match of line.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/gi)) {
    const property = match[1].toLowerCase();
    const value = match[2].trim();
    if (/^(?:none|initial|inherit|unset)$/i.test(value)) continue;
    if (/^(?:transition|animation)-(?:duration|delay)$/.test(property)) {
      const kind = property.endsWith('delay') ? 'delay' : 'duration';
      const adjusted = adjustedCssToken(value, references);
      if (adjusted) addFinding(findings, file, lineNumber, kind, adjusted);
      else for (const raw of value.matchAll(/-?(?:\d+\.?\d*|\.\d+)\s*(?:ms|s)\b/gi)) addFinding(findings, file, lineNumber, kind, raw[0]);
    } else if (property === 'transition' || property === 'animation') {
      for (const item of splitTopLevel(value)) {
        const adjusted = adjustedCssToken(item, references);
        if (adjusted) addFinding(findings, file, lineNumber, 'duration', adjusted);
        const times = [...item.matchAll(/-?(?:\d+\.?\d*|\.\d+)\s*(?:ms|s)\b/gi)];
        if (times[0]) addFinding(findings, file, lineNumber, 'duration', times[0][0]);
        if (times[1]) addFinding(findings, file, lineNumber, 'delay', times[1][0]);
        const easing = item.match(RAW_EASING);
        if (easing) addFinding(findings, file, lineNumber, 'easing', easing[0]);
      }
    } else if (/^(?:transition|animation)-timing-function$/.test(property)) {
      const easing = value.match(RAW_EASING);
      if (easing) addFinding(findings, file, lineNumber, 'easing', easing[0]);
    } else if (animated && property === 'transform') {
      for (const raw of value.matchAll(/translate(?:3d|x|y|z)?\(\s*(-?(?:\d+\.?\d*|\.\d+))(?:px|%|rem|em|vh|vw)/gi)) {
        if (Number(raw[1]) !== 0) addFinding(findings, file, lineNumber, 'distance', raw[0]);
      }
      for (const raw of value.matchAll(/scale(?:3d|x|y|z)?\(\s*(-?(?:\d+\.?\d*|\.\d+))/gi)) {
        if (Number(raw[1]) !== 1) addFinding(findings, file, lineNumber, 'scale', raw[0]);
      }
      for (const raw of value.matchAll(/rotate(?:3d|x|y|z)?\(\s*(-?(?:\d+\.?\d*|\.\d+))(?:deg|rad|turn)/gi)) {
        if (Number(raw[1]) !== 0) addFinding(findings, file, lineNumber, 'rotation', raw[0]);
      }
    } else if (animated && property === 'opacity') {
      const raw = /^-?(?:\d+\.?\d*|\.\d+)$/.exec(value);
      if (raw && ![0, 1].includes(Number(raw[0]))) addFinding(findings, file, lineNumber, 'opacity', raw[0]);
    }
  }
}

function scanCssSource(findings, file, source, references) {
  const lines = source.split('\n');
  lines.forEach((line, index) => scanTokenReferences(findings, file, index + 1, line, references));

  const stack = [];
  let segmentStart = 0;
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote && source[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{') {
      const header = source.slice(segmentStart, index).trim();
      stack.push({
        header, bodyStart: index + 1,
        inKeyframes: stack.some((frame) => frame.inKeyframes || /^@(?:-[a-z]+-)?keyframes\b/i.test(frame.header)),
      });
      segmentStart = index + 1;
    } else if (char === ';') segmentStart = index + 1;
    else if (char === '}') {
      const frame = stack.pop();
      if (frame && !frame.header.startsWith('@')) {
        const body = source.slice(frame.bodyStart, index);
        const animated = frame.inKeyframes || /(?:^|;)\s*(?:transition|animation)(?:-[a-z-]+)?\s*:/i.test(body);
        const firstLine = source.slice(0, frame.bodyStart).split('\n').length;
        body.split('\n').forEach((line, offset) => scanCssLine(findings, file, firstLine + offset, line, animated, references));
      }
      segmentStart = index + 1;
    }
  }

  if (file.endsWith('.html')) {
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/\bstyle\s*=\s*(["'])(.*?)\1/gi)) {
        const value = match[2];
        scanCssLine(findings, file, index + 1, value, /(?:^|;)\s*(?:transition|animation)(?:-[a-z-]+)?\s*:/i.test(value), references);
      }
    });
  }
}

function scanJsLine(findings, file, lineNumber, line, references, springActive, symbolAt, lineOffset) {
  scanTokenReferences(findings, file, lineNumber, line, references);
  for (const match of line.matchAll(/\b(duration|delay|stagger|easing|distance|opacity|scale)\s*[:=]\s*([^,}\n]+)/gi)) {
    const property = match[1].toLowerCase();
    const raw = match[2].trim().replace(/;$/, '');
    if (isExactTokenReference(raw, references)) continue;
    const number = Number(raw);
    if ((property === 'opacity' || property === 'scale') && Number.isFinite(number) && [0, 1].includes(number)) continue;
    if (property === 'distance' && Number.isFinite(number) && number === 0) continue;
    addFinding(findings, file, lineNumber, property, raw, symbolAt(lineOffset + match.index));
  }
  if (springActive) {
    for (const match of line.matchAll(/\b(mass|stiffness|damping)\s*:\s*(-?(?:\d+\.?\d*|\.\d+))/gi)) {
      addFinding(findings, file, lineNumber, `spring.${match[1].toLowerCase()}`, match[2], symbolAt(lineOffset + match.index));
    }
  }
}

function scanJsSource(findings, file, source, references) {
  const ranges = [];
  for (const match of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) {
    const bounds = balancedBlockBoundsAfter(source, match.index + match[0].length);
    const between = bounds && source.slice(match.index + match[0].length, bounds.open);
    if (bounds && !between.includes(';')) ranges.push({ symbol: match[1] ?? match[2], ...bounds });
  }
  const symbolAt = (offset) => ranges
    .filter(({ open, close }) => open < offset && offset < close)
    .sort((left, right) => right.open - left.open)[0]?.symbol ?? null;
  let springDepth = 0;
  let lineOffset = 0;
  source.split('\n').forEach((line, index) => {
    const startsSpring = /\bspring\s*:/.test(line);
    if (startsSpring && springDepth === 0) springDepth = 1;
    scanJsLine(findings, file, index + 1, line, references, springDepth > 0, symbolAt, lineOffset);
    const delta = (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    if (springDepth > 0) {
      springDepth += delta - (startsSpring ? 1 : 0);
      if (springDepth <= 0) springDepth = 0;
    }
    lineOffset += line.length + 1;
  });
}

function exceptionValues(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (EXCEPTION_KEYS.some((key) => !descriptors[key] || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(EXCEPTION_KEYS.map((key) => [key, descriptors[key].value]));
}

function hasTechnicalJustification(reason) {
  const match = reason.match(TECHNICAL_REASON);
  const words = match?.[1].toLowerCase().replaceAll('-', ' ').split(/\s+/) ?? [];
  return reason.trim().length >= 20 && !AESTHETIC_REASON.test(reason)
    && words.length >= 2 && words.every((word) => TECHNICAL_WORDS.has(word));
}

function normalizeException(value) {
  const fields = exceptionValues(value);
  if (!fields || typeof fields.file !== 'string' || typeof fields.line_or_symbol !== 'string'
    || typeof fields.property !== 'string' || !['string', 'number'].includes(typeof fields.raw_value)
    || typeof fields.reason !== 'string' || typeof fields.evidence_ref !== 'string' || typeof fields.scope !== 'string') return null;
  if ([fields.file, fields.line_or_symbol, fields.property, fields.evidence_ref, fields.scope].some((field) => !field.trim() || WILDCARD.test(field))
    || fields.file.startsWith('/') || fields.file.split('/').includes('..') || fields.file.includes('\\')
    || !hasTechnicalJustification(fields.reason)) return null;
  return { ...fields, file: fields.file.trim(), line_or_symbol: fields.line_or_symbol.trim(), property: fields.property.trim(), reason: fields.reason.trim(), evidence_ref: fields.evidence_ref.trim(), scope: fields.scope.trim() };
}

function applyExceptions(findings, exceptions) {
  const remaining = [...findings];
  const approved = [];
  for (const candidate of exceptions) {
    const exception = normalizeException(candidate);
    const line = exception && /^(?:L)?\d+$/.test(exception.line_or_symbol)
      ? Number(exception.line_or_symbol.replace(/^L/, '')) : null;
    const index = exception ? remaining.findIndex((finding) => finding.kind === 'unapproved_raw_value'
      && finding.file === exception.file && (finding.line === line || finding.symbol === exception.line_or_symbol)
      && finding.property === exception.property && finding.value === String(exception.raw_value).trim()) : -1;
    if (index < 0) {
      const raw = exceptionValues(candidate);
      remaining.push({
        kind: 'invalid_exception', file: typeof raw?.file === 'string' ? raw.file : null,
        line, property: typeof raw?.property === 'string' ? raw.property : 'token_exception',
        value: raw?.raw_value ?? null, reason: exception ? 'exception does not exactly match one finding' : 'exception is vague, wildcarded, or malformed',
      });
      continue;
    }
    const [finding] = remaining.splice(index, 1);
    approved.push({ ...finding, reason: exception.reason, evidence_ref: exception.evidence_ref, scope: exception.scope });
  }
  return { findings: remaining, approved };
}

export async function validateMotionTokens({ variantDir, brief, tokenCatalog }) {
  if (typeof variantDir !== 'string' || !brief?.motion_plan || !tokenCatalog?.tokens) {
    throw Object.assign(new Error('motion validation requires variantDir, brief motion plan, and token catalog'), { code: 'KINETIC_MOTION_INPUT_INVALID' });
  }
  const references = catalogReferences(tokenCatalog);
  const root = resolve(variantDir);
  const stat = await lstat(root).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw Object.assign(new Error('variantDir must be a real directory'), { code: 'KINETIC_MOTION_INPUT_INVALID' });
  }
  const files = await sourceFiles(root);
  let motionRequired = false;
  let reducedMotionFound = false;
  let findings = [];
  for (const file of files) {
    const path = resolve(root, file);
    const local = relative(root, path);
    if (local === '..' || local.startsWith(`..${sep}`)) {
      throw Object.assign(new Error('motion source escapes variantDir'), { code: 'KINETIC_MOTION_PATH_FORBIDDEN' });
    }
    const source = stripComments(await readFile(path, 'utf8'));
    motionRequired ||= MOTION_SOURCE.test(source);
    reducedMotionFound ||= hasReducedMotionBehavior(source);
    const before = findings.length;
    if (file.endsWith('.css') || file.endsWith('.html')) scanCssSource(findings, file, source, references);
    if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.html')) scanJsSource(findings, file, source, references);
    motionRequired ||= findings.length > before;
  }
  const exceptionResult = applyExceptions(findings, brief.motion_plan.token_exceptions ?? []);
  findings = exceptionResult.findings;
  if (motionRequired && !reducedMotionFound) {
    findings.push({ kind: 'missing_reduced_motion', file: null, line: null, property: 'reduced-motion', value: null });
  }
  return {
    schema: 'kinetic/motion-token-report@0.1',
    result: findings.length === 0 ? 'pass' : 'fail',
    files_scanned: files,
    findings,
    approved_exceptions: exceptionResult.approved,
    reduced_motion: { required: motionRequired, found: reducedMotionFound },
  };
}
