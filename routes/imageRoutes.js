const express = require('express');
const { generateImage } = require('../controllers/imageController');
const { imageRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/generate', imageRateLimiter, generateImage);

module.exports = router;
