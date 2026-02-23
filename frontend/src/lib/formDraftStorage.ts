/**
 * Form Draft Storage Engine
 *
 * Persists form drafts to localStorage with automatic cleanup.
 * Key format: swn-draft:{domain}:{formName}:{entityId}
 */

import { safeStorage } from '@/lib/api';

const MANIFEST_KEY = 'swn-draft-manifest';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface DraftEnvelope<T> {
  v: 1;
  ts: number;
  serverTs?: string;
  data: T;
}

/** Build a consistent draft key */
export function buildDraftKey(domain: string, formName: string, entityId: string): string {
  return `swn-draft:${domain}:${formName}:${entityId}`;
}

/** Get the manifest of all tracked draft keys */
function getManifest(): string[] {
  const raw = safeStorage.getItem(MANIFEST_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Update the manifest */
function setManifest(keys: string[]): void {
  safeStorage.setItem(MANIFEST_KEY, JSON.stringify(keys));
}

/** Add a key to the manifest (deduped) */
function addToManifest(key: string): void {
  const manifest = getManifest();
  if (!manifest.includes(key)) {
    manifest.push(key);
    setManifest(manifest);
  }
}

/** Remove a key from the manifest */
function removeFromManifest(key: string): void {
  const manifest = getManifest();
  const idx = manifest.indexOf(key);
  if (idx !== -1) {
    manifest.splice(idx, 1);
    setManifest(manifest);
  }
}

/** Save a draft to localStorage */
export function saveDraft<T>(key: string, data: T, serverTs?: string): void {
  const envelope: DraftEnvelope<T> = {
    v: 1,
    ts: Date.now(),
    data,
  };
  if (serverTs) {
    envelope.serverTs = serverTs;
  }
  safeStorage.setItem(key, JSON.stringify(envelope));
  addToManifest(key);
}

/** Load a draft from localStorage. Returns null if missing or expired. */
export function loadDraft<T>(key: string): { data: T; ts: number; serverTs?: string } | null {
  const raw = safeStorage.getItem(key);
  if (!raw) return null;
  try {
    const envelope: DraftEnvelope<T> = JSON.parse(raw);
    if (envelope.v !== 1) return null;
    if (Date.now() - envelope.ts > TTL_MS) {
      clearDraft(key);
      return null;
    }
    return { data: envelope.data, ts: envelope.ts, serverTs: envelope.serverTs };
  } catch {
    clearDraft(key);
    return null;
  }
}

/** Remove a draft from storage and the manifest */
export function clearDraft(key: string): void {
  safeStorage.removeItem(key);
  removeFromManifest(key);
}

/** Remove all drafts older than 7 days */
export function runCleanup(): void {
  const manifest = getManifest();
  const now = Date.now();
  const surviving: string[] = [];

  for (const key of manifest) {
    const raw = safeStorage.getItem(key);
    if (!raw) continue;
    try {
      const envelope = JSON.parse(raw);
      if (now - envelope.ts > TTL_MS) {
        safeStorage.removeItem(key);
      } else {
        surviving.push(key);
      }
    } catch {
      safeStorage.removeItem(key);
    }
  }

  setManifest(surviving);
}
