const config = require('../config/env');
const store = require('../models/store');
const { formatResetTime } = require('../utils/time');

/**
 * GET /api/chat/limit-status
 * Lets the frontend proactively check remaining quota
 * (e.g. to grey out the send button before hitting a 429).
 */
function getLimitStatus(req, res) {
  const userId = req.headers['x-user-id'] || 'anonymous';
  const user = store.getOrCreateUser(userId);

  res.json({
    chat: {
      used: user.chatCount,
      limit: config.limits.dailyChat,
      remaining: Math.max(0, config.limits.dailyChat - user.chatCount),
    },
    image: {
      used: user.imageCount,
      limit: config.limits.dailyImage,
      remaining: Math.max(0, config.limits.dailyImage - user.imageCount),
    },
    resetAt: user.resetAt,
    resetAtFriendly: formatResetTime(user.resetAt),
  });
}

module.exports = { getLimitStatus };
