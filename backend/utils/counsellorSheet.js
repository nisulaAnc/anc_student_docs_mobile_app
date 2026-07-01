function normalizeHeader(value = '') {
    return String(value || '').trim().toLowerCase();
}

function getCounsellorFieldIndexes(headers = []) {
    const normalizedHeaders = Array.isArray(headers) ? headers.map((header) => normalizeHeader(header)) : [];

    const findIndex = (aliases) => {
        for (const alias of aliases) {
            const index = normalizedHeaders.findIndex((header) => header === alias || header.includes(alias));
            if (index >= 0) return index;
        }
        return null;
    };

    return {
        //nameIndex: findIndex(['full name', 'name', 'counsellor name', 'full-name', 'full_name']),
        nameIndex: findIndex(['full name', 'Display Name']),
        emailIndex: findIndex(['email', 'email address', 'counsellor email', 'e-mail']),
        pinIndex: findIndex(['pin', 'pin number', 'password', 'security pin']),
    };
}

function buildCounsellorSheetRow(existingRow = [], counsellor = {}, headers = []) {
    const row = Array.isArray(existingRow) ? [...existingRow] : [];
    const indexes = getCounsellorFieldIndexes(headers);

    const nameIndex = indexes.nameIndex ?? 2;
    const emailIndex = indexes.emailIndex ?? 4;
    const pinIndex = indexes.pinIndex ?? 5;

    while (row.length <= Math.max(nameIndex, emailIndex, pinIndex, 5)) {
        row.push('');
    }

    const name = counsellor.name || row[nameIndex] || '';
    const email = counsellor.email || row[emailIndex] || '';
    const pin = counsellor.pin || row[pinIndex] || '';

    row[nameIndex] = name;
    row[emailIndex] = email;
    row[pinIndex] = pin;
    return row;
}

function resolveCounsellorPinReset(existingCounsellor = {}, payload = {}) {
    const email = String(payload.email || '').trim().toLowerCase();
    const nextPin = String(payload.newPin || payload.pin || '').trim();
    const oldPin = String(payload.oldPin || '').trim();

    if (!email) {
        throw new Error('Counsellor email is required.');
    }

    if (!nextPin) {
        throw new Error('A new 6-digit PIN is required.');
    }

    if (existingCounsellor && oldPin) {
        const existingPin = String(existingCounsellor.pin || '').trim();
        if (existingPin && existingPin !== oldPin) {
            throw new Error('Old PIN is incorrect.');
        }
    }

    return { email, pin: nextPin };
}

module.exports = { buildCounsellorSheetRow, getCounsellorFieldIndexes, resolveCounsellorPinReset };
