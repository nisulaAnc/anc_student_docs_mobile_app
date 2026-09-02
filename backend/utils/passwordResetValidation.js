function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateResetPasswordPayload(payload = {}) {
  const emailTrimmed = normalizeEmail(payload.email);
  const tokenTrimmed = String(payload.token || '').trim();
  const newPassword = String(payload.newPassword || '');
  const confirmPassword = String(payload.confirmPassword ?? payload.confirm ?? '');

  if (!emailTrimmed) {
    return { valid: false, error: 'Please enter your email address.', email: '', token: tokenTrimmed, requiredToken: false };
  }

  if (!newPassword) {
    return { valid: false, error: 'Please enter a new password.', email: emailTrimmed, token: tokenTrimmed, requiredToken: false };
  }

  if (newPassword.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters.', email: emailTrimmed, token: tokenTrimmed, requiredToken: false };
  }

  if (newPassword !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match.', email: emailTrimmed, token: tokenTrimmed, requiredToken: false };
  }

  return {
    valid: true,
    email: emailTrimmed,
    token: tokenTrimmed,
    requiredToken: false,
  };
}

module.exports = { validateResetPasswordPayload };
