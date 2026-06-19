const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// ── Named document columns for the Submissions sheet (columns 9–30, 0-indexed as 8–29) ──
const SUBMISSION_DOC_COLUMNS = [
  'Application Form',
  'Affidavit',
  'Copy of acceptance letter - Signed by AGM - Enrolment Management',
  'Copy of National Identity Card (NIC) or Passport',
  'CV',
  'passport size photograph',
  'Payment Plan',
  'Professional Qualifications',
  'Professional/ University transcript',
  'Registration payment receipt',
  'Student Agreement',
  'Work Experience Letter',
  'Additional Educational Certificates (bachelors or service letter)',
  'Copy of A/L certificate',
  'Copy of detailed page of passport',
  'Conditional Offer Letter',
  'Birth Certificate',
  'Copy of O/L certificate/Exam ticket',
  'Completed form for parents interview',
  'Family Information Sheet',
  'Student Release Form',
  'Subject Combination',
];

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Sheet tab names (mirrors PHP constants)
const SHEETS = {
  COUNSELLORS: 'Counsellor List',
  PRODUCTS: 'Product List',
  CF_TOKENS: 'CF_Tokens',
  STUDENT_TOKENS: 'Student_Tokens',
  SUBMISSIONS: 'Submissions',
  CHECKLIST: 'Check List',
};

function getAuthClient() {
  const credPath = path.resolve(__dirname, '../config/credentials.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  return auth;
}

async function getDriveService() {
  const auth = getAuthClient();
  return google.drive({ version: 'v3', auth });
}

/**
 * Uploads a local file to the configured Google Drive folder.
 * Sets sharing to "anyone with link can view" so the URL works in Sheets.
 * @returns {Promise<string>} Shareable Drive URL
 */
async function uploadFileToDrive(filePath, fileName, mimeType = 'application/pdf') {
  const drive = await getDriveService();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const fileMetadata = {
    name: fileName,
    ...(folderId && folderId !== 'REPLACE_WITH_YOUR_FOLDER_ID' ? { parents: [folderId] } : {}),
  };

  const media = {
    mimeType,
    body: fs.createReadStream(filePath),
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id',
  });

  const fileId = file.data.id;

  // Make it viewable by anyone with the link (no Google account required)
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return `https://drive.google.com/file/d/${fileId}/view`;
}

async function getSheetsService() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

async function sheetRead(tab, range = 'A1:Z5000') {
  const sheets = await getSheetsService();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!${range}`,
  });
  return res.data.values || [];
}

async function sheetAppend(tab, row) {
  const sheets = await getSheetsService();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

async function sheetUpdateRow(tab, rowNumber, row) {
  const sheets = await getSheetsService();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

async function sheetFindRow(tab, colIndex, value) {
  const rows = await sheetRead(tab);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][colIndex] === value) {
      return { row: rows[i], rowNumber: i + 1 };
    }
  }
  return null;
}

async function getCounsellors() {
  const rows = await sheetRead(SHEETS.COUNSELLORS, 'A2:E200');
  const out = [];
  for (const r of rows) {
    const name = r[2] ? r[2].trim() : '';
    const email = r[4] ? r[4].trim() : '';
    if (name && email) out.push({ name, email });
  }
  return out;
}

async function getProgramsDetailed() {
  const rows = await sheetRead(SHEETS.PRODUCTS, 'I2:L500');
  const out = [];
  const seen = {};
  for (const r of rows) {
    const major = r[0] ? r[0].trim() : '';
    const degree = r[1] ? r[1].trim() : '';
    const degreeDesc = r[2] ? r[2].trim() : '';
    const productCode = r[3] ? r[3].trim() : '';
    if (!productCode) continue;
    if (seen[productCode]) continue;
    seen[productCode] = true;
    const label = `${major} - ${degree}`;
    out.push({ major, degree, description: degreeDesc, product_code: productCode, label });
  }
  return out;
}

async function getProgramDetailsByLabel(label) {
  const all = await getProgramsDetailed();
  const needle = label.trim();
  for (const p of all) {
    if (p.label.toLowerCase() === needle.toLowerCase()) return p;
  }
  for (const p of all) {
    if (p.product_code.toLowerCase() === needle.toLowerCase()) return p;
  }
  for (const p of all) {
    if (p.degree.toLowerCase() === needle.toLowerCase()) return p;
  }
  return null;
}

module.exports = {
  SHEETS,
  SUBMISSION_DOC_COLUMNS,
  sheetRead,
  sheetAppend,
  sheetUpdateRow,
  sheetFindRow,
  getCounsellors,
  getProgramsDetailed,
  getProgramDetailsByLabel,
  uploadFileToDrive,
};
