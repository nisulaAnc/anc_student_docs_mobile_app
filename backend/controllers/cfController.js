const { v4: uuidv4 } = require('uuid');
const CfToken = require('../models/CfToken');
const { getCounsellors, sheetAppend, SHEETS } = require('../config/googleSheets');
const { sendEmail, emailHtml } = require('../utils/email');

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

// POST /api/cf/verify-pin
// Body: { pin }
const verifyCfPin = (req, res) => {
  const { pin } = req.body;
  const correctPin = process.env.CF_PIN;

  if (!correctPin) {
    return res.status(400).json({ success: false, message: 'CF PIN not configured on server.' });
  }
  if (!pin || String(pin).trim() !== String(correctPin).trim()) {
    return res.status(401).json({ success: false, message: 'Incorrect PIN. Access denied.' });
  }
  return res.json({ success: true, message: 'PIN verified.' });
};

module.exports = { getCounsellorList, registerCF, getCounsellorTokenInfo, verifyCfPin };
