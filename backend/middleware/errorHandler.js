const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  // Handle Multer file size limit error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File size exceeds 5MB limit. Please upload a smaller file.',
    });
  }

  // Handle other Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({
        success: false,
        message: 'Too many files. Please upload fewer files.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
    });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
