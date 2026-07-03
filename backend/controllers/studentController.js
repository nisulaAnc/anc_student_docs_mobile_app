const StudentToken = require('../models/StudentToken');
const Submission = require('../models/Submission');
const { getDocumentsForProduct } = require('../utils/productDocuments');
const { sheetAppend, sheetUpdateRow, sheetRead, SHEETS, getCounsellors, uploadFileToDrive, SUBMISSION_DOC_COLUMNS } = require('../config/googleSheets');
const { sendEmail, emailHtml } = require('../utils/email');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { buildUploadFileName } = require('../utils/uploadNaming');

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

  // Fetch existing submission to pre-mark already-uploaded docs
  const existingSub = await Submission.findOne({ token });
  let already_uploaded_docs = [];
  let already_has_agreement = false;
  let existing_status = null;

  if (existingSub) {
    already_uploaded_docs = (existingSub.documents || []).map(d => d.label);
    already_has_agreement = !!existingSub.agreement_url;
    existing_status = existingSub.status;
  }

  // Build missing docs list based on existing submission
  const missing_documents = requiredDocs.filter(
    d => !already_uploaded_docs.some(u => u.trim().toLowerCase() === d.trim().toLowerCase())
  );
  if (!already_has_agreement) missing_documents.push('Agreement (signed)');

  res.json({
    success: true,
    data: {
      ...studentToken.toObject(),
      required_documents: requiredDocs,
      agreement_template_url: agreementTemplateUrl,
      // Existing submission state for pre-marking completed docs
      already_uploaded_docs,
      already_has_agreement,
      existing_status,
      missing_documents,
    },
  });
};

const escapeSheetFormulaValue = (value = '') => String(value).replace(/"/g, '""');

const buildCloudinaryDownloadUrl = (url = '', publicId = '', fileName = '') => {
  if (publicId) {
    const ext = String(fileName).split('.').pop().toLowerCase();
    const resourceType = ['pdf', 'doc', 'docx'].includes(ext) ? 'raw' : 'image';
    const publicIdWithoutExt = publicId.replace(/\.[^.]+$/, '');
    const options = {
      secure: true,
      resource_type: resourceType,
      flags: 'attachment',
    };
    return cloudinary.url(publicIdWithoutExt, options);
  }

  if (!url || !url.includes('/upload/')) return url;
  const [base, query = ''] = url.split('?');
  if (base.includes('/upload/fl_attachment')) return url;
  const downloadBase = base.replace(/\/upload\/(?!fl_attachment)/, '/upload/fl_attachment/');
  return query ? `${downloadBase}?${query}` : downloadBase;
};

const buildSheetHyperlink = (url, label, publicId, fileName) => {
  if (!url && !publicId) return '';
  const downloadUrl = buildCloudinaryDownloadUrl(url, publicId, fileName);
  const safeUrl = escapeSheetFormulaValue(downloadUrl);
  const safeLabel = escapeSheetFormulaValue(label || 'Open file');
  return `=HYPERLINK("${safeUrl}","${safeLabel}")`;
};

const findSubmissionSheetRow = async (token, cfNumber) => {
  const rows = await sheetRead(SHEETS.SUBMISSIONS, 'A1:Z5000');
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (row[1] === token || row[2] === cfNumber) {
      return i + 1;
    }
  }
  return null;
};

