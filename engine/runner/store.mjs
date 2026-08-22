import { createHash, randomUUID } from 'node:crypto';
import { open, mkdir, readFile, rename, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const now = () => new Date().toISOString();

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

function gymRoot() {
  return process.env.KINETIC_GYM_ROOT || join(repositoryRoot, 'gym');
}

function assertId(value, label = 'case id') {
  if (typeof value !== 'string' || !/^case-[0-9a-z-]+$/.test(value)) throw new StoreError('KINETIC_PATH_INVALID', `invalid ${label}: ${value}`);
}

function casePath(caseId) {
  assertId(caseId);
  return join(gymRoot(), 'runs', caseId, 'case.json');
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}-${randomUUID()}`;
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temp, path);
    await fsyncDirectory(dirname(path));
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

async function readJson(path, code = 'KINETIC_STORE_READ_FAILED') {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (error) { throw new StoreError(code, `${path}: ${error.message}`); }
  try { return JSON.parse(text); }
  catch (error) { throw new StoreError(code, `${path}: ${error.message}`); }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function acquireLock(caseId, operation, ttlSeconds) {
  assertId(caseId);
  const locks = join(gymRoot(), 'jobs', 'locks');
  const lockDir = join(locks, `${caseId}.lock`);
  await mkdir(locks, { recursive: true });
  let takeoverOf = null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const nonce = randomUUID();
    try {
      await mkdir(lockDir);
      const timestamp = now();
      const owner = { pid: process.pid, nonce, operation, acquired_at: timestamp, heartbeat_at: timestamp, ttl_seconds: ttlSeconds, takeover_of: takeoverOf };
      await writeJsonAtomic(join(lockDir, 'owner.json'), owner);
      return { lockDir, owner };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    let owner;
    try { owner = await readJson(join(lockDir, 'owner.json'), 'KINETIC_CASE_LOCKED'); }
    catch (error) {
      if (error.code !== 'KINETIC_CASE_LOCKED') throw error;
      owner = null;
    }
    const heartbeat = owner ? Date.parse(owner.heartbeat_at) : Number.NaN;
    const expired = !Number.isFinite(heartbeat) || Date.now() - heartbeat > Number(owner?.ttl_seconds ?? ttlSeconds) * 1000;
    if (owner && pidAlive(owner.pid) && !expired) throw new StoreError('KINETIC_CASE_LOCKED', `${caseId} is locked by pid ${owner.pid}`);

    const staleDir = `${lockDir}.stale-${Date.now()}-${owner?.nonce ?? randomUUID()}`;
    try {
      await rename(lockDir, staleDir);
      takeoverOf = owner ? { pid: owner.pid, nonce: owner.nonce, heartbeat_at: owner.heartbeat_at } : { pid: null, nonce: null, heartbeat_at: null };
      await fsyncDirectory(locks);
      await rm(staleDir, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new StoreError('KINETIC_CASE_LOCKED', `unable to acquire lock for ${caseId}`);
}

async function refreshHeartbeat(lockDir, nonce) {
  const ownerPath = join(lockDir, 'owner.json');
  const owner = await readJson(ownerPath, 'KINETIC_CASE_LOCK_LOST');
  if (owner.nonce !== nonce) throw new StoreError('KINETIC_CASE_LOCK_LOST', 'lock owner changed');
  owner.heartbeat_at = now();
  await writeJsonAtomic(ownerPath, owner);
}

export async function withCaseLock(caseId, operation, fn, { ttlSeconds = 300, heartbeatMs = 15_000 } = {}) {
  const { lockDir, owner } = await acquireLock(caseId, operation, ttlSeconds);
  let heartbeatError = null;
  const timer = setInterval(() => refreshHeartbeat(lockDir, owner.nonce).catch((error) => { heartbeatError = error; }), heartbeatMs);
  timer.unref();
  try {
    const result = await fn(owner);
    if (heartbeatError) throw heartbeatError;
    return result;
  } finally {
    clearInterval(timer);
    try {
      const current = await readJson(join(lockDir, 'owner.json'), 'KINETIC_CASE_LOCK_LOST');
      if (current.nonce === owner.nonce) {
        await rm(lockDir, { recursive: true, force: true });
        await fsyncDirectory(dirname(lockDir));
      }
    } catch (error) {
      if (error.code !== 'KINETIC_CASE_LOCK_LOST') throw error;
    }
  }
}

function normalizeLegacy(record) {
  const normalized = structuredClone(record);
  for (const slot of Object.values(normalized.slots ?? {})) {
    slot.technically_qualified ??= false;
    slot.design_qualified ??= null;
    slot.acceptable_for_further_taste_learning ??= null;
  }
  return normalized;
}

export async function readCase(caseId) {
  const record = await readJson(casePath(caseId), 'KINETIC_CASE_NOT_FOUND');
  if (record.schema === 'kinetic/gym/case-run@0.2') return { runVersion: 'phase2.5', record, legacy: false };
  if (record.schema === 'kinetic/gym/variant-run@0.1') return { runVersion: 'phase2', record: normalizeLegacy(record), legacy: true };
  throw new StoreError('KINETIC_CASE_RUN_INVALID', `unsupported case schema: ${record.schema}`);
}

export async function writeCaseAtomic(caseId, record) {
  if (record.case_id !== caseId) throw new StoreError('KINETIC_CASE_RUN_INVALID', 'case ID does not match record');
  await writeJsonAtomic(casePath(caseId), record);
}

export async function hashFile(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function receiptPath(caseId) {
  assertId(caseId);
  return join(gymRoot(), 'runs', caseId, 'receipts', 'artifacts.json');
}

export async function findIdempotentReceipt(caseId, key) {
  let receipts;
  try { receipts = await readJson(receiptPath(caseId)); }
  catch (error) {
    if (error.code === 'KINETIC_STORE_READ_FAILED') return null;
    throw error;
  }
  return receipts.find((receipt) => receipt.idempotency_key === key) ?? null;
}

export async function appendArtifactReceipt(caseId, receipt) {
  if (!receipt || typeof receipt.idempotency_key !== 'string' || receipt.idempotency_key.length === 0) throw new StoreError('KINETIC_RECEIPT_INVALID', 'receipt requires idempotency_key');
  return withCaseLock(caseId, 'append-artifact-receipt', async () => {
    const existing = await findIdempotentReceipt(caseId, receipt.idempotency_key);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(receipt)) throw new StoreError('KINETIC_ARTIFACT_MISMATCH', `different receipt content for ${receipt.idempotency_key}`);
      return existing;
    }
    let receipts = [];
    try { receipts = await readJson(receiptPath(caseId)); }
    catch (error) { if (error.code !== 'KINETIC_STORE_READ_FAILED') throw error; }
    receipts.push(structuredClone(receipt));
    await writeJsonAtomic(receiptPath(caseId), receipts);
    return receipt;
  });
}

export function storePaths(caseId) {
  return { gym: gymRoot(), case: casePath(caseId), locks: join(gymRoot(), 'jobs', 'locks') };
}
