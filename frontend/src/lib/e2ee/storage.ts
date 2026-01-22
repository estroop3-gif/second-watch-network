/**
 * E2EE Key Storage Service
 * Uses IndexedDB for secure local storage of encryption keys
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  IdentityKeyPair,
  SignedPreKey,
  OneTimePreKey,
  SessionState,
  encodeBase64,
  decodeBase64,
} from './crypto';

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

interface E2EEDBSchema extends DBSchema {
  identity: {
    key: string; // 'current'
    value: {
      publicKey: string; // Base64
      privateKey: string; // Base64
      registrationId: number;
      createdAt: number;
    };
  };
  signedPreKeys: {
    key: number; // keyId
    value: {
      keyId: number;
      publicKey: string;
      privateKey: string;
      signature: string;
      isActive: boolean;
      createdAt: number;
    };
    indexes: { 'by-active': number };
  };
  oneTimePreKeys: {
    key: number; // keyId
    value: {
      keyId: number;
      publicKey: string;
      privateKey: string;
      createdAt: number;
    };
  };
  sessions: {
    key: string; // peerId
    value: {
      peerId: string;
      rootKey: string;
      chainKey: string;
      messageNumber: number;
      peerPublicKey: string;
      createdAt: number;
      updatedAt: number;
    };
  };
  pendingPreKeyMessages: {
    key: string; // messageId
    value: {
      messageId: string;
      peerId: string;
      encryptedMessage: string;
      createdAt: number;
    };
  };
}

const DB_NAME = 'swn-e2ee';
const DB_VERSION = 1;

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbPromise: Promise<IDBPDatabase<E2EEDBSchema>> | null = null;

async function getDB(): Promise<IDBPDatabase<E2EEDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<E2EEDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Identity store (single key pair)
        if (!db.objectStoreNames.contains('identity')) {
          db.createObjectStore('identity');
        }

        // Signed prekeys
        if (!db.objectStoreNames.contains('signedPreKeys')) {
          const store = db.createObjectStore('signedPreKeys', { keyPath: 'keyId' });
          store.createIndex('by-active', 'isActive');
        }

        // One-time prekeys
        if (!db.objectStoreNames.contains('oneTimePreKeys')) {
          db.createObjectStore('oneTimePreKeys', { keyPath: 'keyId' });
        }

        // Sessions
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'peerId' });
        }

        // Pending prekey messages
        if (!db.objectStoreNames.contains('pendingPreKeyMessages')) {
          db.createObjectStore('pendingPreKeyMessages', { keyPath: 'messageId' });
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================================
// IDENTITY KEY OPERATIONS
// ============================================================================

export async function saveIdentityKey(identity: IdentityKeyPair): Promise<void> {
  const db = await getDB();
  await db.put('identity', {
    publicKey: encodeBase64(identity.publicKey),
    privateKey: encodeBase64(identity.privateKey),
    registrationId: identity.registrationId,
    createdAt: Date.now(),
  }, 'current');
}

export async function getIdentityKey(): Promise<IdentityKeyPair | null> {
  const db = await getDB();
  const stored = await db.get('identity', 'current');
  if (!stored) return null;
  return {
    publicKey: decodeBase64(stored.publicKey),
    privateKey: decodeBase64(stored.privateKey),
    registrationId: stored.registrationId,
  };
}

export async function hasIdentityKey(): Promise<boolean> {
  const db = await getDB();
  const stored = await db.get('identity', 'current');
  return !!stored;
}

// ============================================================================
// SIGNED PREKEY OPERATIONS
// ============================================================================

export async function saveSignedPreKey(prekey: SignedPreKey): Promise<void> {
  const db = await getDB();

  // Deactivate all existing signed prekeys
  const tx = db.transaction('signedPreKeys', 'readwrite');
  const store = tx.objectStore('signedPreKeys');
  const allKeys = await store.getAll();
  for (const key of allKeys) {
    if (key.isActive) {
      key.isActive = false;
      await store.put(key);
    }
  }

  // Save new signed prekey as active
  await store.put({
    keyId: prekey.keyId,
    publicKey: encodeBase64(prekey.keyPair.publicKey),
    privateKey: encodeBase64(prekey.keyPair.privateKey),
    signature: encodeBase64(prekey.signature),
    isActive: true,
    createdAt: Date.now(),
  });

  await tx.done;
}

export async function getActiveSignedPreKey(): Promise<SignedPreKey | null> {
  const db = await getDB();
  const index = db.transaction('signedPreKeys').store.index('by-active');
  const stored = await index.get(1); // isActive = true (1)
  if (!stored) return null;
  return {
    keyId: stored.keyId,
    keyPair: {
      publicKey: decodeBase64(stored.publicKey),
      privateKey: decodeBase64(stored.privateKey),
    },
    signature: decodeBase64(stored.signature),
  };
}

export async function getSignedPreKeyById(keyId: number): Promise<SignedPreKey | null> {
  const db = await getDB();
  const stored = await db.get('signedPreKeys', keyId);
  if (!stored) return null;
  return {
    keyId: stored.keyId,
    keyPair: {
      publicKey: decodeBase64(stored.publicKey),
      privateKey: decodeBase64(stored.privateKey),
    },
    signature: decodeBase64(stored.signature),
  };
}

// ============================================================================
// ONE-TIME PREKEY OPERATIONS
// ============================================================================

export async function saveOneTimePreKeys(prekeys: OneTimePreKey[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('oneTimePreKeys', 'readwrite');
  const store = tx.objectStore('oneTimePreKeys');

  for (const prekey of prekeys) {
    await store.put({
      keyId: prekey.keyId,
      publicKey: encodeBase64(prekey.keyPair.publicKey),
      privateKey: encodeBase64(prekey.keyPair.privateKey),
      createdAt: Date.now(),
    });
  }

  await tx.done;
}

export async function getOneTimePreKeyById(keyId: number): Promise<OneTimePreKey | null> {
  const db = await getDB();
  const stored = await db.get('oneTimePreKeys', keyId);
  if (!stored) return null;
  return {
    keyId: stored.keyId,
    keyPair: {
      publicKey: decodeBase64(stored.publicKey),
      privateKey: decodeBase64(stored.privateKey),
    },
  };
}

export async function deleteOneTimePreKey(keyId: number): Promise<void> {
  const db = await getDB();
  await db.delete('oneTimePreKeys', keyId);
}

export async function getOneTimePreKeyCount(): Promise<number> {
  const db = await getDB();
  return await db.count('oneTimePreKeys');
}

export async function getAllOneTimePreKeys(): Promise<OneTimePreKey[]> {
  const db = await getDB();
  const stored = await db.getAll('oneTimePreKeys');
  return stored.map((s) => ({
    keyId: s.keyId,
    keyPair: {
      publicKey: decodeBase64(s.publicKey),
      privateKey: decodeBase64(s.privateKey),
    },
  }));
}

export async function getNextPreKeyId(): Promise<number> {
  const db = await getDB();
  const allKeys = await db.getAll('oneTimePreKeys');
  if (allKeys.length === 0) return 1;
  return Math.max(...allKeys.map((k) => k.keyId)) + 1;
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

export async function saveSession(session: SessionState): Promise<void> {
  const db = await getDB();
  await db.put('sessions', {
    peerId: session.peerId,
    rootKey: encodeBase64(session.rootKey),
    chainKey: encodeBase64(session.chainKey),
    messageNumber: session.messageNumber,
    peerPublicKey: encodeBase64(session.peerPublicKey),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function getSession(peerId: string): Promise<SessionState | null> {
  const db = await getDB();
  const stored = await db.get('sessions', peerId);
  if (!stored) return null;
  return {
    peerId: stored.peerId,
    rootKey: decodeBase64(stored.rootKey),
    chainKey: decodeBase64(stored.chainKey),
    messageNumber: stored.messageNumber,
    peerPublicKey: decodeBase64(stored.peerPublicKey),
  };
}

export async function hasSession(peerId: string): Promise<boolean> {
  const db = await getDB();
  const stored = await db.get('sessions', peerId);
  return !!stored;
}

export async function deleteSession(peerId: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', peerId);
}

export async function getAllSessions(): Promise<SessionState[]> {
  const db = await getDB();
  const stored = await db.getAll('sessions');
  return stored.map((s) => ({
    peerId: s.peerId,
    rootKey: decodeBase64(s.rootKey),
    chainKey: decodeBase64(s.chainKey),
    messageNumber: s.messageNumber,
    peerPublicKey: decodeBase64(s.peerPublicKey),
  }));
}

// ============================================================================
// FULL KEY EXPORT/IMPORT (for backup)
// ============================================================================

export interface ExportedKeys {
  identity: {
    publicKey: string;
    privateKey: string;
    registrationId: number;
  };
  signedPreKey: {
    keyId: number;
    publicKey: string;
    privateKey: string;
    signature: string;
  } | null;
  oneTimePreKeys: Array<{
    keyId: number;
    publicKey: string;
    privateKey: string;
  }>;
}

export async function exportAllKeys(): Promise<ExportedKeys | null> {
  const identity = await getIdentityKey();
  if (!identity) return null;

  const signedPreKey = await getActiveSignedPreKey();
  const oneTimePreKeys = await getAllOneTimePreKeys();

  return {
    identity: {
      publicKey: encodeBase64(identity.publicKey),
      privateKey: encodeBase64(identity.privateKey),
      registrationId: identity.registrationId,
    },
    signedPreKey: signedPreKey
      ? {
          keyId: signedPreKey.keyId,
          publicKey: encodeBase64(signedPreKey.keyPair.publicKey),
          privateKey: encodeBase64(signedPreKey.keyPair.privateKey),
          signature: encodeBase64(signedPreKey.signature),
        }
      : null,
    oneTimePreKeys: oneTimePreKeys.map((k) => ({
      keyId: k.keyId,
      publicKey: encodeBase64(k.keyPair.publicKey),
      privateKey: encodeBase64(k.keyPair.privateKey),
    })),
  };
}

export async function importAllKeys(keys: ExportedKeys): Promise<void> {
  // Import identity
  await saveIdentityKey({
    publicKey: decodeBase64(keys.identity.publicKey),
    privateKey: decodeBase64(keys.identity.privateKey),
    registrationId: keys.identity.registrationId,
  });

  // Import signed prekey
  if (keys.signedPreKey) {
    await saveSignedPreKey({
      keyId: keys.signedPreKey.keyId,
      keyPair: {
        publicKey: decodeBase64(keys.signedPreKey.publicKey),
        privateKey: decodeBase64(keys.signedPreKey.privateKey),
      },
      signature: decodeBase64(keys.signedPreKey.signature),
    });
  }

  // Import one-time prekeys
  if (keys.oneTimePreKeys.length > 0) {
    await saveOneTimePreKeys(
      keys.oneTimePreKeys.map((k) => ({
        keyId: k.keyId,
        keyPair: {
          publicKey: decodeBase64(k.publicKey),
          privateKey: decodeBase64(k.privateKey),
        },
      }))
    );
  }
}

// ============================================================================
// CLEAR ALL DATA
// ============================================================================

export async function clearAllE2EEData(): Promise<void> {
  const db = await getDB();
  await db.clear('identity');
  await db.clear('signedPreKeys');
  await db.clear('oneTimePreKeys');
  await db.clear('sessions');
  await db.clear('pendingPreKeyMessages');
}
