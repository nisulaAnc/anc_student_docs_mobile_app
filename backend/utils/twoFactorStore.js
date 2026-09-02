const TwoFactorEntry = require('../models/TwoFactorEntry');

/**
 * Retrieve a 2FA entry for the given email.
 * Returns null if not found.
 */
async function getTwoFactorEntry(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  try {
    const doc = await TwoFactorEntry.findOne({ email: normalized }).lean();
    return doc || null;
  } catch (err) {
    console.error('getTwoFactorEntry error:', err.message);
    return null;
  }
}

/**
 * Upsert a 2FA entry for the given email, merging the given payload.
 */
async function setTwoFactorEntry(email, payload) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  try {
    const doc = await TwoFactorEntry.findOneAndUpdate(
      { email: normalized },
      { $set: { ...payload, email: normalized } },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    return doc;
  } catch (err) {
    console.error('setTwoFactorEntry error:', err.message);
    return null;
  }
}

module.exports = {
  getTwoFactorEntry,
  setTwoFactorEntry,
};
