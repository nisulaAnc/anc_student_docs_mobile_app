const { v4: uuidv4 } = require('uuid');
const CfToken = require('../models/CfToken');
const StudentToken = require('../models/StudentToken');
const Submission = require('../models/Submission');
const { getCounsellors, sheetAppend, SHEETS, upsertCounsellorRecord } = require('../config/googleSheets');
const { getDocumentsForProduct } = require('../utils/productDocuments');
const { sendEmail, emailHtml } = require('../utils/email');
const { resolveCounsellorPin, buildCounsellorSession, issueCounsellorToken, verifyCounsellorToken } = require('../utils/counsellorAuth');
const { resolveCounsellorPinReset } = require('../utils/counsellorSheet');

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
    'Open Counsellor Portal →',
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
// Body: { pin, type, counsellor } (type can be 'cf' or 'counsellor')
const verifyCfPin = (req, res) => {
  const { pin, type, counsellor } = req.body;
  const correctCfPin = process.env.CF_PIN;
  const fallbackCounsellorPin = process.env.COUNSELLOR_PIN || '112233';

  if (type === 'counsellor') {
    const correctCounsellorPin = resolveCounsellorPin(counsellor, fallbackCounsellorPin);
    if (!pin || String(pin).trim() !== String(correctCounsellorPin).trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect Counsellor PIN. Access denied.' });
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
    return res.json({ success: true, message: 'Staff PIN verified.', role: 'cf' });
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

module.exports = {
  getCounsellorList,
  registerCF,
  getCounsellorTokenInfo,
  verifyCfPin,
  getDashboardStats,
  sendReminderEmail,
  registerCounsellorAccount,
  resetCounsellorPin,
};