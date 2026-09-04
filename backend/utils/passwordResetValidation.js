function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateResetPasswordPayload(payload = {}) {
  const emailTrimmed = normalizeEmail(payload.email);
  const tokenTrimmed = String(payload.token ?? payload.resetCode ?? '').trim();
  const newPassword = String(payload.newPassword || '');
  const confirmPassword = String(payload.confirmPassword ?? payload.confirm ?? '');

  if (!emailTrimmed) {
    return { valid: false, error: 'Please enter your email address.', email: '', token: tokenTrimmed, requiredToken: true };
  }

  if (!tokenTrimmed) {
    return { valid: false, error: 'Please enter the reset code sent to your email.', email: emailTrimmed, token: '', requiredToken: true };
  }

  if (!newPassword) {
    return { valid: false, error: 'Please enter a new password.', email: emailTrimmed, token: tokenTrimmed, requiredToken: true };
  }

  if (newPassword.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters.', email: emailTrimmed, token: tokenTrimmed, requiredToken: true };
  }

  if (newPassword !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match.', email: emailTrimmed, token: tokenTrimmed, requiredToken: true };
  }

  return {
    valid: true,
    email: emailTrimmed,
    token: tokenTrimmed,
      newPassword,
    requiredToken: true,
  };
}

function validatePasswordChangePayload(payload = {}) {
  const emailTrimmed = normalizeEmail(payload.email);
  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');
  const confirmPassword = String(payload.confirmPassword ?? payload.confirm ?? '');

  if (!emailTrimmed) {
    return { valid: false, error: 'Please enter your email address.', email: '' };
  }

  if (!currentPassword) {
    return { valid: false, error: 'Please enter your current password.', email: emailTrimmed };
  }

  if (!newPassword) {
    return { valid: false, error: 'Please enter a new password.', email: emailTrimmed };
  }

  if (newPassword.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters.', email: emailTrimmed };
  }

  if (newPassword !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match.', email: emailTrimmed };
  }

  return {
    valid: true,
    email: emailTrimmed,
    currentPassword,
    newPassword,
  };
}

module.exports = { validateResetPasswordPayload, validatePasswordChangePayload };
