/**
 * E2EE Crypto Service
 * Implements Signal Protocol-style encryption using tweetnacl
 *
 * Key Types:
 * - Identity Key: Long-term Ed25519 signing key pair
 * - Signed PreKey: Medium-term X25519 key pair, signed by identity
 * - One-Time PreKeys: Single-use X25519 key pairs
 *
 * Algorithms:
 * - X25519 for key exchange (Diffie-Hellman)
 * - Ed25519 for signatures
 * - AES-256-GCM for message encryption
 * - HKDF for key derivation
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

// ============================================================================
// TYPES
// ============================================================================

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  registrationId: number;
}

export interface SignedPreKey {
  keyId: number;
  keyPair: KeyPair;
  signature: Uint8Array;
}

export interface OneTimePreKey {
  keyId: number;
  keyPair: KeyPair;
}

export interface PreKeyBundle {
  registrationId: number;
  identityKey: Uint8Array;
  signedPreKeyId: number;
  signedPreKey: Uint8Array;
  signedPreKeySignature: Uint8Array;
  oneTimePreKeyId?: number;
  oneTimePreKey?: Uint8Array;
}

export interface SessionState {
  peerId: string;
  rootKey: Uint8Array;
  chainKey: Uint8Array;
  messageNumber: number;
  peerPublicKey: Uint8Array;
  ourEphemeralKey?: KeyPair;
}

export interface EncryptedMessage {
  ciphertext: string; // Base64
  nonce: string; // Base64
  messageNumber: number;
  senderPublicKey: string; // Base64 - for prekey messages
  isPreKeyMessage: boolean;
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate a random registration ID (16-bit unsigned integer)
 */
export function generateRegistrationId(): number {
  const arr = new Uint16Array(1);
  crypto.getRandomValues(arr);
  return arr[0] & 0x3fff; // 14 bits
}

/**
 * Generate an Ed25519 identity key pair for signing
 */
export function generateIdentityKeyPair(): IdentityKeyPair {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey,
    registrationId: generateRegistrationId(),
  };
}

/**
 * Generate an X25519 key pair for key exchange
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey,
  };
}

/**
 * Generate a signed prekey (X25519 key signed by identity key)
 */
export function generateSignedPreKey(
  identityPrivateKey: Uint8Array,
  keyId: number
): SignedPreKey {
  const keyPair = generateKeyPair();
  const signature = nacl.sign.detached(keyPair.publicKey, identityPrivateKey);
  return {
    keyId,
    keyPair,
    signature,
  };
}

/**
 * Generate one-time prekeys
 */
