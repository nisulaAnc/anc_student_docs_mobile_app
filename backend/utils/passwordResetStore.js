const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'config', 'password-resets.json');
const memoryStore = {};

function readStore() {
  try {
    if (!fs.existsSync(storePath)) {
      return { ...memoryStore };
    }

    const raw = fs.readFileSync(storePath, 'utf8');
    const persisted = raw ? JSON.parse(raw) : {};
    const merged = { ...memoryStore, ...persisted };
    Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
    Object.assign(memoryStore, merged);
    return { ...merged };
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EROFS')) {
      return { ...memoryStore };
    }

    console.warn('Could not read password reset store:', error.message);
    return { ...memoryStore };
  }
}

function writeStore(data) {
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
    Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
    Object.assign(memoryStore, data);
    return true;
  } catch (error) {
    if (error && (error.code === 'EACCES' || error.code === 'EROFS')) {
      Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
      Object.assign(memoryStore, data);
      console.warn('Password reset store is using in-memory fallback because the filesystem is read-only:', error.message);
      return false;
    }

    throw error;
  }
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
