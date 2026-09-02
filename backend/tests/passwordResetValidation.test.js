const test = require('node:test');
const assert = require('node:assert/strict');

const { validateResetPasswordPayload } = require('../utils/passwordResetValidation');

test('allows resetting a password without a token when email and password are valid', () => {
  const result = validateResetPasswordPayload({
    email: '  USER@EXAMPLE.COM  ',
    newPassword: 'Secure123',
    confirmPassword: 'Secure123',
  });

  assert.equal(result.valid, true);
  assert.equal(result.email, 'user@example.com');
  assert.equal(result.token, '');
  assert.equal(result.requiredToken, false);
});

test('rejects a password shorter than six characters', () => {
  const result = validateResetPasswordPayload({
    email: 'user@example.com',
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
  assert.equal(result.requiredToken, false);
});
