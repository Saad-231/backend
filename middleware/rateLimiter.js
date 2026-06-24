const config = require('../config/env');
const store = require('../models/store');
const { formatResetTime } = require('../utils/time');

/**
 * Reads the demo "user id" from a header set by the frontend
 * (a stable, locally-generated id — see frontend services/api.js).
 * In production, replace this with real auth (JWT/session).
 */
function resolveUserId(req) {
  return req.headers['x-user-id'] || 'anonymous';
}

function buildLimitPayload(kind, user) {
  const limit = kind === 'chat' ? config.limits.dailyChat : config.limits.dailyImage;
  return {
    limitReached: true,
    kind,
    limit,
    resetAt: user.resetAt,
    resetAtFriendly: formatResetTime(user.resetAt),
    message:
      kind === 'chat'
        ? `You've reached your daily limit of ${limit} messages.`
        : `You've reached your daily limit of ${limit} image generations.`,
  };
}

function chatRateLimiter(req, res, next) {
  const userId = resolveUserId(req);
  const user = store.getOrCreateUser(userId);

  if (user.chatCount >= config.limits.dailyChat) {
    return res.status(429).json(buildLimitPayload('chat', user));
  }

  req.userId = userId;
  next();
}

function imageRateLimiter(req, res, next) {
  const userId = resolveUserId(req);
  const user = store.getOrCreateUser(userId);

  if (user.imageCount >= config.limits.dailyImage) {
    return res.status(429).json(buildLimitPayload('image', user));
  }

  req.userId = userId;
  next();
}

module.exports = { chatRateLimiter, imageRateLimiter, resolveUserId, buildLimitPayload };
