const jwt = require('jsonwebtoken');

function getCounsellorPinMap() {
    const raw = process.env.COUNSELLOR_PIN_MAP || '';
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) { }
    return {};
}

function resolveCounsellorPin(counsellor, fallbackPin = '112233') {
    const pinMap = getCounsellorPinMap();
    const candidate = counsellor?.pin ?? counsellor?.pinNumber ?? counsellor?.PIN ?? null;
    if (candidate !== null && candidate !== undefined && candidate !== '') {
        return String(candidate);
    }

    const name = counsellor?.name?.trim();
    const email = counsellor?.email?.trim();
    if (name && pinMap[name]) return String(pinMap[name]);
    if (name && pinMap[name.toLowerCase()]) return String(pinMap[name.toLowerCase()]);
    if (email && pinMap[email]) return String(pinMap[email]);
    if (email && pinMap[email.toLowerCase()]) return String(pinMap[email.toLowerCase()]);

    return String(fallbackPin ?? '112233');
}

function buildCounsellorSession(counsellor) {
    const normalizedRole = counsellor?.role || '';
    const lastLogin = counsellor?.lastLogin || counsellor?.last_login || new Date().toISOString();

    return {
        id: counsellor?.email || counsellor?.name || 'counsellor',
        name: counsellor?.name || '',
        email: counsellor?.email || '',
        role: normalizedRole,
        lastLogin,
        twoFactorEnabled: !!(counsellor?.twoFactorEnabled || counsellor?.two_fa_enabled),
    };
}

function issueCounsellorToken(counsellor) {
    const payload = buildCounsellorSession(counsellor);
    return jwt.sign(payload, process.env.JWT_SECRET || 'anc_student_docs_jwt_secret_2024', {
        expiresIn: '8h',
    });
}

function verifyCounsellorToken(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'anc_student_docs_jwt_secret_2024');
    } catch (_) {
        return null;
    }
}

module.exports = {
    resolveCounsellorPin,
    buildCounsellorSession,
    issueCounsellorToken,
    verifyCounsellorToken,
};
