const { GoogleGenAI } = require('@google/genai');
const config = require('./env');

/**
 * Single shared Gemini client instance (Google Gen AI SDK).
 * Only constructed when AI_PROVIDER=gemini to avoid requiring
 * a key for a provider that isn't in use.
 */
const gemini = new GoogleGenAI({ apiKey: config.gemini.apiKey });

module.exports = gemini;
