const crypto = require('crypto');

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

function getSigningSecret() {
  return process.env.JWT_SECRET || 'anc_student_docs_jwt_secret_2024';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');
}

function createResetToken(email, code, expiresAt = Date.now() + RESET_TOKEN_TTL_MS) {
  const encodedEmail = Buffer.from(normalizeEmail(email)).toString('base64url');
  const payload = `${encodedEmail}.${String(code)}.${expiresAt}`;
  return `${payload}.${signPayload(payload)}`;
}

function verifyResetToken(email, token) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 4) return false;

  const [encodedEmail, code, expiresAt, signature] = parts;
  if (!encodedEmail || !code || !/^\d+$/.test(expiresAt) || !signature) return false;
  let tokenEmail;
  try {
    tokenEmail = Buffer.from(encodedEmail, 'base64url').toString('utf8');
  } catch {
    return false;
  }
  if (tokenEmail !== normalizeEmail(email) || Number(expiresAt) <= Date.now()) return false;

  const payload = `${encodedEmail}.${code}.${expiresAt}`;
  const expected = signPayload(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

module.exports = { createResetToken, verifyResetToken, RESET_TOKEN_TTL_MS };