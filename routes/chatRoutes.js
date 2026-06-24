const express = require('express');
const { getLimitStatus } = require('../controllers/chatController');

const router = express.Router();

router.get('/limit-status', getLimitStatus);

module.exports = router;
