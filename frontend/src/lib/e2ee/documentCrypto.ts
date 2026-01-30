/**
 * Document-level E2EE Crypto
 * Uses Web Crypto API (AES-256-GCM) for encrypting documents and fields.
 * Key wrapping uses nacl.box for asymmetric encryption of document keys.
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

// Generate a random AES-256 key for document encryption
export async function generateDocumentKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

// Export a CryptoKey to raw bytes
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

// Import raw bytes as AES-256-GCM key
export async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt document bytes with AES-256-GCM
export async function encryptDocument(
  data: Uint8Array,
  key: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    data
  );
  return {
    ciphertext: encodeBase64(new Uint8Array(encrypted)),
    nonce: encodeBase64(nonce),
  };
}

// Decrypt document bytes
export async function decryptDocument(
  ciphertext: string,
  nonce: string,
  key: CryptoKey
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(nonce) },
    key,
    decodeBase64(ciphertext)
  );
  return new Uint8Array(decrypted);
}

// Encrypt document key for a recipient using nacl.box (X25519)
export function encryptKeyForRecipient(
  documentKeyRaw: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderPrivateKey: Uint8Array
): { encrypted: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(documentKeyRaw, nonce, recipientPublicKey, senderPrivateKey);
  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

// Decrypt document key from envelope
export function decryptDocumentKey(
  encryptedKey: string,
  nonce: string,
  senderPublicKey: Uint8Array,
  recipientPrivateKey: Uint8Array
): Uint8Array | null {
  const decrypted = nacl.box.open(
    decodeBase64(encryptedKey),
    decodeBase64(nonce),
    senderPublicKey,
    recipientPrivateKey
  );
  return decrypted;
}

// Encrypt a single field value (string)
export async function encryptField(
  value: string,
  key: CryptoKey
): Promise<{ encrypted_value: string; nonce: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    data
  );
  return {
    encrypted_value: encodeBase64(new Uint8Array(encrypted)),
    nonce: encodeBase64(nonce),
  };
}

// Decrypt a single field value
export async function decryptField(
  encryptedValue: string,
  nonce: string,
  key: CryptoKey
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(nonce) },
    key,
    decodeBase64(encryptedValue)
  );
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
