const StudentToken = require('../models/StudentToken');
const Submission = require('../models/Submission');
const { getDocumentsForProduct } = require('../utils/productDocuments');
const { sheetAppend, SHEETS, getCounsellors, uploadFileToDrive, SUBMISSION_DOC_COLUMNS } = require('../config/googleSheets');
const { sendEmail, emailHtml } = require('../utils/email');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// GET /api/student/token-info?token=xxx
const getStudentTokenInfo = async (req, res) => {
  const { token } = req.query;
  const studentToken = await StudentToken.findOne({ token });
  if (!studentToken) return res.status(404).json({ success: false, message: 'Token not found.' });

  const requiredDocs = getDocumentsForProduct(studentToken.product_code);
  
  const path = require('path');
  let agreementTemplateUrl = null;
  const templatePath = path.join(__dirname, '../uploads/Agreement_template.pdf');
  if (fs.existsSync(templatePath)) {
    agreementTemplateUrl = `${req.protocol}://${req.get('host')}/uploads/Agreement_template.pdf`;
  }

  res.json({
    success: true,
    data: { 
      ...studentToken.toObject(), 
      required_documents: requiredDocs,
      agreement_template_url: agreementTemplateUrl
    },
  });
};

// POST /api/student/submit-documents
const submitDocuments = async (req, res) => {
  const { token } = req.body;

  // 1. Validate token
  const studentToken = await StudentToken.findOne({ token });
  if (!studentToken || studentToken.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Token not valid or has already been used.',
    });
  }

  // 2. Ensure no duplicate submission already exists in DB
  const existingSubmission = await Submission.findOne({ token });
  if (existingSubmission) {
    return res.status(409).json({
      success: false,
      message: 'A submission for this token already exists. No duplicate allowed.',
    });
  }

  // 3. Check files were sent
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];
  if (uploadedFiles.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded.' });
  }

  // 4. Parse doc_labels from body (JSON array)
  let docLabels = [];
  try {
    docLabels = JSON.parse(req.body.doc_labels || '[]');
  } catch (_) {
    docLabels = [];
  }

  // 5. Get required documents for this student's product
  const requiredDocs = getDocumentsForProduct(studentToken.product_code);
  const totalRequired = requiredDocs.length + 1; // +1 for agreement

  // 6. Process uploaded files
  const uploadedDocs = [];

  for (const file of uploadedFiles) {
    if (file.fieldname === 'agreement') continue; // handled separately below

    const index = parseInt(file.fieldname.replace('doc_', ''), 10);
    const label = docLabels[index] || requiredDocs[index] || file.fieldname;

    uploadedDocs.push({
      label,
      cloudinary_url: file.path || file.secure_url,
      file_name: file.filename || file.originalname,
      public_id: file.public_id,
    });
  }

  // 7. Handle agreement file
  let agreementCloudinaryUrl = '';
  let agreementPublicId = '';
  const agreementFile = uploadedFiles.find((file) => file.fieldname === 'agreement');
  if (agreementFile) {
    agreementCloudinaryUrl = agreementFile.path || agreementFile.secure_url;
    agreementPublicId = agreementFile.public_id;
  }

  // 8. Determine if submission is complete or partial
  const uploadedDocCount = uploadedDocs.length + (agreementCloudinaryUrl ? 1 : 0);
  const isComplete = uploadedDocCount >= totalRequired;

  // 9. Mark token used & save submission to MongoDB
  studentToken.status = 'used';
  studentToken.phase = 'docs_submitted';
  await studentToken.save();

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
    status: isComplete ? 'complete' : 'partial',
    total_required_docs: totalRequired,
  });

  // 10. Sync to Google Sheet ONLY for complete submissions
  // This prevents a partial row being written and then a duplicate row
  // being written later when all docs are submitted.
  if (isComplete) {
    try {
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
  }

  // 11. EMAIL NOTIFICATIONS

  if (!isComplete) {
    // INCOMPLETE: Send "missing documents" warning to student
    const missingDocs = [];
    const uploadedLabels = uploadedDocs.map((d) => d.label.toLowerCase());
    for (const docName of requiredDocs) {
      if (!uploadedLabels.includes(docName.toLowerCase())) {
        missingDocs.push(docName);
      }
    }
    if (!agreementCloudinaryUrl) missingDocs.push('Agreement (signed)');

    const missingList = missingDocs.map((d) => `<li>${d}</li>`).join('');
    const uploadedList = uploadedDocs.map((d) => `<li>${d.label}</li>`).join('');

    const incompleteStudentHtml = emailHtml(
      'Action Required – Missing Documents',
      `<p style="font-size:15px;color:#334155;line-height:1.7;">
        Dear <strong>${studentToken.student_name}</strong>,<br><br>
        Thank you for submitting some of your documents. However, your submission is
        <strong style="color:#DC2626;">incomplete</strong>. Please upload the remaining
        documents and re-submit as soon as possible to avoid delays in your registration.
      </p>
      ${uploadedList ? `<p style="font-size:14px;font-weight:700;color:#0A2463;margin:16px 0 6px;">Documents Received (${uploadedDocs.length}):</p>
      <ul style="color:#16A34A;font-size:14px;line-height:2;">${uploadedList}</ul>` : ''}
      <p style="font-size:14px;font-weight:700;color:#DC2626;margin:16px 0 6px;">
        Missing Documents (${missingDocs.length}):
      </p>
      <ul style="color:#DC2626;font-size:14px;line-height:2;">${missingList}</ul>
      <p style="font-size:13px;color:#64748B;margin-top:16px;">
        Please contact your counsellor <strong>${studentToken.counsellor_name}</strong>
        for a new upload link to submit the remaining documents.
      </p>`
    );

    try {
      await sendEmail(
        studentToken.student_email,
        'ANC Student Docs – Incomplete Submission: Action Required',
        incompleteStudentHtml
      );
    } catch (err) {
      console.error('Incomplete submission email error:', err.message);
    }

    // Also alert counsellor about incomplete submission
    try {
      const counsellors = await getCounsellors();
      const counsellor = counsellors.find(
        (c) => c.name.toLowerCase() === studentToken.counsellor_name.toLowerCase()
      );
      if (counsellor?.email) {
        const counsellorAlertHtml = emailHtml(
          'Incomplete Student Submission – Action Required',
          `<p style="font-size:15px;color:#334155;line-height:1.7;">
            Dear <strong>${studentToken.counsellor_name}</strong>,<br><br>
            Your student <strong>${studentToken.student_name}</strong>
            (CF: ${studentToken.cf_number}) has submitted only
            <strong>${uploadedDocs.length} of ${totalRequired}</strong> required documents.
            The submission is marked <strong style="color:#DC2626;">incomplete</strong>.
          </p>
          <p style="font-size:14px;font-weight:700;color:#DC2626;margin:16px 0 6px;">Missing Documents:</p>
          <ul style="color:#DC2626;font-size:14px;line-height:2;">${missingList}</ul>
          <p style="font-size:13px;color:#64748B;margin-top:16px;">
            Please issue the student a new upload link so they can complete their submission.
          </p>`
        );
        await sendEmail(
          counsellor.email,
          `ANC Student Docs – INCOMPLETE Submission: ${studentToken.student_name}`,
          counsellorAlertHtml
        );
      }
    } catch (err) {
      console.error('Counsellor incomplete alert email error:', err.message);
    }

    return res.json({
      success: true,
      complete: false,
      message: `Submission saved but incomplete. ${missingDocs.length} document(s) are missing. A reminder email has been sent to the student.`,
      submission_id: submission._id,
      missing_docs: missingDocs,
    });
  }

  // COMPLETE: Send success emails
  // 1. Confirmation email to student
  const docList = uploadedDocs.map((d) => `<li>${d.label}</li>`).join('');
  const studentHtml = emailHtml(
    'Documents Received – Submission Complete',
    `<p style="font-size:15px;color:#334155;line-height:1.7;">
      Dear <strong>${studentToken.student_name}</strong>,<br><br>
      Your documents have been successfully submitted. Our team will review them shortly.
    </p>
    <ul style="color:#334155;font-size:14px;line-height:2;">${docList}${agreementCloudinaryUrl ? '<li>Agreement (signed)</li>' : ''}</ul>`
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

  res.json({
    success: true,
    complete: true,
    message: 'Documents submitted successfully.',
    submission_id: submission._id,
  });
};

// GET /api/student/submission?token=xxx
const getSubmission = async (req, res) => {
  const { token } = req.query;
  const submission = await Submission.findOne({ token });
  if (!submission) return res.status(404).json({ success: false, message: 'Submission not found.' });
  res.json({ success: true, data: submission });
};

module.exports = { getStudentTokenInfo, submitDocuments, getSubmission };