const fs = require('fs');

function handleUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file received.' });
  }

  const isImage = req.file.mimetype.startsWith('image/');
  let base64 = null;
  // اگر امیج نہیں ہے تو ڈیفالٹ راستہ، ورنہ نیچے بیس64 سیٹ ہوگا
  let fileUrl = `/uploads/${req.file.filename}`; 

  if (isImage) {
    try {
      base64 = fs.readFileSync(req.file.path).toString('base64');
      // ٹرِک: یو آر ایل کی جگہ ڈائریکٹ بیس64 ڈیٹا ایڈریس بھیج رہے ہیں تاکہ تھمب نیل فوراً دیکھے
      fileUrl = `data:${req.file.mimetype};base64,${base64}`;
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
      url: fileUrl, // اب تھمب نیل 100% نظر آئے گا
      base64,
    },
  });
}

module.exports = { handleUpload };
