const config = require('../config/env');
const aiProvider = require('../config/aiProvider');
const store = require('../models/store');

/**
 * POST /api/image/generate
 * body: { prompt: string, chatId?: string }
 *
 * Generates an image via the active IMAGE_PROVIDER (Pollinations,
 * Gemini, or OpenAI), stores it as a "creation" (My Stuff), appends
 * an assistant message to the chat (if chatId given), and increments
 * the user's daily image counter.
 */
async function generateImage(req, res, next) {
  try {
    const { prompt, chatId } = req.body;
    const userId = req.userId;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'A prompt is required to generate an image.' });
    }

    const { url: imageUrl } = await aiProvider.generateImage(prompt.trim());

    const user = store.getOrCreateUser(userId);
    user.imageCount += 1;

    // If there's no chat yet (image generation is the very first action
    // in a new conversation), create one now — mirrors how the chat
    // socket flow auto-creates a chat for the first text message.
    let chat = chatId ? store.getChat(chatId) : null;
    if (!chat) {
      chat = store.createChat(userId);
    }

    const creation = store.addCreation(userId, {
      type: 'image',
      prompt: prompt.trim(),
      url: imageUrl,
      chatId: chat.id,
    });

    const message = store.addMessage(chat.id, {
      role: 'assistant',
      type: 'image',
      content: imageUrl,
      prompt: prompt.trim(),
    });
    store.touchChat(chat.id, prompt.trim());

    res.json({
      success: true,
      chatId: chat.id,
      image: { url: imageUrl, prompt: prompt.trim() },
      creation,
      message,
      usage: {
        used: user.imageCount,
        limit: config.limits.dailyImage,
        remaining: Math.max(0, config.limits.dailyImage - user.imageCount),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { generateImage };
