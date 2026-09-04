const CfToken = require('../models/CfToken');
const StudentToken = require('../models/StudentToken');
const Submission = require('../models/Submission');
const { getCounsellors, sheetAppend, SHEETS, upsertCounsellorRecord } = require('../config/googleSheets');
const { getDocumentsForProduct } = require('../utils/productDocuments');
const { sendEmail, getNotificationRecipients, emailHtml, otpEmailHtml, generateOTP } = require('../utils/email');
const { resolveCounsellorPin, buildCounsellorSession, issueCounsellorToken, verifyCounsellorToken } = require('../utils/counsellorAuth');
const { resolveCounsellorPinReset } = require('../utils/counsellorSheet');
const { generateSecret, generateOtpAuthUri, verifyTotp, verifyEmailCode } = require('../utils/twoFactor');
const { getTwoFactorEntry, setTwoFactorEntry } = require('../utils/twoFactorStore');
const { setResetToken, getResetEntry, clearResetEntry } = require('../utils/passwordResetStore');
const { validateResetPasswordPayload, validatePasswordChangePayload } = require('../utils/passwordResetValidation');

const resolveTwoFactorVerification = (entry, otp) => {
  if (!entry?.enabled) return true;
  if (!otp) return false;
  
  if (entry.secret && verifyTotp(entry.secret, otp)) {
    return true;
  }
  
  const emailCode = entry.emailCode || entry.email_code;
  if (emailCode && verifyEmailCode(emailCode, otp)) {
    return true;
  }
  
  return false;
};

