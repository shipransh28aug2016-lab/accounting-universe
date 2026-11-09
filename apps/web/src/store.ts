/**
 * Local-first persistence. Progress lives in IndexedDB on the student's device; if IndexedDB is unavailable (private
 * mode, blocked storage) we fall back to memory so the app still works — and say so in the UI via `storageMode`.
 * Nothing here ever leaves the device.
 */
import { Machine } from '../../../packages/engine/src';
import { STORAGE, type Attempt, type Export, type Profile, type Seen } from '../../../packages/curriculum/src';
import { register } from './machine-dom';
export type { Attempt, Export, Profile, Seen };

export type StorageMode = 'indexeddb' | 'memory';
export let storageMode: StorageMode = 'memory';
/** Where progress lives right now (see the `storage` machine in docs/STATE_MACHINES.md). The shell shows a banner when it is MEMORY or DEGRADED. */
export const storage = new Machine(STORAGE);
register(storage);
storage.subscribe(m => { storageMode = m.is('INDEXEDDB') ? 'indexeddb' : 'memory'; });

const DB = 'accounting-universe', VER = 2;
const STORES = ['attempts', 'seen', 'profile', 'assignments', 'projects'];
let dbp: Promise<IDBDatabase | null> | null = null;
const mem: Record<string, unknown[]> = { attempts: [], seen: [], profile: [], assignments: [], projects: [] };

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise(resolve => {
    let settled = false;
    const done = (db: IDBDatabase | null) => { if (settled) return; settled = true; storage.send(db ? 'OPENED' : 'UNAVAILABLE'); resolve(db); };
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return done(null);
      const req = indexedDB.open(DB, VER);
      req.onupgradeneeded = () => { const d = req.result; for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { autoIncrement: true }); };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
    } catch { done(null); }
  });
  return dbp;
}
const wrap = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

async function add(store: string, v: unknown): Promise<void> {
  const db = await open();
  if (!db) { mem[store]!.push(v); return; }
  try { await wrap(db.transaction(store, 'readwrite').objectStore(store).add(v)); } catch { storage.send('WRITE_FAILED'); mem[store]!.push(v); }
}
async function all<T>(store: string): Promise<T[]> {
  const db = await open();
  if (!db) return [...(mem[store] as T[])];
  try { return [...(await wrap(db.transaction(store).objectStore(store).getAll()) as T[]), ...(mem[store] as T[])]; } catch { return [...(mem[store] as T[])]; }
}
async function clearStore(store: string) {
  mem[store]!.length = 0;
  const db = await open();
  if (db) { try { await wrap(db.transaction(store, 'readwrite').objectStore(store).clear()); } catch { /* ignore */ } }
}

export const recordAttempt = (a: Attempt) => add('attempts', a);
export const recordSeen = (s: Seen) => add('seen', s);
export const attempts = () => all<Attempt>('attempts');
export const seen = () => all<Seen>('seen');
export async function getProfile(): Promise<Profile | null> { const p = await all<Profile>('profile'); return p.length ? p[p.length - 1]! : null; }
export async function setProfile(p: Profile) { await clearStore('profile'); await add('profile', p); }
export async function resetAll() { for (const s of STORES) await clearStore(s); }

// Assignments handed over by a teacher (files), and the student's own project notes. Both stay on this device.
export const saveAssignment = async (a: unknown & { id: string }) => { const cur = await assignmentsAll(); if (cur.some(x => x.id === a.id)) return false; await add('assignments', a); return true; };
export const assignmentsAll = () => all<{ id: string }>('assignments');
export async function getProject(key: string): Promise<Record<string, unknown> | null> { const p = await all<{ key: string; data: Record<string, unknown> }>('projects'); const hit = [...p].reverse().find(x => x.key === key); return hit ? hit.data : null; }
export async function setProject(key: string, data: Record<string, unknown>) { const keep = (await all<{ key: string; data: Record<string, unknown> }>('projects')).filter(x => x.key !== key); await clearStore('projects'); for (const x of keep) await add('projects', x); await add('projects', { key, data }); }
export const ready = async () => { await open(); return storageMode; };

export async function exportAll(): Promise<Export> { return { app: 'accounting-universe', version: 1, exportedAt: Date.now(), profile: await getProfile(), attempts: await attempts(), seen: await seen() }; }
