const { v4: uuidv4 } = require('uuid');
const CfToken = require('../models/CfToken');
const StudentToken = require('../models/StudentToken');
const { getProgramsDetailed, getProgramDetailsByLabel, sheetAppend, SHEETS } = require('../config/googleSheets');
const { sendEmail, emailHtml } = require('../utils/email');

// GET /api/counsellor/programs
const getPrograms = async (req, res) => {
  const programs = await getProgramsDetailed();
  res.json({ success: true, data: programs });
};

// POST /api/counsellor/select-program
// Body: { cf_token, program_label }
const selectProgram = async (req, res) => {
  const { cf_token, program_label } = req.body;
  if (!cf_token || !program_label) {
    return res.status(400).json({ success: false, message: 'Token and program required.' });
  }

  const cfToken = await CfToken.findOne({ token: cf_token, status: 'pending' });
  if (!cfToken) {
    return res.status(400).json({ success: false, message: 'Token not valid or has already been used.' });
  }

  const programDetail = await getProgramDetailsByLabel(program_label);
  if (!programDetail) {
    return res.status(400).json({ success: false, message: 'Programme not found.' });
  }

  // Mark CF token as used
  cfToken.status = 'used';
  cfToken.phase = 'done';
  await cfToken.save();

  // Create student token
  const studentToken = String(Math.floor(10000000 + Math.random() * 90000000));
  await StudentToken.create({
    token: studentToken,
    cf_number: cfToken.cf_number,
    student_name: cfToken.student_name,
    student_email: cfToken.student_email,
    counsellor_name: cfToken.counsellor_name,
    counsellor_email: cfToken.counsellor_email,
    program: programDetail.label,
    degree_description: programDetail.description,
    product_code: programDetail.product_code,
  });

  // Sync to sheet
  try {
    await sheetAppend(SHEETS.STUDENT_TOKENS, [
      studentToken, cfToken.cf_number, cfToken.student_name, cfToken.student_email,
      cfToken.counsellor_name, programDetail.label, programDetail.description || '', programDetail.product_code,
      new Date().toISOString(), 'pending', '', '', 'otp_request',
    ]);
  } catch (err) {
    console.error('Sheet sync error (StudentToken):', err.message);
  }

  // Email student
  const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
  const studentUrl = `${BASE_URL}/student?token=${studentToken}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(studentUrl)}`;

  const html = emailHtml(
    'Complete Your Student Registration',
    `<p style="font-size:15px;color:#334155;line-height:1.7;">
      Dear <strong>${cfToken.student_name}</strong>,<br><br>
      Your counsellor has selected your programme: <strong>${programDetail.label}</strong>.<br><br>
      Please scan the QR code below using the <strong>ANC Student Docs Mobile App</strong> or click the button to verify your identity and submit your required documents.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <img src="${qrUrl}" alt="QR Code" width="180" height="180" style="border:4px solid #fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
      <div style="margin-top:16px;font-size:13px;color:#64748B;">
        Or enter this token manually:<br>
        <strong style="font-family:monospace;font-size:16px;color:#0A2463;letter-spacing:2px;display:inline-block;margin-top:6px;padding:8px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">${studentToken}</strong>
      </div>
    </div>`,
    'Open Student Portal →',
    studentUrl
  );

  try {
    await sendEmail(cfToken.student_email, 'ANC Student Docs – Submit Your Documents', html);
  } catch (err) {
    console.error('Email send error:', err.message);
  }

  res.json({
    success: true,
    message: 'Programme selected. Student has been notified.',
    student_token: studentToken,
  });
};

module.exports = { getPrograms, selectProgram };
