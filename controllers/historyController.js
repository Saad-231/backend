const store = require('../models/store');

function listChats(req, res) {
  const userId = req.headers['x-user-id'] || 'anonymous';
  res.json({ chats: store.listChats(userId) });
}

function createChat(req, res) {
  const userId = req.headers['x-user-id'] || 'anonymous';
  const chat = store.createChat(userId, req.body?.title);
  res.status(201).json({ chat });
}

function getChatMessages(req, res) {
  const { chatId } = req.params;
  const chat = store.getChat(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found.' });
  res.json({ chat, messages: store.getMessages(chatId) });
}

function deleteChat(req, res) {
  const { chatId } = req.params;
  store.deleteChat(chatId);
  res.json({ success: true });
}

function listCreations(req, res) {
  const userId = req.headers['x-user-id'] || 'anonymous';
  res.json({ creations: store.listCreations(userId) });
}

module.exports = { listChats, createChat, getChatMessages, deleteChat, listCreations };
