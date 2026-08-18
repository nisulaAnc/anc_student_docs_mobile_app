const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSecret(length = 20) {
  let secret = '';
  for (let i = 0; i < length; i += 1) {
    secret += BASE32_ALPHABET[Math.floor(Math.random() * BASE32_ALPHABET.length)];
  }
  return secret;
}

function generateEmailCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

function verifyEmailCode(expectedCode, enteredCode) {
  const expected = String(expectedCode || '').trim();
  const entered = String(enteredCode || '').trim();
  if (!expected || !entered || expected.length !== 6 || entered.length !== 6) return false;
  return expected === entered;
}

function base32ToBytes(secret) {
  const normalized = String(secret || '').toUpperCase().replace(/=+$/g, '');
  let bits = '';
  const bytes = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const value = BASE32_ALPHABET.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, '0');
  }

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    const chunk = bits.slice(i, i + 8);
    bytes.push(parseInt(chunk, 2));
  }

  return Uint8Array.from(bytes);
}

function generateTotp(secret, timestamp = Date.now(), digits = 6, period = 30) {
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret) return '';

  const counter = Math.floor(timestamp / 1000 / period);
  const buffer = Buffer.alloc(8);
  let value = counter;

  for (let i = 7; i >= 0; i -= 1) {
    buffer[i] = value & 0xff;
    value >>= 8;
  }

  const hmac = crypto.createHmac('sha1', Buffer.from(base32ToBytes(normalizedSecret)));
  hmac.update(buffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const code = binary % 10 ** digits;
  return String(code).padStart(digits, '0');
}

function verifyTotp(secret, code, window = 1, timestamp = Date.now(), period = 30, digits = 6) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode || normalizedCode.length !== digits) return false;

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = generateTotp(secret, timestamp + offset * period * 1000, digits, period);
    if (candidate === normalizedCode) return true;
  }
  return false;
}

function generateOtpAuthUri(label, secret, issuer = 'ANC Student Docs') {
  const safeLabel = encodeURIComponent(label);
  const safeIssuer = encodeURIComponent(issuer);
  const safeSecret = encodeURIComponent(String(secret || '').trim());
  return `otpauth://totp/${safeIssuer}:${safeLabel}?secret=${safeSecret}&issuer=${safeIssuer}&digits=6&period=30`;
}

module.exports = {
  generateSecret,
  generateEmailCode,
  verifyEmailCode,
  generateTotp,
  verifyTotp,
  generateOtpAuthUri,
};