import { readFileSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const ALLOWED = new Set([
  '$schema', '$id', '$defs', '$ref', 'title', 'description', 'default', 'examples',
  'type', 'required', 'properties', 'additionalProperties', 'enum', 'const',
  'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'items', 'minItems',
  'maxItems', 'uniqueItems', 'allOf', 'if', 'then', 'format',
]);
const TYPES = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);
const FORMATS = new Set(['date', 'date-time', 'uri']);
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';

class SchemaFault extends Error {
  constructor(code, schemaPath, keyword, message) {
    super(message);
    this.detail = { code, schemaPath, instancePath: '#', keyword, message };
  }
}

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const pointerEscape = (value) => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function malformed(path, keyword, message) {
  throw new SchemaFault('KINETIC_SCHEMA_MALFORMED', path, keyword, message);
}

function assertNonnegativeInteger(value, path, keyword) {
  if (!Number.isInteger(value) || value < 0) malformed(path, keyword, `${keyword} must be a nonnegative integer`);
}

function assertSchema(schema, path = '#') {
  if (!plainObject(schema)) malformed(path, null, 'schema must be an object');
  for (const keyword of Object.keys(schema)) {
    if (!ALLOWED.has(keyword)) throw new SchemaFault('KINETIC_SCHEMA_KEYWORD_UNSUPPORTED', path, keyword, `unsupported schema keyword: ${keyword}`);
  }
  if (own(schema, '$schema') && schema.$schema !== DRAFT) malformed(path, '$schema', `only ${DRAFT} is supported`);
  for (const keyword of ['$id', 'title', 'description', '$ref']) {
    if (own(schema, keyword) && typeof schema[keyword] !== 'string') malformed(path, keyword, `${keyword} must be a string`);
  }
  if (own(schema, 'examples') && !Array.isArray(schema.examples)) malformed(path, 'examples', 'examples must be an array');

  if (own(schema, 'type')) {
    const values = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (values.length === 0 || values.some((value) => typeof value !== 'string' || !TYPES.has(value)) || new Set(values).size !== values.length) {
      malformed(path, 'type', 'type must be a supported type or a unique nonempty array of supported types');
    }
  }
  if (own(schema, 'required')) {
    if (!Array.isArray(schema.required) || schema.required.some((value) => typeof value !== 'string') || new Set(schema.required).size !== schema.required.length) {
      malformed(path, 'required', 'required must be a unique array of strings');
    }
  }
  for (const keyword of ['properties', '$defs']) {
    if (own(schema, keyword) && !plainObject(schema[keyword])) malformed(path, keyword, `${keyword} must be an object`);
    for (const [name, child] of Object.entries(schema[keyword] ?? {})) assertSchema(child, `${path}/${keyword}/${pointerEscape(name)}`);
  }
  if (own(schema, 'additionalProperties')) {
    if (typeof schema.additionalProperties !== 'boolean' && !plainObject(schema.additionalProperties)) malformed(path, 'additionalProperties', 'additionalProperties must be boolean or a schema');
    if (plainObject(schema.additionalProperties)) assertSchema(schema.additionalProperties, `${path}/additionalProperties`);
  }
  if (own(schema, 'enum') && (!Array.isArray(schema.enum) || schema.enum.length === 0)) malformed(path, 'enum', 'enum must be a nonempty array');
  if (own(schema, 'pattern')) {
    if (typeof schema.pattern !== 'string') malformed(path, 'pattern', 'pattern must be a string');
    try { new RegExp(schema.pattern); } catch { malformed(path, 'pattern', 'pattern must be a valid regular expression'); }
  }
  for (const keyword of ['minLength', 'maxLength', 'minItems', 'maxItems']) {
    if (own(schema, keyword)) assertNonnegativeInteger(schema[keyword], path, keyword);
  }
  if (own(schema, 'minLength') && own(schema, 'maxLength') && schema.minLength > schema.maxLength) malformed(path, 'minLength', 'minLength cannot exceed maxLength');
  if (own(schema, 'minItems') && own(schema, 'maxItems') && schema.minItems > schema.maxItems) malformed(path, 'minItems', 'minItems cannot exceed maxItems');
  for (const keyword of ['minimum', 'maximum']) {
    if (own(schema, keyword) && (typeof schema[keyword] !== 'number' || !Number.isFinite(schema[keyword]))) malformed(path, keyword, `${keyword} must be a finite number`);
  }
  if (own(schema, 'minimum') && own(schema, 'maximum') && schema.minimum > schema.maximum) malformed(path, 'minimum', 'minimum cannot exceed maximum');
  if (own(schema, 'items')) assertSchema(schema.items, `${path}/items`);
  if (own(schema, 'uniqueItems') && typeof schema.uniqueItems !== 'boolean') malformed(path, 'uniqueItems', 'uniqueItems must be boolean');
  if (own(schema, 'allOf')) {
    if (!Array.isArray(schema.allOf) || schema.allOf.length === 0) malformed(path, 'allOf', 'allOf must be a nonempty array');
    schema.allOf.forEach((child, index) => assertSchema(child, `${path}/allOf/${index}`));
  }
  if (own(schema, 'if') !== own(schema, 'then')) malformed(path, own(schema, 'if') ? 'if' : 'then', 'if and then must appear together');
  if (schema.if) {
    assertSchema(schema.if, `${path}/if`);
    assertSchema(schema.then, `${path}/then`);
  }
  if (own(schema, 'format') && !FORMATS.has(schema.format)) malformed(path, 'format', `unsupported format: ${schema.format}`);
}

