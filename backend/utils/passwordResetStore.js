const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'config', 'password-resets.json');

function readStore() {
  try {
    if (!fs.existsSync(storePath)) return {};
    const raw = fs.readFileSync(storePath, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

function setResetToken(email, token, expiresAt) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  store[normalized] = { token, expiresAt: expiresAt || Date.now() + 1000 * 60 * 60 }; // 1 hour default
  writeStore(store);
  return store[normalized];
}

function getResetEntry(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  const entry = store[normalized] || null;
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    delete store[normalized];
    writeStore(store);
    return null;
  }
  return entry;
}

function clearResetEntry(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  delete store[normalized];
  writeStore(store);
  return true;
}

module.exports = { setResetToken, getResetEntry, clearResetEntry };