// GET /api/cf/counsellors
const getCounsellorList = async (req, res) => {
  try {
    const counsellors = await getCounsellors();
    res.json({ success: true, data: counsellors });
  } catch (err) {
    console.error('Error fetching counsellors:', err.message);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};

// POST /api/cf/register
// Body: { cf_number, student_name, student_email, counsellor_name, university }
const registerCF = async (req, res) => {
  const { cf_number, student_name, student_email, counsellor_name, university = 'ANC' } = req.body;
  const normalizedUniversity = String(university).trim().toUpperCase();
  if (!cf_number || !student_name || !student_email || !counsellor_name || !normalizedUniversity) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (!['ANC', 'UWL'].includes(normalizedUniversity)) {
    return res.status(400).json({ success: false, message: 'University must be ANC or UWL.' });
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
    university: normalizedUniversity,
    counsellor_name: counsellor.name,
    counsellor_email: counsellor.email,
  });

  // Sync to Google Sheet
  try {
    await sheetAppend(SHEETS.CF_TOKENS, [
      token, cf_number, student_name, student_email,
      counsellor.name, counsellor.email,
      new Date().toISOString(), 'pending', '', '', 'otp_request', normalizedUniversity,
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
      <strong>CF Number:</strong> ${cf_number}<br>
      <strong>University:</strong> ${normalizedUniversity}<br><br>
      Please scan the QR code below using the <strong>DMS Mobile App</strong> or click the button to verify and select the student's programme.
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
    await sendEmail(getNotificationRecipients(counsellor.email, normalizedUniversity), 'Document Management System – Action Required', html);
  } catch (err) {
    console.error('Email send error:', err.message);
  }

  res.json({ success: true, message: 'Registration submitted. Counsellor has been notified.', token });
};

// GET /api/cf/counsellor/token-info?token=xxxx
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
      const storeEntry = await getTwoFactorEntry(emailForTwoFactor);
      if (storeEntry?.enabled && !resolveTwoFactorVerification(storeEntry, otp)) {
        return res.status(401).json({ success: false, message: 'Invalid verification code.' });
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
      const storeEntry = await getTwoFactorEntry(staffEmail);
      if (storeEntry?.enabled && !resolveTwoFactorVerification(storeEntry, otp)) {
        return res.status(401).json({ success: false, message: 'Invalid verification code.' });
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

// POST /api/cf/two-factor/send-email-code
const sendTwoFactorEmailCode = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check whether counsellor exists
    const counsellors = await getCounsellors();
    const existing = counsellors.find(
      (c) =>
        String(c.email || '').trim().toLowerCase() === normalizedEmail
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Counsellor not found.',
      });
    }

    // Generate 6-digit OTP
    const code = generateOTP();

    // Get previous 2FA data
    const previous = (await getTwoFactorEntry(normalizedEmail)) || {};

    // Store OTP temporarily in MongoDB
    await setTwoFactorEntry(normalizedEmail, {
      enabled: previous.enabled || false,
      method: 'email',
      secret: previous.secret || '',
      emailCode: code,
      emailSentAt: new Date(),
    });

    // Create email HTML - use a simple HTML template since otpEmailHtml might not exist
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #0A2463; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { color: #0A2463; margin: 0; font-size: 22px; }
          .code-box { background: #f0f4ff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #0A2463; letter-spacing: 8px; }
          .footer { text-align: center; font-size: 12px; color: #888; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }
          .info { color: #555; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Two-Factor Authentication</h1>
          </div>
          <p style="font-size:16px;color:#333;">Hello <strong>${name || existing.name || 'User'}</strong>,</p>
          <p class="info">You have requested to enable Two-Factor Authentication for your Document Management System account.</p>
          <p class="info">Please use the following 6-digit verification code to complete the setup:</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p style="font-size:14px;color:#666;">This code will expire in <strong>10 minutes</strong>.</p>
          <p style="font-size:14px;color:#666;">If you did not request this code, please ignore this email.</p>
          <div class="footer">
            <p>Document Management System • Secure Document Portal</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send OTP email
    await sendEmail(
      normalizedEmail,
      'Document Management System - Your 2FA Verification Code',
      html
    );

    return res.json({
      success: true,
      message: 'A 6-digit code has been sent to your email.',
    });
  } catch (err) {
    console.error('Failed to send 2FA email:', err);

    return res.status(500).json({
      success: false,
      message: 'Unable to send the 2FA code. Please try again.',
    });
  }
};


// POST /api/cf/two-factor/enable
const enableTwoFactor = async (req, res) => {
  try {
    const { email, secret, otp, enabled, method } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const isEmailMethod = String(method || '').trim().toLowerCase() === 'email';
    const shouldEnable = enabled !== false;
    const existingEntry = (await getTwoFactorEntry(normalizedEmail)) || {};

    // If enabling via email method
    if (shouldEnable && isEmailMethod) {
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: 'The email verification code is required.',
        });
      }

      const emailCode = existingEntry.emailCode;
      if (!emailCode || !verifyEmailCode(emailCode, otp)) {
        return res.status(401).json({
          success: false,
          message: 'The email verification code is invalid.',
        });
      }
    }
    // If enabling via TOTP authenticator app
    else if (shouldEnable && !isEmailMethod) {
      if (!secret || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Secret and OTP are required.',
        });
      }

      if (!verifyTotp(secret, otp)) {
        return res.status(401).json({
          success: false,
          message: 'The authenticator code is invalid.',
        });
      }
    }

    const counsellors = await getCounsellors();
    const existing = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email).trim().toLowerCase());
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Counsellor not found.' });
    }

    const nextSecret = secret || existingEntry.secret || '';
    const result = await upsertCounsellorRecord({
      name: existing.name,
      email,
      pin: existing.pin,
      two_factor_enabled: shouldEnable,
      two_factor_secret: nextSecret,
    });

    // Update store (clear the one-time email code after verification)
    await setTwoFactorEntry(email, {
      enabled: shouldEnable,
      secret: nextSecret,
      method: isEmailMethod ? 'email' : 'totp',
      emailCode: '',
      emailSentAt: null,
    });

    // Reissue the session token so the client's stored JWT reflects the new 2FA state.
    // Without this, the app re-decodes the OLD token on next screen focus and the
    // twoFactorEnabled flag reverts, making it look like 2FA "auto disabled".
    const newToken = issueCounsellorToken({
      ...existing,
      lastLogin: existing.lastLogin || new Date().toISOString(),
      twoFactorEnabled: shouldEnable,
    });

    // Send email notification about 2FA state change
    try {
      const subject = shouldEnable ? 'Document Management System - 2FA Enabled' : 'Document Management System - 2FA Disabled';
      const actionText = shouldEnable ? 'enabled' : 'disabled';
      const html = emailHtml(
        'Security Notice',
        `<p style="font-size:15px;color:#334155;line-height:1.7;">
          Dear <strong>${existing.name || 'User'}</strong>,<br><br>
          This is a security notification to inform you that Two-Factor Authentication (2FA) was recently <strong>${actionText}</strong> on your account.<br><br>
          If you did not authorize this change, please contact the administrator immediately.
        </p>`
      );
      await sendEmail(email, subject, html);
    } catch (e) {
      console.error('Failed to send 2FA status email:', e);
    }

    return res.json({
      success: true,
      message: shouldEnable ? '2FA enabled.' : '2FA disabled.',
      token: newToken,
      data: {
        created: result.created,
        email,
        method: isEmailMethod ? 'email' : 'totp'
      }
    });
  } catch (err) {
    console.error('Failed to update 2FA:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Unable to update 2FA.',
    });
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
      'Upload Missing Documents',
      studentUrl
    );

    await sendEmail(
      getNotificationRecipients(studentToken.student_email, studentToken.university),
      'Document Management System - Reminder: Pending Documents',
      html
    );

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

    const rawRole = String(role || '').trim();
    const normalizedRole = rawRole.toLowerCase();
    const resolvedRole = normalizedRole.includes('center function') || normalizedRole === 'cf'
      ? 'Center Function'
      : normalizedRole.includes('counsellor')
        ? 'Counsellor'
        : null;

    // Validate role
    const validRoles = ['center function', 'counsellor'];
    if (!resolvedRole && rawRole) {
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

    const existingPassword = String(existing.pin || existing.password || '').trim();
    if (existingPassword) {
      return res.status(409).json({
        success: false,
        message: 'This staff account is already registered. Please sign in instead.',
      });
    }

    const result = await upsertCounsellorRecord({ name: existing.name, email, password, role: existing.role || resolvedRole || 'Counsellor' });
    const finalRole = existing.role || resolvedRole || 'Counsellor';

    // Send verification/confirmation email
    try {
      const html = emailHtml(
        'Your Account is Verified',
        `<p style="font-size:15px;color:#334155;line-height:1.8;">Dear <strong>${existing.name}</strong>,<br/><br/>
        Your account has been successfully created and <strong style="color:#16A34A;">verified</strong>.
        You can now log in to the <strong>DMS</strong> mobile app using your registered credentials.<br/><br/>
        <strong>Name:</strong> ${existing.name}<br/>
        <strong>Email:</strong> ${email}<br/>
        <strong>Role:</strong> ${finalRole}<br/><br/>
        If you did not create this account, please contact the administrator immediately.</p>`
      );
      await sendEmail(email, 'Document Management System - Your Account is Verified', html);
    } catch (e) {
      console.error('Email send error (registerStaff):', e.message);
    }

    const token = issueCounsellorToken({
      name: existing.name,
      email,
      role: finalRole,
      lastLogin: new Date().toISOString(),
      twoFactorEnabled: !!(existing.two_factor_enabled),
    });
    return res.json({
      success: true,
      message: 'Your account has been verified. Welcome to Document Management System!',
      token,
      email,
      role: finalRole,
      counsellor: {
        name: existing.name,
        email,
        role: finalRole,
        lastLogin: new Date().toISOString(),
        twoFactorEnabled: !!(existing.two_factor_enabled),
      },
      created: result.created,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to register account.' });
  }
};

// POST /api/cf/staff/login
// Body: { email, password, otp }
// POST /api/cf/staff/login
// Body: { email, password, otp }
const loginStaff = async (req, res) => {
  try {
    const { email, password, otp, role } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const requestedRole = String(role || '').trim();
    const normalizedRequestedRole = requestedRole.toLowerCase();
    const resolvedRole = normalizedRequestedRole.includes('center function') || normalizedRequestedRole === 'cf'
      ? 'Center Function'
      : normalizedRequestedRole.includes('counsellor')
        ? 'Counsellor'
        : null;

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

    const two = await getTwoFactorEntry(email);

    // Check if 2FA is enabled
    if (two?.enabled) {
      const twoFaMethod = two.method || 'email';

      // If OTP is not provided, auto-send email OTP (email method only) then request code
      if (!otp) {
        if (twoFaMethod === 'email') {
          // Auto-generate and email a login OTP
          try {
            const code = generateOTP();
            await setTwoFactorEntry(email, {
              emailCode: code,
              emailSentAt: new Date(),
            });
            const html = otpEmailHtml(existing.name || email, code, 'staff');
            await sendEmail(email, 'Document Management System – Your Login Verification Code', html);
          } catch (emailErr) {
            console.error('Login OTP email error:', emailErr.message);
            // Don't block login attempt — client can resend
          }
        }
        return res.status(401).json({
          success: false,
          message: twoFaMethod === 'email'
            ? 'A 6-digit code has been sent to your email. Please enter it below.'
            : 'Enter the 6-digit code from your authenticator app.',
          requires_2fa: true,
          two_fa_method: twoFaMethod,
        });
      }

      // Verify the OTP
      if (!resolveTwoFactorVerification(two, otp)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid verification code. Please try again.',
          requires_2fa: true,
          two_fa_method: twoFaMethod,
        });
      }
    }

    const sessionRole = existing.role || resolvedRole || 'Counsellor';
    const session = buildCounsellorSession({
      ...existing,
      role: sessionRole,
      lastLogin: new Date().toISOString(),
      twoFactorEnabled: !!(two?.enabled),
    });
    const token = issueCounsellorToken({
      ...existing,
      role: sessionRole,
      lastLogin: new Date().toISOString(),
      twoFactorEnabled: !!(two?.enabled),
    });
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

// POST /api/cf/staff/send-login-otp
// Body: { email }
// Resend a login-time 2FA OTP without going through the full login flow.
const sendLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const counsellors = await getCounsellors();
    const existing = counsellors.find(
      (c) => String(c.email || '').trim().toLowerCase() === normalizedEmail
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const two = await getTwoFactorEntry(normalizedEmail);
    if (!two?.enabled || two.method !== 'email') {
      return res.status(400).json({ success: false, message: '2FA email is not enabled for this account.' });
    }

    const code = generateOTP();
    await setTwoFactorEntry(normalizedEmail, {
      emailCode: code,
      emailSentAt: new Date(),
    });

    const html = otpEmailHtml(existing.name || normalizedEmail, code, 'staff');
    await sendEmail(normalizedEmail, 'Document Management System – Your Login Verification Code', html);

    return res.json({ success: true, message: 'A new 6-digit code has been sent to your email.' });
  } catch (err) {
    console.error('sendLoginOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Unable to send code. Please try again.' });
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

    const token = String(Math.floor(10000000 + Math.random() * 90000000));
    setResetToken(email, token, Date.now() + 1000 * 60 * 60); // 1 hour

    try {
      const html = emailHtml(
        'Password Reset Request',
        `<p style="font-size:15px;color:#334155;line-height:1.8;">Dear <strong>${existing.name}</strong>,<br/><br/>
        We received a request to reset your password for your <strong>Document Management System</strong> account.<br/><br/>
        Please open the DMS app, go to <strong>Forgot Password -> Reset Password</strong> and enter the following reset code:<br/><br/>
        <div style="text-align:center;margin:24px 0;">
          <strong style="font-family:monospace;font-size:22px;color:#0A2463;letter-spacing:4px;display:inline-block;padding:12px 24px;background:#F8FAFC;border:2px solid #E2E8F0;border-radius:10px;">${token}</strong>
        </div>
        <strong>This code expires in 1 hour.</strong><br/><br/>
        If you did not request a password reset, please ignore this email.</p>`
      );
      await sendEmail(email, 'Document Management System - Password Reset Code', html);
    } catch (e) {
      console.error('Email send error (forgotPassword):', e.message);
    }

    return res.json({ success: true, message: 'A password reset code has been sent to your email address.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to process password reset.' });
  }
};

