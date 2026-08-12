const { v4: uuidv4 } = require('uuid');
const CfToken = require('../models/CfToken');
const StudentToken = require('../models/StudentToken');
const Submission = require('../models/Submission');
const { getCounsellors, sheetAppend, SHEETS, upsertCounsellorRecord } = require('../config/googleSheets');
const { getDocumentsForProduct } = require('../utils/productDocuments');
const { sendEmail, emailHtml } = require('../utils/email');
const { resolveCounsellorPin, buildCounsellorSession, issueCounsellorToken, verifyCounsellorToken } = require('../utils/counsellorAuth');
const { resolveCounsellorPinReset } = require('../utils/counsellorSheet');
const { generateSecret, generateOtpAuthUri, verifyTotp } = require('../utils/twoFactor');
const { getTwoFactorEntry, setTwoFactorEntry } = require('../utils/twoFactorStore');
const { setResetToken, getResetEntry, clearResetEntry } = require('../utils/passwordResetStore');

// GET /api/cf/counsellors
const getCounsellorList = async (req, res) => {
  const counsellors = await getCounsellors();
  res.json({ success: true, data: counsellors });
};

// POST /api/cf/register
// Body: { cf_number, student_name, student_email, counsellor_name }
const registerCF = async (req, res) => {
  const { cf_number, student_name, student_email, counsellor_name } = req.body;
  if (!cf_number || !student_name || !student_email || !counsellor_name) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const counsellors = await getCounsellors();
  const counsellor = counsellors.find(
    (c) => c.name.toLowerCase() === counsellor_name.toLowerCase()
  );
  if (!counsellor) {
    return res.status(400).json({ success: false, message: 'Counsellor not found.' });
  }

  const token = String(Math.floor(10000000 + Math.random() * 90000000));

  // Save to MongoDB
  const cfToken = await CfToken.create({
    token,
    cf_number,
    student_name,
    student_email,
    counsellor_name: counsellor.name,
    counsellor_email: counsellor.email,
  });

  // Sync to Google Sheet
  try {
    await sheetAppend(SHEETS.CF_TOKENS, [
      token, cf_number, student_name, student_email,
      counsellor.name, counsellor.email,
      new Date().toISOString(), 'pending', '', '', 'otp_request',
    ]);
  } catch (err) {
    console.error('Sheet sync error (CF):', err.message);
  }

  // Email counsellor
  const portalUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/counsellor?token=${token}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(portalUrl)}`;

  const html = emailHtml(
    'New Student Registration',
    `<p style="font-size:15px;color:#334155;line-height:1.7;">
      Dear <strong>${counsellor.name}</strong>,<br><br>
      A new student registration requires your action.<br><br>
      <strong>Student Name:</strong> ${student_name}<br>
      <strong>Student Email:</strong> ${student_email}<br>
      <strong>CF Number:</strong> ${cf_number}<br><br>
      Please scan the QR code below using the <strong>ANC Student Docs Mobile App</strong> or click the button to verify and select the student's programme.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <img src="${qrUrl}" alt="QR Code" width="180" height="180" style="border:4px solid #fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
      <div style="margin-top:16px;font-size:13px;color:#64748B;">
        Or enter this token manually:<br>
        <strong style="font-family:monospace;font-size:16px;color:#0A2463;letter-spacing:2px;display:inline-block;margin-top:6px;padding:8px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">${token}</strong>
      </div>
    </div>`,
    'Open Counsellor Portal',
    portalUrl
  );

  try {
    await sendEmail(counsellor.email, 'ANC Student Docs – Action Required', html);
  } catch (err) {
    console.error('Email send error:', err.message);
  }

  res.json({ success: true, message: 'Registration submitted. Counsellor has been notified.', token });
};

// GET /api/cf/counsellor/token-info?token=xxx
const getCounsellorTokenInfo = async (req, res) => {
  const { token } = req.query;
  const cfToken = await CfToken.findOne({ token });
  if (!cfToken) return res.status(404).json({ success: false, message: 'Token not found.' });
  res.json({ success: true, data: cfToken });
};

// POST /api/cf/counsellor/register
// Body: { name, email, pin }
const registerCounsellorAccount = async (req, res) => {
  try {
    const { name, email, pin } = req.body;
    if (!name || !email || !pin) {
      return res.status(400).json({ success: false, message: 'Name, email and PIN are required.' });
    }

    const result = await upsertCounsellorRecord({ name, email, pin });
    return res.json({ success: true, message: 'Counsellor account saved.', data: { created: result.created, email } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to save counsellor account.' });
  }
};

// POST /api/cf/counsellor/reset-pin
// Body: { email, oldPin, newPin } or { email, pin }
const resetCounsellorPin = async (req, res) => {
  try {
    const { email, oldPin, pin, newPin } = req.body;
    const counsellors = await getCounsellors();
    const existingCounsellor = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());

    if (!existingCounsellor) {
      return res.status(404).json({ success: false, message: 'Counsellor not found.' });
    }

    const resetPayload = resolveCounsellorPinReset(existingCounsellor, { email, oldPin, pin, newPin });
    const result = await upsertCounsellorRecord({ name: existingCounsellor.name, email: resetPayload.email, pin: resetPayload.pin });
    return res.json({ success: true, message: 'PIN updated successfully.', data: { updated: !result.created, email: resetPayload.email } });
  } catch (err) {
    const statusCode = err.message === 'Old PIN is incorrect.' ? 401 : 400;
    return res.status(statusCode).json({ success: false, message: err.message || 'Failed to reset PIN.' });
  }
};

// POST /api/cf/verify-pin
// Body: { pin, type, counsellor, otp, staffEmail } (type can be 'cf' or 'counsellor')
const verifyCfPin = async (req, res) => {
  const { pin, type, counsellor, otp, staffEmail } = req.body;
  const correctCfPin = process.env.CF_PIN;
  const fallbackCounsellorPin = process.env.COUNSELLOR_PIN || '112233';

  if (type === 'counsellor') {
    const correctCounsellorPin = resolveCounsellorPin(counsellor, fallbackCounsellorPin);
    if (!pin || String(pin).trim() !== String(correctCounsellorPin).trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect Counsellor PIN. Access denied.' });
    }

    const emailForTwoFactor = staffEmail || counsellor?.email || null;
    if (emailForTwoFactor) {
      const storeEntry = getTwoFactorEntry(emailForTwoFactor);
      if (storeEntry?.enabled && storeEntry?.secret) {
        if (!otp || !verifyTotp(storeEntry.secret, otp)) {
          return res.status(401).json({ success: false, message: 'Invalid authenticator code.' });
        }
      }
    }

    const session = buildCounsellorSession(counsellor);
    const token = issueCounsellorToken(counsellor);
    return res.json({
      success: true,
      message: 'Counsellor PIN verified.',
      role: 'counsellor',
      token,
      counsellor: session,
    });
  } else {
    if (!correctCfPin) {
      return res.status(400).json({ success: false, message: 'CF PIN not configured on server.' });
    }
    if (!pin || String(pin).trim() !== String(correctCfPin).trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect Staff PIN. Access denied.' });
    }

    if (staffEmail) {
      const storeEntry = getTwoFactorEntry(staffEmail);
      if (storeEntry?.enabled && storeEntry?.secret) {
        if (!otp || !verifyTotp(storeEntry.secret, otp)) {
          return res.status(401).json({ success: false, message: 'Invalid authenticator code.' });
        }
      }
    }

    return res.json({ success: true, message: 'Staff PIN verified.', role: 'cf' });
  }
};

// POST /api/cf/two-factor/setup
const setupTwoFactor = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const counsellors = await getCounsellors();
    const existing = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email).trim().toLowerCase());
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Counsellor not found.' });
    }

    const secret = generateSecret(20);
    const label = `${name || existing.name || 'Counsellor'}:${email}`;
    const otpauthUri = generateOtpAuthUri(label, secret, 'ANC Student Docs');

    return res.json({
      success: true,
      data: {
        secret,
        qr_code_uri: otpauthUri,
        manual_code: secret,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to configure 2FA.' });
  }
};

// POST /api/cf/two-factor/enable
const enableTwoFactor = async (req, res) => {
  try {
    const { email, secret, otp, enabled } = req.body;
    if (!email || !secret || !otp) {
      return res.status(400).json({ success: false, message: 'Email, secret and OTP are required.' });
    }

    if (!verifyTotp(secret, otp)) {
      return res.status(401).json({ success: false, message: 'The authenticator code is invalid.' });
    }

    const counsellors = await getCounsellors();
    const existing = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email).trim().toLowerCase());
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Counsellor not found.' });
    }

    const result = await upsertCounsellorRecord({
      name: existing.name,
      email,
      pin: existing.pin,
      two_factor_enabled: enabled !== false,
      two_factor_secret: secret,
    });

    setTwoFactorEntry(email, {
      enabled: enabled !== false,
      secret,
    });

    return res.json({ success: true, message: enabled === false ? '2FA disabled.' : '2FA enabled.', data: { created: result.created, email } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to update 2FA setting.' });
  }
};

// GET /api/cf/dashboard-stats
const getDashboardStats = async (req, res) => {
  try {
    const { counsellor_name, counsellor_email, counsellor_token } = req.query;
    const filter = {};
    const session = verifyCounsellorToken(counsellor_token);

    if (counsellor_token && session?.email) {
      filter.counsellor_email = session.email;
    } else if (counsellor_email) {
      filter.counsellor_email = counsellor_email;
    } else if (counsellor_name) {
      filter.counsellor_name = { $regex: new RegExp('^' + counsellor_name.trim() + '$', 'i') };
    }

    // 1. Filtered student tokens registered for this dashboard view
    const studentTokens = await StudentToken.find(filter);
    const totalStudents = studentTokens.length;
    const studentTokenValues = studentTokens.map((token) => token.token);

    // 2. Submissions only for the filtered student tokens
    const submissions = studentTokenValues.length
      ? await Submission.find({ token: { $in: studentTokenValues } })
      : [];
    const totalUploadedDocuments = submissions.reduce(
      (acc, sub) => acc + (sub.documents?.length || 0) + (sub.agreement_url ? 1 : 0),
      0
    );

    // 3. Count completed (status = 'complete') vs pending/missing (status = 'partial' or no submission yet)
    // Map existing submissions by token
    const submissionMap = {};
    submissions.forEach(sub => {
      submissionMap[sub.token] = sub;
    });
    let completedCount = 0;
    let pendingCount = 0;
    const studentStatuses = [];

    for (const token of studentTokens) {
      const sub = submissionMap[token.token];
      const requiredDocs = getDocumentsForProduct(token.product_code);
      const totalRequired = requiredDocs.length + 1; // +1 for agreement

      let uploadedDocs = [];
      let missingDocs = [...requiredDocs];
      let hasAgreement = false;
      let isComplete = false;

      if (sub) {
        isComplete = sub.status === 'complete';
        if (sub.documents) {
          uploadedDocs = sub.documents.map(d => d.label);
          missingDocs = requiredDocs.filter(d => !uploadedDocs.some(u => u.toLowerCase() === d.toLowerCase()));
        }
        hasAgreement = !!sub.agreement_url;
        if (!hasAgreement) {
          missingDocs.push('Agreement (signed)');
        }
      } else {
        missingDocs.push('Agreement (signed)');
      }

      if (isComplete) {
        completedCount++;
      } else {
        pendingCount++;
      }

      studentStatuses.push({
        token: token.token,
        cf_number: token.cf_number,
        student_name: token.student_name,
        student_email: token.student_email,
        counsellor_name: token.counsellor_name,
        program: token.program,
        status: isComplete ? 'complete' : 'pending',
        uploaded_documents: uploadedDocs,
        missing_documents: missingDocs,
        uploaded_count: sub ? (sub.documents?.length || 0) + (hasAgreement ? 1 : 0) : 0,
        required_count: totalRequired
      });
    }

    res.json({
      success: true,
      data: {
        total_students: totalStudents,
        total_uploaded_documents: totalUploadedDocuments,
        completed_students: completedCount,
        pending_students: pendingCount,
        student_list: studentStatuses
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/cf/send-reminder
// Body: { token }
const sendReminderEmail = async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Student token is required.' });
  }

  try {
    const studentToken = await StudentToken.findOne({ token });
    if (!studentToken) {
      return res.status(404).json({ success: false, message: 'Student token not found.' });
    }

    const sub = await Submission.findOne({ token });
    const requiredDocs = getDocumentsForProduct(studentToken.product_code);
    let missingDocs = [...requiredDocs];
    let uploadedDocs = [];

    if (sub) {
      if (sub.documents) {
        uploadedDocs = sub.documents.map(d => d.label);
        missingDocs = requiredDocs.filter(d => !uploadedDocs.some(u => u.toLowerCase() === d.toLowerCase()));
      }
      if (!sub.agreement_url) {
        missingDocs.push('Agreement (signed)');
      }
    } else {
      missingDocs.push('Agreement (signed)');
    }

    if (missingDocs.length === 0) {
      return res.status(400).json({ success: false, message: 'Student has already submitted all required documents.' });
    }

    const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
    const studentUrl = `${BASE_URL}/student?token=${token}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(studentUrl)}`;

    const missingList = missingDocs.map((d) => `<li>${d}</li>`).join('');
    const uploadedList = uploadedDocs.map((d) => `<li>${d}</li>`).join('');

    const html = emailHtml(
      'Action Required – Pending Documents Reminder',
      `<p style="font-size:15px;color:#334155;line-height:1.7;">
        Dear <strong>${studentToken.student_name}</strong>,<br><br>
        This is a friendly reminder to submit your pending documents for your registration in <strong>${studentToken.degree_description || studentToken.program}</strong>.<br><br>
        Your registration is currently <strong style="color:#DC2626;">incomplete</strong>. Please use the secure link below to upload the missing documents.
      </p>
      ${uploadedList ? `<p style="font-size:14px;font-weight:700;color:#16A34A;margin:16px 0 6px;">Documents Received:</p>
      <ul style="color:#16A34A;font-size:14px;line-height:2;">${uploadedList}</ul>` : ''}
      <p style="font-size:14px;font-weight:700;color:#DC2626;margin:16px 0 6px;">
        Missing Documents (${missingDocs.length}):
      </p>
      <ul style="color:#DC2626;font-size:14px;line-height:2;">${missingList}</ul>
      <div style="text-align:center;margin:24px 0;">
        <img src="${qrUrl}" alt="QR Code" width="180" height="180" style="border:4px solid #fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
        <div style="margin-top:16px;font-size:13px;color:#64748B;">
          Or enter this token manually inside the app:<br>
          <strong style="font-family:monospace;font-size:16px;color:#0A2463;letter-spacing:2px;display:inline-block;margin-top:6px;padding:8px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">${token}</strong>
        </div>
      </div>`,
      'Upload Missing Documents →',
      studentUrl
    );

    await sendEmail(studentToken.student_email, 'ANC Student Docs – Reminder: Pending Documents', html);

    res.json({ success: true, message: `Reminder email successfully sent to ${studentToken.student_email}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/cf/staff/register
