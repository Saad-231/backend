// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[NovaScribe] Error:', err.message);

  if (err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File is too large. Max size is 15MB.' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong on the server.',
  });
}

module.exports = errorHandler;
