const OpenAI = require('openai');
const config = require('./env');

/**
 * Single shared OpenAI client instance.
 */
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

module.exports = openai;