// Body: { name, email, password, role }
const registerStaff = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    // Validate role
    const normalizedRole = String(role || '').trim().toLowerCase();
    const validRoles = ['center function', 'counsellor'];
    if (role && !validRoles.some((r) => normalizedRole.includes(r))) {
      return res.status(400).json({ success: false, message: `Invalid role "${role}". Must be Center Function or Counsellor.` });
    }

    // Check if counsellor exists in the sheet
    const counsellors = await getCounsellors();
    const existing = counsellors.find(
      (c) => String(c.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'This email is not in the approved staff list. Contact the administrator.' });
    }

    const result = await upsertCounsellorRecord({ name: existing.name, email, password, role: existing.role || role });
    const finalRole = existing.role || role || 'counsellor';

    // Send verification/confirmation email
    try {
      const html = emailHtml(
        'Your Account is Verified',
        `<p style="font-size:15px;color:#334155;line-height:1.8;">Dear <strong>${existing.name}</strong>,<br/><br/>
        Your account has been successfully created and <strong style="color:#16A34A;">verified</strong>.
        You can now log in to the <strong>ANC Student Docs</strong> mobile app using your registered credentials.<br/><br/>
        <strong>Name:</strong> ${existing.name}<br/>
        <strong>Email:</strong> ${email}<br/>
        <strong>Role:</strong> ${finalRole}<br/><br/>
        If you did not create this account, please contact the administrator immediately.</p>`
      );
      await sendEmail(email, 'ANC Student Docs - Your Account is Verified', html);
    } catch (e) {
      console.error('Email send error (registerStaff):', e.message);
    }

    const token = issueCounsellorToken({ name: existing.name, email, role: finalRole });
    return res.json({
      success: true,
      message: 'Your account has been verified. Welcome to ANC Student Docs!',
      token,
      email,
      role: finalRole,
      counsellor: { name: existing.name, email, role: finalRole },
      created: result.created,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to register account.' });
  }
};

