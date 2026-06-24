const fs = require('fs');

function handleUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file received.' });
  }

  const isImage = req.file.mimetype.startsWith('image/');
  let base64 = null;

  if (isImage) {
    try {
      base64 = fs.readFileSync(req.file.path).toString('base64');
    } catch (err) {
      console.error('[NovaScribe] Failed to read uploaded image for base64 encoding:', err.message);
    }
  }

  res.status(201).json({
    success: true,
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
      // Only present for images — lets the AI actually "see" the upload
      // instead of just receiving a filename placeholder.
      base64,
    },
  });
}

module.exports = { handleUpload };