// POST /api/cf/staff/reset-password
// Body: { email, token?, newPassword, confirmPassword? }
const resetPassword = async (req, res) => {
  try {
    const payload = validateResetPasswordPayload(req.body);
    if (!payload.valid) {
      return res.status(400).json({ success: false, message: payload.error });
    }

    const { email, token, newPassword } = payload;
    if (token) {
      const entry = getResetEntry(email);
      if (!entry || entry.token !== token) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
      }
    }

    const counsellors = await getCounsellors();
    const existing = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());
    if (!existing) return res.status(404).json({ success: false, message: 'Account not found.' });

    await upsertCounsellorRecord({ name: existing.name, email, password: newPassword, role: existing.role });
    clearResetEntry(email);

    try {
      const html = emailHtml('Password Reset Confirmed', `<p>Your password has been changed successfully.</p>`);
      await sendEmail(email, 'Document Management System - Password Changed', html);
    } catch (e) {
      console.error('Email send error (resetPassword):', e.message);
    }

    return res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to reset password.' });
  }
};

// POST /api/cf/staff/change-password
// Body: { email, currentPassword, newPassword, confirmPassword }
const changePassword = async (req, res) => {
  try {
    const payload = validatePasswordChangePayload(req.body);
    if (!payload.valid) {
      return res.status(400).json({ success: false, message: payload.error });
    }

    const { email, currentPassword, newPassword } = payload;
    const counsellors = await getCounsellors();
    const existing = counsellors.find((c) => String(c.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());
    if (!existing) return res.status(404).json({ success: false, message: 'Account not found.' });

    const storedPassword = String(existing.pin || existing.password || '').trim();
    if (!storedPassword) {
      return res.status(401).json({ success: false, message: 'No password is set for this account.' });
    }

    if (storedPassword !== String(currentPassword).trim()) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    await upsertCounsellorRecord({ name: existing.name, email, password: newPassword, role: existing.role });

    try {
      const html = emailHtml('Password Changed', `<p>Your password was updated successfully.</p>`);
      await sendEmail(email, 'Document Management System - Password Changed', html);
    } catch (e) {
      console.error('Email send error (changePassword):', e.message);
    }

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to change password.' });
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
  sendLoginOtp,
  forgotPassword,
  resetPassword,
  changePassword,
  setupTwoFactor,
  sendTwoFactorEmailCode,
  enableTwoFactor,
};