export function generateOneTimePreKeys(
  startId: number,
  count: number
): OneTimePreKey[] {
  const prekeys: OneTimePreKey[] = [];
  for (let i = 0; i < count; i++) {
    prekeys.push({
      keyId: startId + i,
      keyPair: generateKeyPair(),
    });
  }
  return prekeys;
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify a signed prekey signature
 */
export function verifySignedPreKey(
  signedPreKey: Uint8Array,
  signature: Uint8Array,
  identityKey: Uint8Array
): boolean {
  return nacl.sign.detached.verify(signedPreKey, signature, identityKey);
}

// ============================================================================
// X3DH KEY AGREEMENT
// ============================================================================

/**
 * Perform X3DH key agreement as the initiator (Alice)
 * Returns the shared secret for session establishment
 */
export async function x3dhInitiate(
  ourIdentityKey: IdentityKeyPair,
  ourEphemeralKey: KeyPair,
  theirBundle: PreKeyBundle
): Promise<{ sharedSecret: Uint8Array; ephemeralPublicKey: Uint8Array }> {
  // Verify the signed prekey
  if (
    !verifySignedPreKey(
      theirBundle.signedPreKey,
      theirBundle.signedPreKeySignature,
      theirBundle.identityKey
    )
  ) {
    throw new Error('Invalid signed prekey signature');
  }

  // DH1: ourIdentity * theirSignedPreKey
  // Note: For Ed25519 identity key, we'd need to convert to X25519
  // For simplicity, we'll use the signing key directly (simplified implementation)
  // In production, use proper Ed25519->X25519 conversion

  // DH2: ourEphemeral * theirIdentity
  // DH3: ourEphemeral * theirSignedPreKey
  // DH4: ourEphemeral * theirOneTimePreKey (if available)

  // Simplified: Use nacl.box.before for shared secret
  const dh1 = nacl.box.before(theirBundle.signedPreKey, ourEphemeralKey.privateKey);

  let combinedSecret = dh1;

  if (theirBundle.oneTimePreKey) {
    const dh2 = nacl.box.before(theirBundle.oneTimePreKey, ourEphemeralKey.privateKey);
    // Combine DH outputs
    combinedSecret = new Uint8Array([...dh1, ...dh2]);
  }

  // Derive final shared secret using HKDF
  const sharedSecret = await hkdf(combinedSecret, 32, 'E2EE-Session');

  return {
    sharedSecret,
    ephemeralPublicKey: ourEphemeralKey.publicKey,
  };
}

/**
 * Perform X3DH key agreement as the responder (Bob)
 */
export async function x3dhRespond(
  ourIdentityKey: IdentityKeyPair,
  ourSignedPreKey: SignedPreKey,
  ourOneTimePreKey: OneTimePreKey | null,
  theirIdentityKey: Uint8Array,
  theirEphemeralKey: Uint8Array
): Promise<Uint8Array> {
  // Mirror the DH operations from initiator's perspective
  const dh1 = nacl.box.before(theirEphemeralKey, ourSignedPreKey.keyPair.privateKey);

  let combinedSecret = dh1;

  if (ourOneTimePreKey) {
    const dh2 = nacl.box.before(theirEphemeralKey, ourOneTimePreKey.keyPair.privateKey);
    combinedSecret = new Uint8Array([...dh1, ...dh2]);
  }

  return await hkdf(combinedSecret, 32, 'E2EE-Session');
}

// ============================================================================
// SYMMETRIC ENCRYPTION (AES-256-GCM)
// ============================================================================

/**
 * Encrypt a message using AES-256-GCM
 */
export async function encryptMessage(
  plaintext: string,
  key: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random nonce (12 bytes for GCM)
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    data
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    nonce,
  };
}

/**
 * Decrypt a message using AES-256-GCM
 */
export async function decryptMessage(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Promise<string> {
  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

// ============================================================================
// KEY DERIVATION (HKDF)
// ============================================================================

/**
 * Derive a key using HKDF
 */
export async function hkdf(
  inputKeyMaterial: Uint8Array,
  outputLength: number,
  info: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const infoBytes = encoder.encode(info);

  // Import input key material
  const ikm = await crypto.subtle.importKey(
    'raw',
    inputKeyMaterial,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // Derive key
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32), // Using zero salt for simplicity
      info: infoBytes,
    },
    ikm,
    outputLength * 8
  );

  return new Uint8Array(derivedBits);
}

// ============================================================================
// SIMPLE RATCHET (Simplified Double Ratchet)
// ============================================================================

/**
 * Derive next chain key and message key from current chain key
 */
export async function ratchetChainKey(
  chainKey: Uint8Array
): Promise<{ nextChainKey: Uint8Array; messageKey: Uint8Array }> {
  const nextChainKey = await hkdf(chainKey, 32, 'chain');
  const messageKey = await hkdf(chainKey, 32, 'message');
  return { nextChainKey, messageKey };
}

/**
 * Initialize a new session state after X3DH
 */
export function initializeSession(
  peerId: string,
  sharedSecret: Uint8Array,
  peerPublicKey: Uint8Array
): SessionState {
  return {
    peerId,
    rootKey: sharedSecret,
    chainKey: sharedSecret, // Initial chain key = root key
    messageNumber: 0,
    peerPublicKey,
  };
}

// ============================================================================
// HIGH-LEVEL ENCRYPTION/DECRYPTION
// ============================================================================

