const config = require('../config/env');
const aiProvider = require('../config/aiProvider');
const store = require('../models/store');
const { formatResetTime } = require('../utils/time');

function isImageAttachment(attachment) {
  return Boolean(attachment?.mimeType && attachment.mimeType.startsWith('image/'));
}

/**
 * Registers all chat-related socket event handlers on a connected socket.
 *
 * Events (client -> server):
 *   - "chat:send"      { chatId, userId, content, attachments? }
 *   - "chat:stop"      { chatId }  (abort an in-flight stream)
 *
 * Events (server -> client):
 *   - "chat:user-message"   the persisted user message (echo, for optimistic UI reconciliation)
 *   - "chat:token"          { chatId, token }  one word/chunk at a time
 *   - "chat:done"           { chatId, message }  final assembled message
 *   - "chat:error"          { chatId, error }
 *   - "chat:limit-reached"  { kind: 'chat', limit, resetAt, resetAtFriendly, message }
 */
function registerChatHandlers(io, socket) {
  // Track in-flight abort controllers per chat so "chat:stop" can cancel them.
  const activeStreams = new Map();

  socket.on('chat:send', async ({ chatId, userId, content, attachments }) => {
    try {
      if (!userId || !content?.trim()) {
        socket.emit('chat:error', { chatId, error: 'Invalid message payload.' });
        return;
      }

      const user = store.getOrCreateUser(userId);

      if (user.chatCount >= config.limits.dailyChat) {
        socket.emit('chat:limit-reached', {
          kind: 'chat',
          limit: config.limits.dailyChat,
          resetAt: user.resetAt,
          resetAtFriendly: formatResetTime(user.resetAt),
          message: `You've reached your daily limit of ${config.limits.dailyChat} messages.`,
        });
        return;
      }

      const chat = store.getChat(chatId) || store.createChat(userId);

      // Detect whether this message is actually an image request — even
      // phrased indirectly — so the user never needs to know about the
      // "/image" command. Skipped when an image attachment is present,
      // since that's a vision question about an uploaded photo, not a
      // generation request.
      const hasImageAttachment = (attachments || []).some(isImageAttachment);
      const recentHistory = store
        .getMessages(chat.id)
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content:
            m.type === 'image'
              ? `[I generated an image of: ${m.prompt || 'the requested subject'}]`
              : typeof m.content === 'string'
              ? m.content
              : '',
        }));
      const intent = hasImageAttachment
        ? { isImageRequest: false }
        : await aiProvider.detectImageIntent(content.trim(), recentHistory);

      if (intent.isImageRequest) {
        // Persist + echo the user's original message first, same as a
        // normal chat turn, so the conversation reads naturally.
        const userMessage = store.addMessage(chat.id, {
          role: 'user',
          type: 'text',
          content: content.trim(),
          attachments: attachments || [],
        });
        store.touchChat(chat.id, content.trim());
        socket.emit('chat:user-message', { chatId: chat.id, message: userMessage });

        try {
          const { url: imageUrl } = await aiProvider.generateImage(intent.prompt);
          user.imageCount = (user.imageCount || 0) + 1;

          store.addCreation(userId, {
            type: 'image',
            prompt: intent.prompt,
            url: imageUrl,
            chatId: chat.id,
          });

          const assistantMessage = store.addMessage(chat.id, {
            role: 'assistant',
            type: 'image',
            content: imageUrl,
            prompt: intent.prompt,
          });

          socket.emit('chat:done', {
            chatId: chat.id,
            message: assistantMessage,
            usage: {
              used: user.chatCount,
              limit: config.limits.dailyChat,
              remaining: Math.max(0, config.limits.dailyChat - user.chatCount),
            },
          });
        } catch (imgErr) {
          console.error('[NovaScribe] Auto-detected image generation failed:', imgErr.message);
          socket.emit('chat:error', { chatId: chat.id, error: imgErr.message });
        }
        return;
      }

      // Persist + echo the user message immediately.
      const userMessage = store.addMessage(chat.id, {
        role: 'user',
        type: 'text',
        content: content.trim(),
        attachments: attachments || [],
      });
      store.touchChat(chat.id, content.trim());
      socket.emit('chat:user-message', { chatId: chat.id, message: userMessage });

      // Build conversation history for context, preserving any image
      // attached to a message (camera capture, gallery upload, or
      // document) so the AI can actually see it — not just a placeholder.
      const history = store.getMessages(chat.id).map((m) => {
        if (m.type === 'image') {
          return {
            role: m.role,
            content: `[I generated an image of: ${m.prompt || 'the requested subject'}]`,
          };
        }

        const entry = { role: m.role, content: typeof m.content === 'string' ? m.content : '' };
        const imageAttachment = (m.attachments || []).find((a) => isImageAttachment(a));
        if (imageAttachment?.base64) {
          entry.imageBase64 = imageAttachment.base64;
          entry.imageMimeType = imageAttachment.mimeType;
        }
        return entry;
      });

      user.chatCount += 1;

      const controller = new AbortController();
      activeStreams.set(chat.id, controller);

      let buffer = '';
      let fullText = '';

      const emitWordChunks = (delta) => {
        buffer += delta;
        fullText += delta;

        // Flush whenever we have a whole "word" (whitespace boundary),
        // which produces the classic word-by-word typing animation
        // instead of a static spinner or a single dump of text.
        let boundary;
        // eslint-disable-next-line no-cond-assign
        while ((boundary = buffer.search(/\s/)) !== -1) {
          const word = buffer.slice(0, boundary + 1);
          buffer = buffer.slice(boundary + 1);
          socket.emit('chat:token', { chatId: chat.id, token: word });
        }
      };

      await aiProvider.streamChat(history, controller.signal, emitWordChunks);

      if (buffer) {
        socket.emit('chat:token', { chatId: chat.id, token: buffer });
      }

      const assistantMessage = store.addMessage(chat.id, {
        role: 'assistant',
        type: 'text',
        content: fullText.trim(),
      });

      activeStreams.delete(chat.id);

      socket.emit('chat:done', {
        chatId: chat.id,
        message: assistantMessage,
        usage: {
          used: user.chatCount,
          limit: config.limits.dailyChat,
          remaining: Math.max(0, config.limits.dailyChat - user.chatCount),
        },
      });
    } catch (err) {
      activeStreams.delete(chatId);
      if (err.name === 'AbortError') {
        socket.emit('chat:error', { chatId, error: 'Generation stopped.' });
        return;
      }
      console.error(
        `[NovaScribe] chat:send error (provider=${config.aiProvider}):`,
        err.message,
        err.status ? `(status ${err.status})` : ''
      );

      // Detect the AI provider's own rate-limit/quota error (HTTP 429 /
      // "RESOURCE_EXHAUSTED" / "Too Many Requests") and surface a clear,
      // specific message instead of the generic "unavailable" fallback —
      // this is a free-tier limit from the provider itself, not a
      // NovaScribe bug.
      const errString = `${err.message || ''} ${err.status || ''}`;
      const isProviderQuotaError = /429|RESOURCE_EXHAUSTED|quota|too many requests/i.test(errString);

      const providerNames = { groq: 'Groq', gemini: 'Gemini', openai: 'OpenAI' };
      const providerResetWindows = {
        groq: 'about a minute',
        gemini: '24 hours',
        openai: 'a short while',
      };
      const providerName = providerNames[config.aiProvider] || config.aiProvider;
      const resetWindow = providerResetWindows[config.aiProvider] || 'a short while';

      socket.emit('chat:error', {
        chatId,
        error: isProviderQuotaError
          ? `Your ${providerName} free-tier limit has been reached for now. It resets in ${resetWindow} — please try again, or switch AI_PROVIDER in backend/.env to a different provider.`
          : 'The AI service is unavailable right now. Please try again shortly.',
      });
    }
  });

  socket.on('chat:stop', ({ chatId }) => {
    const controller = activeStreams.get(chatId);
    if (controller) {
      controller.abort();
      activeStreams.delete(chatId);
    }
  });

  socket.on('disconnect', () => {
    activeStreams.forEach((controller) => controller.abort());
    activeStreams.clear();
  });
}

module.exports = registerChatHandlers;
