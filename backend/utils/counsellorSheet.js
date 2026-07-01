function buildCounsellorSheetRow(existingRow = [], counsellor = {}) {
    const row = Array.isArray(existingRow) ? [...existingRow] : [];
    while (row.length < 6) row.push('');

    const name = counsellor.name || row[2] || '';
    const email = counsellor.email || row[4] || '';
    const pin = counsellor.pin || row[5] || '';

    row[2] = name;
    row[4] = email;
    row[5] = pin;
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

module.exports = { buildCounsellorSheetRow, resolveCounsellorPinReset };