// POST /api/cf/staff/login
// Body: { email, password, otp }
const loginStaff = async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const counsellors = await getCounsellors();
    const existing = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());
    if (!existing) return res.status(404).json({ success: false, message: 'Account not found. Please register first.' });

    const stored = String(existing.pin || existing.password || '').trim();
    if (!stored) {
      return res.status(401).json({ success: false, message: 'No password set. Please register your account first.' });
    }
    if (stored !== String(password).trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    const two = getTwoFactorEntry(email);
    if (two?.enabled && two?.secret) {
      if (!otp || !verifyTotp(two.secret, otp)) {
        return res.status(401).json({
          success: false,
          message: 'Two-factor authentication code is required or invalid.',
          requires_2fa: true,
        });
      }
    }

    const session = buildCounsellorSession(existing);
    // Attach role so the frontend can redirect to the correct dashboard
    session.role = existing.role || '';
    const token = issueCounsellorToken({ ...existing, role: existing.role || '' });
    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      counsellor: session,
      two_fa_enabled: !!(two?.enabled),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Login failed.' });
  }
};

// POST /api/cf/staff/forgot-password
// Body: { email }
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const counsellors = await getCounsellors();
    const existing = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());
    // Always return success to prevent email enumeration
    if (!existing) return res.json({ success: true, message: 'If the account exists, a reset email was sent.' });

    const token = uuidv4();
    setResetToken(email, token, Date.now() + 1000 * 60 * 60); // 1 hour

    try {
      const html = emailHtml(
        'Password Reset Request',
        `<p style="font-size:15px;color:#334155;line-height:1.8;">Dear <strong>${existing.name}</strong>,<br/><br/>
        We received a request to reset your password for your <strong>ANC Student Docs</strong> account.<br/><br/>
        Please open the ANC Student Docs app, go to <strong>Forgot Password -> Reset Password</strong>, and enter the following reset code:<br/><br/>
        <div style="text-align:center;margin:24px 0;">
          <strong style="font-family:monospace;font-size:22px;color:#0A2463;letter-spacing:4px;display:inline-block;padding:12px 24px;background:#F8FAFC;border:2px solid #E2E8F0;border-radius:10px;">${token}</strong>
        </div>
        <strong>This code expires in 1 hour.</strong><br/><br/>
        If you did not request a password reset, please ignore this email.</p>`
      );
      await sendEmail(email, 'ANC Student Docs - Password Reset Code', html);
    } catch (e) {
      console.error('Email send error (forgotPassword):', e.message);
    }

    return res.json({ success: true, message: 'A password reset code has been sent to your email address.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to process password reset.' });
  }
};

// POST /api/cf/staff/reset-password
// Body: { email, token, newPassword }
const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) return res.status(400).json({ success: false, message: 'Email, token and newPassword are required.' });

    const entry = getResetEntry(email);
    if (!entry || entry.token !== token) return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });

    const counsellors = await getCounsellors();
    const existing = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());
    if (!existing) return res.status(404).json({ success: false, message: 'Account not found.' });

    await upsertCounsellorRecord({ name: existing.name, email, password: newPassword, role: existing.role });
    clearResetEntry(email);

    try {
      const html = emailHtml('Password Reset Confirmed', `<p>Your password has been changed successfully.</p>`);
      await sendEmail(email, 'ANC Student Docs - Password Changed', html);
    } catch (e) {
      console.error('Email send error (resetPassword):', e.message);
    }

    return res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to reset password.' });
  }
};

module.exports = {
  getCounsellorList,
  registerCF,
  getCounsellorTokenInfo,
  verifyCfPin,
  getDashboardStats,
  sendReminderEmail,
  registerCounsellorAccount,
  resetCounsellorPin,
  registerStaff,
  loginStaff,
  forgotPassword,
  resetPassword,
};