const { nanoid } = require('nanoid');

/**
 * In-memory data store.
 *
 * This is intentionally a simple, dependency-free store so the project
 * runs instantly with zero database setup. The shape mirrors what you'd
 * get from a real DB, so swapping this file for a Mongoose/Prisma layer
 * later does not require touching controllers/sockets.
 *
 * Shape:
 * users: Map<userId, {
 *   chatCount: number, imageCount: number, resetAt: ISOString
 * }>
 * chats: Map<chatId, { id, userId, title, createdAt, updatedAt }>
 * messages: Map<chatId, Array<Message>>
 * creations: Map<userId, Array<Creation>>  // "My Stuff" — generated images etc.
 */

const users = new Map();
const chats = new Map();
const messages = new Map();
const creations = new Map();

const DAY_MS = 24 * 60 * 60 * 1000;

function getOrCreateUser(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      chatCount: 0,
      imageCount: 0,
      resetAt: new Date(Date.now() + DAY_MS).toISOString(),
    });
  }
  const user = users.get(userId);

  // Roll the window forward if it has expired.
  if (new Date(user.resetAt).getTime() <= Date.now()) {
    user.chatCount = 0;
    user.imageCount = 0;
    user.resetAt = new Date(Date.now() + DAY_MS).toISOString();
  }

  return user;
}

function createChat(userId, title = 'New Chat') {
  const id = nanoid();
  const now = new Date().toISOString();
  const chat = { id, userId, title, createdAt: now, updatedAt: now };
  chats.set(id, chat);
  messages.set(id, []);
  return chat;
}

function listChats(userId) {
  return Array.from(chats.values())
    .filter((c) => c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getChat(chatId) {
  return chats.get(chatId) || null;
}

function deleteChat(chatId) {
  chats.delete(chatId);
  messages.delete(chatId);
}

function touchChat(chatId, titleMaybe) {
  const chat = chats.get(chatId);
  if (!chat) return null;
  chat.updatedAt = new Date().toISOString();
  if (titleMaybe && chat.title === 'New Chat') {
    chat.title = titleMaybe.slice(0, 48);
  }
  return chat;
}

function addMessage(chatId, message) {
  if (!messages.has(chatId)) messages.set(chatId, []);
  const full = { id: nanoid(), createdAt: new Date().toISOString(), ...message };
  messages.get(chatId).push(full);
  return full;
}

function getMessages(chatId) {
  return messages.get(chatId) || [];
}

function addCreation(userId, creation) {
  if (!creations.has(userId)) creations.set(userId, []);
  const full = { id: nanoid(), createdAt: new Date().toISOString(), ...creation };
  creations.get(userId).unshift(full);
  return full;
}

function listCreations(userId) {
  return creations.get(userId) || [];
}

module.exports = {
  getOrCreateUser,
  createChat,
  listChats,
  getChat,
  deleteChat,
  touchChat,
  addMessage,
  getMessages,
  addCreation,
  listCreations,
};
