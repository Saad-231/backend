const express = require('express');
const {
  listChats,
  createChat,
  getChatMessages,
  deleteChat,
  listCreations,
} = require('../controllers/historyController');

const router = express.Router();

router.get('/chats', listChats);
router.post('/chats', createChat);
router.get('/chats/:chatId/messages', getChatMessages);
router.delete('/chats/:chatId', deleteChat);
router.get('/creations', listCreations);

module.exports = router;
