/**
 * E2EE Service
 * High-level service for end-to-end encrypted messaging
 *
 * Usage:
 * 1. Call initializeE2EE() on app startup (if user has keys) or after setup
 * 2. Call setupE2EE(pin) for first-time setup with PIN backup
 * 3. Call encryptMessage(recipientId, text) to encrypt outgoing messages
 * 4. Call decryptMessage(senderId, encrypted) to decrypt incoming messages
 */

import { api } from '@/lib/api';
import * as crypto from './crypto';
import * as storage from './storage';

const PREKEY_BATCH_SIZE = 100;
const MIN_PREKEY_COUNT = 20;

// ============================================================================
// INITIALIZATION STATE
// ============================================================================

let isInitialized = false;
let currentUserId: string | null = null;

export function isE2EEInitialized(): boolean {
  return isInitialized;
}

export function getE2EEUserId(): string | null {
  return currentUserId;
}

// ============================================================================
// SETUP AND INITIALIZATION
// ============================================================================

/**
 * Initialize E2EE from existing local keys
 * Call this on app startup if user has previously set up E2EE
 */
export async function initializeE2EE(userId: string): Promise<boolean> {
  try {
    const hasKeys = await storage.hasIdentityKey();
    if (!hasKeys) {
      return false;
    }

    currentUserId = userId;
    isInitialized = true;

    // Check if we need to replenish prekeys
    await replenishPreKeysIfNeeded(userId);

    return true;
  } catch (error) {
    console.error('Failed to initialize E2EE:', error);
    return false;
  }
}

/**
 * Set up E2EE for the first time
 * Generates all keys, registers with server, and creates PIN backup
 */
export async function setupE2EE(userId: string, pin: string): Promise<void> {
  try {
    // Generate identity key
    const identityKey = crypto.generateIdentityKeyPair();
    await storage.saveIdentityKey(identityKey);

    // Generate signed prekey
    const signedPreKey = crypto.generateSignedPreKey(identityKey.privateKey, 1);
    await storage.saveSignedPreKey(signedPreKey);

    // Generate one-time prekeys
    const oneTimePreKeys = crypto.generateOneTimePreKeys(1, PREKEY_BATCH_SIZE);
    await storage.saveOneTimePreKeys(oneTimePreKeys);

    // Register keys with server
    await api.registerE2EEKeys(userId, {
      identity_key: {
        public_key: crypto.encodeBase64(identityKey.publicKey),
        registration_id: identityKey.registrationId,
      },
      signed_prekey: {
        key_id: signedPreKey.keyId,
        public_key: crypto.encodeBase64(signedPreKey.keyPair.publicKey),
        signature: crypto.encodeBase64(signedPreKey.signature),
      },
      one_time_prekeys: oneTimePreKeys.map((pk) => ({
        key_id: pk.keyId,
        public_key: crypto.encodeBase64(pk.keyPair.publicKey),
      })),
    });

    // Create and upload encrypted backup
    const backup = await crypto.encryptKeyBackup(
      {
        identityKey: identityKey.privateKey,
        signedPreKey: signedPreKey.keyPair.privateKey,
        oneTimePreKeys: oneTimePreKeys.map((pk) => pk.keyPair.privateKey),
      },
      pin
    );

    await api.uploadE2EEKeyBackup(userId, backup);

    currentUserId = userId;
    isInitialized = true;
  } catch (error) {
    // Clean up on failure
    await storage.clearAllE2EEData();
    throw error;
  }
}

/**
 * Recover E2EE keys from backup using PIN
 */
export async function recoverE2EE(userId: string, pin: string): Promise<void> {
  try {
    // Fetch encrypted backup from server
    const backup = await api.getE2EEKeyBackup(userId);

    // Decrypt backup
    const decryptedKeys = await crypto.decryptKeyBackup(
      backup.encrypted_data,
      backup.salt,
      backup.iv,
      pin
    );

    // We need to regenerate the public keys and other metadata
    // This is a simplified recovery - in production you'd want to store more metadata

    // For now, we'll generate new keys with the recovered private keys as seed
    // In production, you'd properly serialize/deserialize the full key state
    throw new Error('Key recovery requires full key serialization - not yet implemented');

  } catch (error) {
    console.error('Failed to recover E2EE:', error);
    throw error;
  }
}

/**
 * Check if prekeys need replenishing and upload more if needed
 */
