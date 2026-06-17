const StudentToken = require('../models/StudentToken');
const Submission = require('../models/Submission');
const { getDocumentsForProduct } = require('../utils/productDocuments');
const { sheetAppend, SHEETS, getCounsellors, uploadFileToDrive, SUBMISSION_DOC_COLUMNS } = require('../config/googleSheets');
const { sendEmail, generateOTP, otpEmailHtml, emailHtml } = require('../utils/email');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /api/student/request-otp
const studentRequestOTP = async (req, res) => {
  const { token } = req.body;
  const studentToken = await StudentToken.findOne({ token, status: 'pending' });
  if (!studentToken) return res.status(404).json({ success: false, message: 'Invalid or expired token.' });

  const otp = generateOTP();
  studentToken.otp = otp;
  studentToken.otp_time = new Date();
  studentToken.phase = 'otp_sent';
  await studentToken.save();

  const html = otpEmailHtml(studentToken.student_name, otp, 'student');
  await sendEmail(studentToken.student_email, 'ANC Student Docs – OTP Verification', html);

  res.json({ success: true, message: `OTP sent to ${studentToken.student_email}` });
};

// POST /api/student/verify-otp
const studentVerifyOTP = async (req, res) => {
  const { token, otp } = req.body;
  const studentToken = await StudentToken.findOne({ token, status: 'pending' });
  if (!studentToken) return res.status(404).json({ success: false, message: 'Invalid token.' });

  const otpAge = (Date.now() - new Date(studentToken.otp_time).getTime()) / 1000;
  if (otpAge > 600) return res.status(400).json({ success: false, message: 'OTP expired.' });
  if (studentToken.otp !== String(otp).trim()) return res.status(400).json({ success: false, message: 'Invalid OTP.' });

  studentToken.phase = 'otp_verified';
  await studentToken.save();

  const requiredDocs = getDocumentsForProduct(studentToken.product_code);

  res.json({
    success: true,
    message: 'OTP verified.',
    data: {
      student_name: studentToken.student_name,
      student_email: studentToken.student_email,
      cf_number: studentToken.cf_number,
      program: studentToken.program,
      product_code: studentToken.product_code,
      counsellor_name: studentToken.counsellor_name,
      required_documents: requiredDocs,
    },
  });
};

// GET /api/student/token-info?token=xxx
const getStudentTokenInfo = async (req, res) => {
  const { token } = req.query;
  const studentToken = await StudentToken.findOne({ token });
  if (!studentToken) return res.status(404).json({ success: false, message: 'Token not found.' });

  const requiredDocs = getDocumentsForProduct(studentToken.product_code);
  res.json({
    success: true,
    data: { ...studentToken.toObject(), required_documents: requiredDocs },
  });
};

