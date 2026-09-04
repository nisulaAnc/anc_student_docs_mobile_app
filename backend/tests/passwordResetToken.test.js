const test = require('node:test');
const assert = require('node:assert/strict');

const { createResetToken, verifyResetToken } = require('../utils/passwordResetToken');

test('accepts a signed reset token for the normalized email', () => {
  const token = createResetToken(' User@Example.com ', '12345678', Date.now() + 60000);

  assert.equal(verifyResetToken('user@example.com', token), true);
});

test('rejects reset tokens with the wrong email, expiry, or signature', () => {
  const token = createResetToken('user@example.com', '12345678', Date.now() + 60000);
  const expired = createResetToken('user@example.com', '12345678', Date.now() - 1);

  assert.equal(verifyResetToken('other@example.com', token), false);
  assert.equal(verifyResetToken('user@example.com', expired), false);
  assert.equal(verifyResetToken('user@example.com', `${token.slice(0, -1)}x`), false);
});