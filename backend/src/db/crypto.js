import { createHash, randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

export function generateSalt() {
  return randomBytes(SALT_LENGTH).toString('base64');
}

export function deriveKey(pin, saltBase64) {
  const salt = Buffer.from(saltBase64, 'base64');
  return scryptSync(pin, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
}

export function encrypt(plaintext, key) {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LENGTH });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, tag]);
  
  return {
    ciphertext: combined.toString('base64'),
    nonce: nonce.toString('base64')
  };
}

export function decrypt(ciphertextBase64, nonceBase64, key) {
  const combined = Buffer.from(ciphertextBase64, 'base64');
  const nonce = Buffer.from(nonceBase64, 'base64');
  
  const ciphertext = combined.slice(0, combined.length - TAG_LENGTH);
  const tag = combined.slice(combined.length - TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
}

export function hashPin(pin) {
  // Simple SHA-256 for PIN verification (PIN itself is used for key derivation)
  return createHash('sha256').update(pin + 'pin-verification-suffix').digest('hex');
}