// POST /api/student/submit-documents
const submitDocuments = async (req, res) => {
  const { token } = req.body;
  const studentToken = await StudentToken.findOne({ token });
  if (!studentToken || studentToken.phase !== 'otp_verified') {
    return res.status(400).json({ success: false, message: 'Token not valid or OTP not verified.' });
  }

  const requiredDocs = getDocumentsForProduct(studentToken.product_code);
  const uploadedDocs = [];

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded.' });
  }

  // Parse doc_labels from body (JSON array)
  let docLabels = [];
  try {
    docLabels = JSON.parse(req.body.doc_labels || '[]');
  } catch (_) {
    docLabels = [];
  }

  // Process uploaded files
  for (const fileKey of Object.keys(req.files)) {
    const fileArr = Array.isArray(req.files[fileKey]) ? req.files[fileKey] : [req.files[fileKey]];
    for (const file of fileArr) {
      const index = parseInt(fileKey.replace('doc_', '')) || 0;
      const label = docLabels[index] || requiredDocs[index] || fileKey;

      uploadedDocs.push({
        label,
        cloudinary_url: file.path || file.secure_url, // Cloudinary URL
        file_name: file.filename || file.originalname,
        public_id: file.public_id,
      });
    }
  }

  // Handle agreement file
  let agreementCloudinaryUrl = '';
  let agreementPublicId = '';
  if (req.files['agreement']) {
    const agrFile = Array.isArray(req.files['agreement'])
      ? req.files['agreement'][0]
      : req.files['agreement'];
    agreementCloudinaryUrl = agrFile.path || agrFile.secure_url;
    agreementPublicId = agrFile.public_id;
  }

  // Mark token used
  studentToken.status = 'used';
  studentToken.phase = 'docs_submitted';
  await studentToken.save();

  // Save submission to MongoDB
  const submission = await Submission.create({
    token,
    cf_number: studentToken.cf_number,
    student_name: studentToken.student_name,
    student_email: studentToken.student_email,
    counsellor_name: studentToken.counsellor_name,
    program_level: studentToken.program,
    degree_description: studentToken.degree_description,
    product_code: studentToken.product_code,
    documents: uploadedDocs,
    agreement_url: agreementCloudinaryUrl,
    agreement_public_id: agreementPublicId,
  });

  // ── Sync to Google Sheet ──
  try {
    // Build the 22-element named-doc array (blank where doc was not uploaded)
    const docRow = new Array(SUBMISSION_DOC_COLUMNS.length).fill('');
    for (const doc of uploadedDocs) {
      const colIdx = SUBMISSION_DOC_COLUMNS.findIndex(
        (col) => col.toLowerCase() === doc.label.toLowerCase()
      );
      if (colIdx !== -1) {
        docRow[colIdx] = doc.cloudinary_url;
      }
    }

    const sheetRow = [
      new Date().toISOString(),
      token,
      studentToken.cf_number,
      studentToken.student_name,
      studentToken.student_email,
      studentToken.program,
      studentToken.degree_description || '',
      studentToken.product_code,
      ...docRow,
      agreementCloudinaryUrl,
    ];
    await sheetAppend(SHEETS.SUBMISSIONS, sheetRow);
    submission.synced_to_sheet = true;
    await submission.save();
  } catch (err) {
    console.error('Sheet sync error (Submission):', err.message);
  }

  // ── EMAIL NOTIFICATIONS ──

  // 1. Confirmation email to student
  const docList = uploadedDocs.map((d) => `<li>${d.label}</li>`).join('');
  const studentHtml = emailHtml(
    'Documents Received',
    `<p style="font-size:15px;color:#334155;line-height:1.7;">
      Dear <strong>${studentToken.student_name}</strong>,<br><br>
      Your documents have been successfully submitted. Our team will review them shortly.
    </p>
    <ul style="color:#334155;font-size:14px;line-height:2;">${docList}</ul>`
  );
  try {
    await sendEmail(studentToken.student_email, 'ANC Student Docs – Submission Confirmed', studentHtml);
  } catch (err) {
    console.error('Confirmation email error:', err.message);
  }

  // 2. Notification email to counsellor
  try {
    const counsellors = await getCounsellors();
    const counsellor = counsellors.find(
      (c) => c.name.toLowerCase() === studentToken.counsellor_name.toLowerCase()
    );
    if (counsellor?.email) {
      const uploadedDocList = uploadedDocs.map((d) => `<li>${d.label}</li>`).join('');
      const hasAgreement = !!agreementCloudinaryUrl;
      const counsellorHtml = emailHtml(
        'Student Documents Submitted',
        `<p style="font-size:15px;color:#334155;line-height:1.7;">
          Dear <strong>${studentToken.counsellor_name}</strong>,<br><br>
          Your student <strong>${studentToken.student_name}</strong> has submitted their required documents for the programme
          <strong>${studentToken.program}</strong>.<br><br>
          <strong>CF Number:</strong> ${studentToken.cf_number}<br>
          <strong>Student Email:</strong> ${studentToken.student_email}<br>
          <strong>Submitted At:</strong> ${new Date().toLocaleString()}
        </p>
        <p style="font-size:14px;font-weight:700;color:#0A2463;margin:20px 0 8px;">Documents Submitted:</p>
        <ul style="color:#334155;font-size:14px;line-height:2;">${uploadedDocList}${hasAgreement ? '<li>Agreement (signed)</li>' : ''}</ul>
        <p style="font-size:13px;color:#64748B;margin-top:20px;">Please log in to the admin panel to review the submitted files.</p>`
      );
      await sendEmail(counsellor.email, `ANC Student Docs – ${studentToken.student_name} Submitted Documents`, counsellorHtml);
    } else {
      console.log(`Counsellor email not found for: ${studentToken.counsellor_name}`);
    }
  } catch (err) {
    console.error('Counsellor notification email error:', err.message);
  }

  // 3. Notification email to admin / staff
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const uploadedDocList = uploadedDocs.map((d) => `<li>${d.label}</li>`).join('');
      const hasAgreement = !!agreementCloudinaryUrl;
      const adminHtml = emailHtml(
        'New Student Submission',
        `<p style="font-size:15px;color:#334155;line-height:1.7;">
          A student has just submitted their documents via the ANC Student Docs portal.<br><br>
          <strong>Student Name:</strong> ${studentToken.student_name}<br>
          <strong>Student Email:</strong> ${studentToken.student_email}<br>
          <strong>CF Number:</strong> ${studentToken.cf_number}<br>
          <strong>Programme:</strong> ${studentToken.program}<br>
          <strong>Counsellor:</strong> ${studentToken.counsellor_name}<br>
          <strong>Submitted At:</strong> ${new Date().toLocaleString()}
        </p>
        <p style="font-size:14px;font-weight:700;color:#0A2463;margin:20px 0 8px;">Documents Submitted:</p>
        <ul style="color:#334155;font-size:14px;line-height:2;">${uploadedDocList}${hasAgreement ? '<li>Agreement (signed)</li>' : ''}</ul>
        <p style="font-size:13px;color:#64748B;margin-top:20px;">Please log in to the admin panel to review the submitted files.</p>`
      );
      await sendEmail(adminEmail, `ANC Student Docs – New Submission: ${studentToken.student_name} (${studentToken.cf_number})`, adminHtml);
    }
  } catch (err) {
    console.error('Admin notification email error:', err.message);
  }

  res.json({ success: true, message: 'Documents submitted successfully.', submission_id: submission._id });
};

// GET /api/student/submission?token=xxx
const getSubmission = async (req, res) => {
  const { token } = req.query;
  const submission = await Submission.findOne({ token });
  if (!submission) return res.status(404).json({ success: false, message: 'Submission not found.' });
  res.json({ success: true, data: submission });
};

module.exports = { studentRequestOTP, studentVerifyOTP, getStudentTokenInfo, submitDocuments, getSubmission };