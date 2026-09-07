const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'test-spreadsheet-id';

const { buildCloudinaryPreviewUrl } = require('../controllers/studentController');

test('requests inline delivery for Cloudinary attachment URLs', () => {
  const url = 'https://res.cloudinary.com/example/raw/upload/fl_attachment/v1/student_docs/file.pdf';

  assert.equal(
    buildCloudinaryPreviewUrl(url),
    'https://res.cloudinary.com/example/raw/upload/fl_inline/v1/student_docs/file.pdf'
  );
});

test('adds inline delivery to ordinary Cloudinary upload URLs', () => {
  const url = 'https://res.cloudinary.com/example/raw/upload/v1/student_docs/file.pdf';

  assert.equal(
    buildCloudinaryPreviewUrl(url),
    'https://res.cloudinary.com/example/raw/upload/fl_inline/v1/student_docs/file.pdf'
  );
});

test('leaves non-Cloudinary URLs unchanged', () => {
  const url = 'https://example.com/file.pdf';

  assert.equal(buildCloudinaryPreviewUrl(url), url);
});