/**
 * Encrypt a message for sending
 */
export async function encryptForSession(
  session: SessionState,
  plaintext: string,
  isPreKeyMessage: boolean = false,
  senderPublicKey?: Uint8Array
): Promise<{ encrypted: EncryptedMessage; updatedSession: SessionState }> {
  // Get message key from chain
  const { nextChainKey, messageKey } = await ratchetChainKey(session.chainKey);

  // Encrypt message
  const { ciphertext, nonce } = await encryptMessage(plaintext, messageKey);

  const encrypted: EncryptedMessage = {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    messageNumber: session.messageNumber,
    senderPublicKey: senderPublicKey ? encodeBase64(senderPublicKey) : '',
    isPreKeyMessage,
  };

  const updatedSession: SessionState = {
    ...session,
    chainKey: nextChainKey,
    messageNumber: session.messageNumber + 1,
  };

  return { encrypted, updatedSession };
}

/**
 * Decrypt a received message
 */
export async function decryptFromSession(
  session: SessionState,
  encrypted: EncryptedMessage
): Promise<{ plaintext: string; updatedSession: SessionState }> {
  // Get message key from chain
  const { nextChainKey, messageKey } = await ratchetChainKey(session.chainKey);

  // Decrypt message
  const ciphertext = decodeBase64(encrypted.ciphertext);
  const nonce = decodeBase64(encrypted.nonce);
  const plaintext = await decryptMessage(ciphertext, nonce, messageKey);

  const updatedSession: SessionState = {
    ...session,
    chainKey: nextChainKey,
    messageNumber: session.messageNumber + 1,
  };

  return { plaintext, updatedSession };
}

// ============================================================================
// PIN-BASED KEY BACKUP
// ============================================================================

/**
 * Derive encryption key from PIN using PBKDF2
 */
export async function deriveKeyFromPin(
  pin: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);

  // Import PIN as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive key using PBKDF2 with 100,000 iterations
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  return new Uint8Array(derivedBits);
}

/**
 * Encrypt private keys for backup with PIN
 */
export async function encryptKeyBackup(
  privateKeys: {
    identityKey: Uint8Array;
    signedPreKey: Uint8Array;
    oneTimePreKeys: Uint8Array[];
  },
  pin: string
): Promise<{ encryptedData: string; salt: string; iv: string }> {
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(32));

  // Derive encryption key from PIN
  const key = await deriveKeyFromPin(pin, salt);

  // Serialize private keys
  const encoder = new TextEncoder();
  const data = encoder.encode(
    JSON.stringify({
      identityKey: encodeBase64(privateKeys.identityKey),
      signedPreKey: encodeBase64(privateKeys.signedPreKey),
      oneTimePreKeys: privateKeys.oneTimePreKeys.map((k) => encodeBase64(k)),
    })
  );

  // Encrypt
  const { ciphertext, nonce } = await encryptMessage(
    new TextDecoder().decode(data),
    key
  );

  return {
    encryptedData: encodeBase64(ciphertext),
    salt: encodeBase64(salt),
    iv: encodeBase64(nonce),
  };
}

/**
 * Decrypt key backup with PIN
 */
export async function decryptKeyBackup(
  encryptedData: string,
  salt: string,
  iv: string,
  pin: string
): Promise<{
  identityKey: Uint8Array;
  signedPreKey: Uint8Array;
  oneTimePreKeys: Uint8Array[];
}> {
  // Derive encryption key from PIN
  const key = await deriveKeyFromPin(pin, decodeBase64(salt));

  // Decrypt
  const plaintext = await decryptMessage(
    decodeBase64(encryptedData),
    decodeBase64(iv),
    key
  );

  // Parse private keys
  const parsed = JSON.parse(plaintext);
  return {
    identityKey: decodeBase64(parsed.identityKey),
    signedPreKey: decodeBase64(parsed.signedPreKey),
    oneTimePreKeys: parsed.oneTimePreKeys.map((k: string) => decodeBase64(k)),
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export { encodeBase64, decodeBase64 };
