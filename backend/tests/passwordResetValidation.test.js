const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { validateResetPasswordPayload } = require('../utils/passwordResetValidation');
const passwordResetStore = require('../utils/passwordResetStore');

test('requires a reset code when resetting a password', () => {
  const result = validateResetPasswordPayload({
    email: '  USER@EXAMPLE.COM  ',
    newPassword: 'Secure123',
    confirmPassword: 'Secure123',
  });

  assert.equal(result.valid, false);
  assert.equal(result.email, 'user@example.com');
  assert.equal(result.token, '');
  assert.equal(result.requiredToken, true);
  assert.equal(result.error, 'Please enter the reset code sent to your email.');
});

test('rejects a password shorter than six characters', () => {
  const result = validateResetPasswordPayload({
    email: 'user@example.com',
    token: 'ABC123',
    newPassword: '123',
    confirmPassword: '123',
  });

  assert.equal(result.valid, false);
  assert.equal(result.error, 'Password must be at least 6 characters.');
});

test('accepts a token when one is supplied', () => {
  const result = validateResetPasswordPayload({
    email: 'user@example.com',
    token: ' ABC123 ',
    newPassword: 'Secure123',
    confirmPassword: 'Secure123',
  });

  assert.equal(result.valid, true);
  assert.equal(result.token, 'ABC123');
  assert.equal(result.requiredToken, true);
});

test('keeps password reset tokens usable when the filesystem is read-only', () => {
  const originalWriteFileSync = fs.writeFileSync;
  const originalReadFileSync = fs.readFileSync;
  const originalExistsSync = fs.existsSync;

  fs.writeFileSync = () => {
    const err = new Error('EROFS: read-only file system');
    err.code = 'EROFS';
    throw err;
  };
  fs.readFileSync = () => '{}';
  fs.existsSync = () => true;

  try {
    const entry = passwordResetStore.setResetToken('User@Example.com', 'abc123', Date.now() + 3600000);

    assert.equal(entry.token, 'abc123');
    assert.equal(passwordResetStore.getResetEntry('user@example.com').token, 'abc123');
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.readFileSync = originalReadFileSync;
    fs.existsSync = originalExistsSync;
  }
});
