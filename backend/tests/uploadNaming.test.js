const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUploadFileName } = require('../utils/uploadNaming');

test('builds CF-prefixed upload names with the original extension', () => {
  const result = buildUploadFileName('CF2024001', 'Passport Size Photograph', 'photo.jpg');
  assert.equal(result, 'CF2024001_Passport_Size_Photograph.jpg');
});

test('sanitizes labels and defaults the extension when missing', () => {
  const result = buildUploadFileName('CF-001', 'Application Form', 'application.pdf');
  assert.equal(result, 'CF-001_Application_Form.pdf');
});
