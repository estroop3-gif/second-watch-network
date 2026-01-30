/**
 * E2EE Module - End-to-End Encryption for Direct Messages
 *
 * This module implements Signal Protocol-style encryption:
 * - X25519 key exchange (Diffie-Hellman)
 * - Ed25519 signatures
 * - AES-256-GCM message encryption
 * - HKDF key derivation
 * - PIN-based key backup with PBKDF2
 *
 * Usage:
 *
 * // First-time setup
 * import { setupE2EE } from '@/lib/e2ee';
 * await setupE2EE(userId, pin);
 *
 * // Initialize on app startup
 * import { initializeE2EE, isE2EEInitialized } from '@/lib/e2ee';
 * const initialized = await initializeE2EE(userId);
 *
 * // Encrypt/decrypt messages
 * import { encryptMessage, decryptMessage } from '@/lib/e2ee';
 * const encrypted = await encryptMessage(recipientId, 'Hello!');
 * const decrypted = await decryptMessage(senderId, encrypted);
 *
 * // Check if encryption is available
 * import { canEncryptTo } from '@/lib/e2ee';
 * const canEncrypt = await canEncryptTo(recipientId);
 */

// Service exports (main API)
export {
  initializeE2EE,
  setupE2EE,
  recoverE2EE,
  encryptMessage,
  decryptMessage,
  canEncryptTo,
  hasSessionWith,
  resetE2EE,
  updatePinBackup,
  isE2EEInitialized,
  getE2EEUserId,
} from './service';

// Types
export type {
  EncryptedMessage,
  SessionState,
  IdentityKeyPair,
  SignedPreKey,
  OneTimePreKey,
  PreKeyBundle,
} from './crypto';

// Low-level crypto (for advanced usage)
export * as e2eeCrypto from './crypto';

// Storage (for advanced usage)
export * as e2eeStorage from './storage';

// Document encryption (AES-256-GCM for PDFs, fields, and key envelopes)
export * as documentCrypto from './documentCrypto';
