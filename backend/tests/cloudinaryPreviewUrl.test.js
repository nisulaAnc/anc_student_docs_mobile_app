const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'test-spreadsheet-id';

const { buildCloudinaryPreviewUrl } = require('../controllers/studentController');

test('removes Cloudinary attachment delivery flag for sheet previews', () => {
  const url = 'https://res.cloudinary.com/example/raw/upload/fl_attachment/v1/student_docs/file.pdf';

  assert.equal(
    buildCloudinaryPreviewUrl(url),
    'https://res.cloudinary.com/example/raw/upload/v1/student_docs/file.pdf'
  );
});