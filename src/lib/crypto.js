const crypto = require('crypto');

/**
 * AES-256-GCM encryption for API keys stored at rest in Firestore.
 *
 * The encryption key is read from `SETTINGS_ENCRYPTION_KEY` and must be
 * exactly 32 bytes (64 hex characters). If the variable is missing,
 * encrypt/decrypt become transparent passthroughs so existing deployments
 * keep working while the key is being provisioned.
 *
 * Ciphertext format: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 * This prefix lets `isEncrypted()` distinguish encrypted values from
 * plaintext keys that were stored before this module was introduced.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const PREFIX = 'enc:v1:';

/**
 * Returns the 32-byte encryption key derived from the env var, or null
 * if encryption is not configured.
 *
 * @returns {Buffer|null}
 */
function getEncryptionKey() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;
  // Accept hex-encoded (64 chars) or raw 32-byte string
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  if (raw.length === 32) {
    return Buffer.from(raw, 'utf8');
  }
  console.error('[ContextLens] SETTINGS_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Encryption disabled.');
  return null;
}

/**
 * Returns true if the value looks like an encrypted ciphertext string.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns the ciphertext string, or the original value if encryption is
 * not configured.
 *
 * @param {string} plaintext - The value to encrypt.
 * @returns {string} The ciphertext (prefixed) or original value.
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  if (isEncrypted(plaintext)) return plaintext; // already encrypted

  const key = getEncryptionKey();
  if (!key) return plaintext; // passthrough when key not configured

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext string back to plaintext.
 * Returns the original value if it's not encrypted or if decryption
 * is not configured.
 *
 * @param {string} ciphertext - The value to decrypt.
 * @returns {string} The decrypted plaintext or original value.
 */
function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  if (!isEncrypted(ciphertext)) return ciphertext; // plaintext passthrough

  const key = getEncryptionKey();
  if (!key) {
    console.warn('[ContextLens] Cannot decrypt: SETTINGS_ENCRYPTION_KEY not set.');
    return ciphertext; // can't decrypt without the key
  }

  try {
    // Strip prefix and split parts
    const payload = ciphertext.slice(PREFIX.length);
    const [ivHex, authTagHex, encryptedHex] = payload.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[ContextLens] Decryption failed — key may have been rotated:', err.message);
    return ciphertext; // return raw to avoid data loss
  }
}

module.exports = { encrypt, decrypt, isEncrypted };