async function replenishPreKeysIfNeeded(userId: string): Promise<void> {
  try {
    const serverCount = await api.getE2EEPrekeyCount(userId);

    if (serverCount.count < MIN_PREKEY_COUNT) {
      // Generate more prekeys
      const nextId = await storage.getNextPreKeyId();
      const newPreKeys = crypto.generateOneTimePreKeys(nextId, PREKEY_BATCH_SIZE);

      // Save locally
      await storage.saveOneTimePreKeys(newPreKeys);

      // Upload to server
      await api.uploadE2EEPrekeys(
        userId,
        newPreKeys.map((pk) => ({
          key_id: pk.keyId,
          public_key: crypto.encodeBase64(pk.keyPair.publicKey),
        }))
      );
    }
  } catch (error) {
    console.error('Failed to replenish prekeys:', error);
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Establish an E2EE session with a peer
 */
async function establishSession(peerId: string): Promise<crypto.SessionState> {
  if (!currentUserId) {
    throw new Error('E2EE not initialized');
  }

  // Check if we already have a session
  const existingSession = await storage.getSession(peerId);
  if (existingSession) {
    return existingSession;
  }

  // Get our identity key
  const identityKey = await storage.getIdentityKey();
  if (!identityKey) {
    throw new Error('No identity key found');
  }

  // Get peer's prekey bundle from server
  const bundle = await api.getE2EEPreKeyBundle(peerId, currentUserId);

  // Generate ephemeral key for this session
  const ephemeralKey = crypto.generateKeyPair();

  // Perform X3DH key agreement
  const { sharedSecret, ephemeralPublicKey } = await crypto.x3dhInitiate(
    identityKey,
    ephemeralKey,
    {
      registrationId: bundle.registration_id,
      identityKey: crypto.decodeBase64(bundle.identity_key),
      signedPreKeyId: bundle.signed_prekey_id,
      signedPreKey: crypto.decodeBase64(bundle.signed_prekey),
      signedPreKeySignature: crypto.decodeBase64(bundle.signed_prekey_signature),
      oneTimePreKeyId: bundle.one_time_prekey_id ?? undefined,
      oneTimePreKey: bundle.one_time_prekey
        ? crypto.decodeBase64(bundle.one_time_prekey)
        : undefined,
    }
  );

  // Initialize session state
  const session = crypto.initializeSession(
    peerId,
    sharedSecret,
    crypto.decodeBase64(bundle.identity_key)
  );

  // Store our ephemeral key for the prekey message
  session.ourEphemeralKey = ephemeralKey;

  // Save session
  await storage.saveSession(session);

  return session;
}

// ============================================================================
// MESSAGE ENCRYPTION/DECRYPTION
// ============================================================================

/**
 * Encrypt a message for a recipient
 */
export async function encryptMessage(
  recipientId: string,
  plaintext: string
): Promise<crypto.EncryptedMessage> {
  // Get or establish session
  let session = await storage.getSession(recipientId);
  const isPreKeyMessage = !session;

  if (!session) {
    session = await establishSession(recipientId);
  }

  // Encrypt the message
  const { encrypted, updatedSession } = await crypto.encryptForSession(
    session,
    plaintext,
    isPreKeyMessage,
    isPreKeyMessage && session.ourEphemeralKey
      ? session.ourEphemeralKey.publicKey
      : undefined
  );

  // Update session state
  await storage.saveSession(updatedSession);

  return encrypted;
}

/**
 * Decrypt a message from a sender
 */
export async function decryptMessage(
  senderId: string,
  encrypted: crypto.EncryptedMessage
): Promise<string> {
  let session = await storage.getSession(senderId);

  // Handle prekey message (first message in session)
  if (encrypted.isPreKeyMessage && !session) {
    session = await handlePreKeyMessage(senderId, encrypted);
  }

  if (!session) {
    throw new Error('No session found and not a prekey message');
  }

  // Decrypt the message
  const { plaintext, updatedSession } = await crypto.decryptFromSession(
    session,
    encrypted
  );

  // Update session state
  await storage.saveSession(updatedSession);

  return plaintext;
}

/**
 * Handle incoming prekey message (establishes session from recipient's side)
 */
async function handlePreKeyMessage(
  senderId: string,
  encrypted: crypto.EncryptedMessage
): Promise<crypto.SessionState> {
  if (!currentUserId) {
    throw new Error('E2EE not initialized');
  }

  // Get our identity and signed prekey
  const identityKey = await storage.getIdentityKey();
  const signedPreKey = await storage.getActiveSignedPreKey();

  if (!identityKey || !signedPreKey) {
    throw new Error('Missing local keys');
  }

  // The sender's ephemeral key is in the encrypted message
  const senderEphemeralKey = crypto.decodeBase64(encrypted.senderPublicKey);

  // TODO: In a full implementation, we'd also need to know which one-time prekey
  // was used (if any) and look it up. For now, we'll proceed without it.

  // Perform X3DH from responder's side
  const sharedSecret = await crypto.x3dhRespond(
    identityKey,
    signedPreKey,
    null, // one-time prekey - would need to track this
    senderEphemeralKey, // Using ephemeral as identity for simplified impl
    senderEphemeralKey
  );

  // Initialize session
  const session = crypto.initializeSession(senderId, sharedSecret, senderEphemeralKey);

  await storage.saveSession(session);

  return session;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if E2EE is available for a specific user
 */
export async function canEncryptTo(userId: string): Promise<boolean> {
  try {
    const result = await api.checkUserHasE2EEKeys(userId);
    return result.has_keys;
  } catch {
    return false;
  }
}

/**
 * Check if we have a local session with a peer
 */
export async function hasSessionWith(peerId: string): Promise<boolean> {
  return await storage.hasSession(peerId);
}

/**
 * Reset E2EE (clear all local keys and sessions)
 */
export async function resetE2EE(): Promise<void> {
  await storage.clearAllE2EEData();
  isInitialized = false;
  currentUserId = null;
}

/**
 * Update PIN backup
 */
export async function updatePinBackup(userId: string, newPin: string): Promise<void> {
  const keys = await storage.exportAllKeys();
  if (!keys) {
    throw new Error('No keys to backup');
  }

  // Get one-time prekey private keys
  const oneTimePreKeys = await storage.getAllOneTimePreKeys();

  const backup = await crypto.encryptKeyBackup(
    {
      identityKey: crypto.decodeBase64(keys.identity.privateKey),
      signedPreKey: keys.signedPreKey
        ? crypto.decodeBase64(keys.signedPreKey.privateKey)
        : new Uint8Array(),
      oneTimePreKeys: oneTimePreKeys.map((pk) => pk.keyPair.privateKey),
    },
    newPin
  );

  await api.uploadE2EEKeyBackup(userId, backup);
}