// POST /api/student/submit-documents
const submitDocuments = async (req, res) => {
  const { token } = req.body;

  // 1. Validate token
  const studentToken = await StudentToken.findOne({ token });
  if (!studentToken) {
    return res.status(400).json({
      success: false,
      message: 'Token not valid.',
    });
  }

  // 2. Allow partial follow-up submissions for the same student token,
  //    but block a different token from creating a duplicate submission for the same CF number.
  const existingSubmission = await Submission.findOne({ token });
  const existingCfSubmission = await Submission.findOne({ cf_number: studentToken.cf_number });

  if (existingCfSubmission && (!existingSubmission || existingCfSubmission._id.toString() !== existingSubmission._id.toString())) {
    return res.status(409).json({
      success: false,
      message: 'A submission for this CF number already exists. Please contact your counsellor for support.',
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

    const fileName = buildUploadFileName(studentToken.cf_number, label, file.originalname || file.filename, 'pdf');
    uploadedDocs.push({
      label,
      cloudinary_url: file.secure_url || file.path,
      file_name: fileName,
      public_id: file.public_id,
    });
  }

  // 7. Handle agreement file
  let agreementCloudinaryUrl = '';
  let agreementPublicId = '';
  const agreementFile = uploadedFiles.find((file) => file.fieldname === 'agreement');
  if (agreementFile) {
    agreementCloudinaryUrl = agreementFile.secure_url || agreementFile.path;
    agreementPublicId = agreementFile.public_id;
  }

  // 8. Determine if submission is complete or partial
  const uploadedDocCount = uploadedDocs.length + (agreementCloudinaryUrl ? 1 : 0);
  const isComplete = uploadedDocCount >= totalRequired;

  // 9. Mark token used & save submission to MongoDB
  studentToken.status = 'used';
  studentToken.phase = 'docs_submitted';
  await studentToken.save();

  const mergedDocuments = (existingSubmission?.documents || []).reduce((acc, doc) => {
    acc[doc.label?.toLowerCase()] = doc;
    return acc;
  }, {});

  uploadedDocs.forEach((doc) => {
    const key = doc.label?.toLowerCase();
    if (key) {
      mergedDocuments[key] = doc;
    }
  });

  const finalDocuments = Object.values(mergedDocuments);

  let submission = existingSubmission;
  if (!submission) {
    submission = await Submission.create({
      token,
      cf_number: studentToken.cf_number,
      student_name: studentToken.student_name,
      student_email: studentToken.student_email,
      counsellor_name: studentToken.counsellor_name,
      program_level: studentToken.program,
      degree_description: studentToken.degree_description,
      product_code: studentToken.product_code,
      documents: finalDocuments,
      agreement_url: agreementCloudinaryUrl,
      agreement_public_id: agreementPublicId,
      status: isComplete ? 'complete' : 'partial',
      total_required_docs: totalRequired,
    });
  } else {
    submission.documents = finalDocuments;
    submission.agreement_url = agreementCloudinaryUrl || submission.agreement_url;
    submission.agreement_public_id = agreementPublicId || submission.agreement_public_id;
    submission.status = isComplete ? 'complete' : 'partial';
    submission.total_required_docs = totalRequired;
    submission.submitted_at = new Date();
    await submission.save();
  }

  // 10. Sync current submission state to Google Sheet for both partial and complete uploads.
  // Each submission attempt updates the matching row so the sheet reflects the latest uploaded files.
  try {
    const docRow = new Array(SUBMISSION_DOC_COLUMNS.length).fill('');

    // Build the full merged doc list (existing + newly uploaded) for sheet sync.
    const allDocsForSheet = submission.documents || [];
    for (const doc of allDocsForSheet) {
      const colIdx = SUBMISSION_DOC_COLUMNS.findIndex(
        (col) => col.trim().toLowerCase() === (doc.label || '').trim().toLowerCase()
      );
      if (colIdx !== -1) {
        docRow[colIdx] = buildSheetHyperlink(
          doc.cloudinary_url || '',
          doc.file_name || doc.label || 'Document',
          doc.public_id,
          doc.file_name || doc.label || 'Document'
        );
      }
    }

    const finalAgreementUrl = submission.agreement_url || agreementCloudinaryUrl || '';
    const agreementLabel = buildUploadFileName(studentToken.cf_number, 'Agreement', agreementFile?.originalname || agreementFile?.filename || 'signed_agreement.pdf', 'pdf');
    const finalAgreementCell = finalAgreementUrl
      ? buildSheetHyperlink(
          finalAgreementUrl,
          agreementLabel || 'Signed Agreement',
          agreementPublicId,
          agreementLabel || 'Signed Agreement.pdf'
        )
      : '';

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
      finalAgreementCell,
    ];

    const existingRowNumber = await findSubmissionSheetRow(token, studentToken.cf_number);
    if (existingRowNumber) {
      await sheetUpdateRow(SHEETS.SUBMISSIONS, existingRowNumber, sheetRow, 'USER_ENTERED');
    } else {
      await sheetAppend(SHEETS.SUBMISSIONS, sheetRow, 'USER_ENTERED');
    }

    submission.synced_to_sheet = true;
    await submission.save();
  } catch (err) {
    console.error('Sheet sync error (Submission):', err.message);
  }

  // 11. EMAIL NOTIFICATIONS

  if (!isComplete) {
    // INCOMPLETE: Send "missing documents" warning to student
    const allUploadedLabels = (submission.documents || []).map((d) => String(d.label || '').trim()).filter(Boolean);
    const uploadedList = allUploadedLabels.map((label) => `<li>${label}</li>`).join('');
    const receivedCount = allUploadedLabels.length + (submission.agreement_url ? 1 : 0);

    const missingDocs = requiredDocs.filter(
      (docName) => !allUploadedLabels.some((uploadedLabel) => uploadedLabel.toLowerCase() === docName.toLowerCase())
    );
    if (!submission.agreement_url) missingDocs.push('Agreement (signed)');

    const missingList = missingDocs.map((d) => `<li>${d}</li>`).join('');

    const incompleteStudentHtml = emailHtml(
      'Action Required – Missing Documents',
      `<p style="font-size:15px;color:#334155;line-height:1.7;">
        Dear <strong>${studentToken.student_name}</strong>,<br><br>
        Thank you for submitting some of your documents. However, your submission is
        <strong style="color:#DC2626;">incomplete</strong>. Please upload the remaining
        documents and re-submit as soon as possible to avoid delays in your registration.
      </p>
      ${uploadedList ? `<p style="font-size:14px;font-weight:700;color:#0A2463;margin:16px 0 6px;">Documents Received (${receivedCount}):</p>
      <ul style="color:#16A34A;font-size:14px;line-height:2;">${uploadedList}${submission.agreement_url ? '<li>Agreement (signed)</li>' : ''}</ul>` : submission.agreement_url ? '<p style="font-size:14px;font-weight:700;color:#0A2463;margin:16px 0 6px;">Agreement Received</p>' : ''}
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
        const mergedUploadedCount = (submission.documents || []).length + (submission.agreement_url ? 1 : 0);
        const counsellorAlertHtml = emailHtml(
          'Incomplete Student Submission – Action Required',
          `<p style="font-size:15px;color:#334155;line-height:1.7;">
            Dear <strong>${studentToken.counsellor_name}</strong>,<br><br>
            Your student <strong>${studentToken.student_name}</strong>
            (CF: ${studentToken.cf_number}) has submitted only
            <strong>${mergedUploadedCount} of ${totalRequired}</strong> required documents.
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