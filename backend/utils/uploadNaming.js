const sanitizePart = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')
  .trim();

const getFileExtension = (fileName = '', fallback = 'pdf') => {
  const ext = String(fileName).split('.').pop();
  return ext ? ext.toLowerCase() : fallback;
};

const buildUploadFileName = (cfNumber, docLabel, fileName, fallbackExt = 'pdf') => {
  const safeCf = sanitizePart(cfNumber || 'UnknownCF');
  const safeLabel = sanitizePart(docLabel || 'document');
  const ext = getFileExtension(fileName, fallbackExt);
  return `${safeCf}_${safeLabel}.${ext}`;
};

module.exports = {
  sanitizePart,
  getFileExtension,
  buildUploadFileName,
};
