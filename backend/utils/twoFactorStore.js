const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'config', 'two-factor.json');

function readStore() {
  try {
    if (!fs.existsSync(storePath)) {
      return {};
    }
    const raw = fs.readFileSync(storePath, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

function getTwoFactorEntry(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  return store[normalized] || null;
}

function setTwoFactorEntry(email, payload) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  store[normalized] = {
    ...(store[normalized] || {}),
    ...payload,
    email: normalized,
  };
  writeStore(store);
  return store[normalized];
}

module.exports = {
  getTwoFactorEntry,
  setTwoFactorEntry,
};