function schemaRootFor(schemaPath) {
  let cursor = dirname(resolve(schemaPath));
  while (true) {
    if (basename(cursor) === 'schemas') return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

function decodePointer(document, fragment, schemaPath) {
  if (!fragment || fragment === '#') return document;
  if (!fragment.startsWith('#/')) throw new SchemaFault('KINETIC_SCHEMA_REF_FORBIDDEN', schemaPath, '$ref', 'only JSON Pointer fragments are supported');
  let current = document;
  for (const raw of fragment.slice(2).split('/')) {
    const token = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!plainObject(current) && !Array.isArray(current) || !own(current, token)) {
      throw new SchemaFault('KINETIC_SCHEMA_REF_UNRESOLVED', schemaPath, '$ref', `unresolved JSON Pointer: ${fragment}`);
    }
    current = current[token];
  }
  return current;
}

function loadExternal(path, cache) {
  if (cache.has(path)) return cache.get(path);
  let text;
  try { text = readFileSync(path, 'utf8'); } catch {
    throw new SchemaFault('KINETIC_SCHEMA_REF_UNRESOLVED', path, '$ref', `unresolved schema file: ${path}`);
  }
  let schema;
  try { schema = JSON.parse(text); } catch {
    throw new SchemaFault('KINETIC_SCHEMA_JSON_INVALID', path, '$ref', `invalid JSON in referenced schema: ${path}`);
  }
  assertSchema(schema);
  cache.set(path, schema);
  return schema;
}

function resolveReference(ref, currentFile, documentRoot, cache) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || isAbsolute(ref)) {
    throw new SchemaFault('KINETIC_SCHEMA_REF_FORBIDDEN', currentFile, '$ref', `forbidden schema reference: ${ref}`);
  }
  if (ref.startsWith('#')) {
    return { schema: decodePointer(documentRoot, ref, currentFile), documentRoot, file: currentFile, key: `${currentFile}${ref}` };
  }
  const [filePart, fragment = ''] = ref.split('#', 2);
  const targetFile = resolve(dirname(currentFile), filePart);
  const schemasRoot = schemaRootFor(currentFile);
  if (!schemasRoot) throw new SchemaFault('KINETIC_SCHEMA_REF_FORBIDDEN', currentFile, '$ref', 'external refs require a schema beneath schemas/');
  const rel = relative(schemasRoot, targetFile);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new SchemaFault('KINETIC_SCHEMA_REF_FORBIDDEN', currentFile, '$ref', `schema ref escapes schemas/: ${ref}`);
  }
  const external = loadExternal(targetFile, cache);
  const pointer = fragment ? `#${fragment}` : '#';
  return { schema: decodePointer(external, pointer, targetFile), documentRoot: external, file: targetFile, key: `${targetFile}${pointer}` };
}

function valueTypeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return plainObject(value);
  if (type === 'integer') return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function validDateTime(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

function validUri(value) {
  try { return Boolean(new URL(value).protocol); } catch { return false; }
}

function addError(errors, schemaPath, instancePath, keyword, message) {
  errors.push({ code: 'KINETIC_SCHEMA_INVALID', schemaPath, instancePath, keyword, message });
}

function validateInstance(value, schema, context, instancePath = '#', schemaPath = '#') {
  const { errors, currentFile, documentRoot, cache, refStack } = context;
  if (schema.$ref) {
    const target = resolveReference(schema.$ref, currentFile, documentRoot, cache);
    if (refStack.has(target.key)) throw new SchemaFault('KINETIC_SCHEMA_REF_CYCLE', target.file, '$ref', `cyclic schema reference: ${target.key}`);
    const nextStack = new Set(refStack).add(target.key);
    validateInstance(value, target.schema, { ...context, currentFile: target.file, documentRoot: target.documentRoot, refStack: nextStack }, instancePath, target.key);
  }

  if (own(schema, 'type')) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => valueTypeMatches(value, type))) {
      addError(errors, schemaPath, instancePath, 'type', `expected type ${types.join('|')}`);
      return;
    }
  }
  if (own(schema, 'enum') && !schema.enum.some((candidate) => isDeepStrictEqual(value, candidate))) addError(errors, schemaPath, instancePath, 'enum', 'value is not in enum');
  if (own(schema, 'const') && !isDeepStrictEqual(value, schema.const)) addError(errors, schemaPath, instancePath, 'const', 'value does not match const');

  if (typeof value === 'string') {
    if (own(schema, 'minLength') && [...value].length < schema.minLength) addError(errors, schemaPath, instancePath, 'minLength', `string is shorter than ${schema.minLength}`);
    if (own(schema, 'maxLength') && [...value].length > schema.maxLength) addError(errors, schemaPath, instancePath, 'maxLength', `string is longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) addError(errors, schemaPath, instancePath, 'pattern', 'string does not match pattern');
    if (schema.format === 'date' && !validDate(value)) addError(errors, schemaPath, instancePath, 'format', 'invalid date');
    if (schema.format === 'date-time' && !validDateTime(value)) addError(errors, schemaPath, instancePath, 'format', 'invalid date-time');
    if (schema.format === 'uri' && !validUri(value)) addError(errors, schemaPath, instancePath, 'format', 'invalid absolute URI');
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (own(schema, 'minimum') && value < schema.minimum) addError(errors, schemaPath, instancePath, 'minimum', `number is below ${schema.minimum}`);
    if (own(schema, 'maximum') && value > schema.maximum) addError(errors, schemaPath, instancePath, 'maximum', `number is above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (own(schema, 'minItems') && value.length < schema.minItems) addError(errors, schemaPath, instancePath, 'minItems', `array has fewer than ${schema.minItems} items`);
    if (own(schema, 'maxItems') && value.length > schema.maxItems) addError(errors, schemaPath, instancePath, 'maxItems', `array has more than ${schema.maxItems} items`);
    if (schema.uniqueItems) {
      for (let i = 0; i < value.length; i++) for (let j = i + 1; j < value.length; j++) {
        if (isDeepStrictEqual(value[i], value[j])) addError(errors, schemaPath, `${instancePath}/${j}`, 'uniqueItems', `item duplicates index ${i}`);
      }
    }
    if (schema.items) value.forEach((item, index) => validateInstance(item, schema.items, context, `${instancePath}/${index}`, `${schemaPath}/items`));
  }
  if (plainObject(value)) {
    for (const key of schema.required ?? []) if (!own(value, key)) addError(errors, schemaPath, instancePath, 'required', `missing required property: ${key}`);
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (own(value, key)) validateInstance(value[key], child, context, `${instancePath}/${pointerEscape(key)}`, `${schemaPath}/properties/${pointerEscape(key)}`);
    }
    const known = new Set(Object.keys(schema.properties ?? {}));
    for (const [key, childValue] of Object.entries(value)) {
      if (known.has(key)) continue;
      if (schema.additionalProperties === false) addError(errors, schemaPath, `${instancePath}/${pointerEscape(key)}`, 'additionalProperties', `unexpected property: ${key}`);
      else if (plainObject(schema.additionalProperties)) validateInstance(childValue, schema.additionalProperties, context, `${instancePath}/${pointerEscape(key)}`, `${schemaPath}/additionalProperties`);
    }
  }
  for (const [index, child] of (schema.allOf ?? []).entries()) validateInstance(value, child, context, instancePath, `${schemaPath}/allOf/${index}`);
  if (schema.if) {
    const conditionErrors = [];
    validateInstance(value, schema.if, { ...context, errors: conditionErrors }, instancePath, `${schemaPath}/if`);
    if (conditionErrors.length === 0) validateInstance(value, schema.then, context, instancePath, `${schemaPath}/then`);
  }
}

export function validateValue({ value, schema, schemaPath = 'inline.schema.json' }) {
  try {
    assertSchema(schema);
    const file = resolve(schemaPath);
    const errors = [];
    validateInstance(value, schema, { errors, currentFile: file, documentRoot: schema, cache: new Map([[file, schema]]), refStack: new Set([`${file}#`]) });
    return { valid: errors.length === 0, errors };
  } catch (error) {
    if (error instanceof SchemaFault) return { valid: false, errors: [error.detail] };
    throw error;
  }
}

export async function validateFile({ artifactPath, schemaPath }) {
  let schema;
  try { schema = JSON.parse(await readFileAsync(schemaPath, 'utf8')); }
  catch (error) {
    return { valid: false, errors: [{ code: 'KINETIC_SCHEMA_JSON_INVALID', schemaPath, instancePath: '#', keyword: null, message: error.message }] };
  }
  let value;
  try { value = JSON.parse(await readFileAsync(artifactPath, 'utf8')); }
  catch (error) {
    return { valid: false, errors: [{ code: 'KINETIC_INSTANCE_JSON_INVALID', schemaPath, instancePath: '#', keyword: null, message: error.message }] };
  }
  return validateValue({ value, schema, schemaPath });
}
