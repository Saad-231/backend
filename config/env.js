require('dotenv').config();

/**
 * Centralized environment/config access.
 *
 * AI_PROVIDER switches CHAT between providers with ZERO code changes —
 * just edit .env:
 * AI_PROVIDER=groq     -> uses GROQ_API_KEY (free, no card, resets every minute)
 * AI_PROVIDER=gemini   -> uses GEMINI_API_KEY (free, but only 20 requests/DAY)
 * AI_PROVIDER=openai   -> uses OPENAI_API_KEY (requires billing/card)
 *
 * IMAGE_PROVIDER switches IMAGE GENERATION independently — this lets you
 * keep chat on one provider while images use Pollinations (open-source,
 * free, requires only a free no-card account/key from enter.pollinations.ai):
 * IMAGE_PROVIDER=pollinations  -> free, needs POLLINATIONS_API_KEY (default)
 * IMAGE_PROVIDER=gemini        -> uses GEMINI_API_KEY's image quota
 * IMAGE_PROVIDER=openai        -> uses OPENAI_API_KEY (requires billing)
 */
const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  aiProvider: (process.env.AI_PROVIDER || 'groq').toLowerCase(),
  imageProvider: (process.env.IMAGE_PROVIDER || 'pollinations').toLowerCase(),

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    chatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    chatModel: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
    visionModel: process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview', // تصویر پڑھنے کے لیے ویژن ماڈل
  },

  pollinations: {
    apiKey: process.env.POLLINATIONS_API_KEY || '',
    imageModel: process.env.POLLINATIONS_IMAGE_MODEL || 'flux',
  },

  limits: {
    dailyChat: parseInt(process.env.DAILY_CHAT_LIMIT, 10) || 30,
    dailyImage: parseInt(process.env.DAILY_IMAGE_LIMIT, 10) || 5,
  },
};

const chatKeyByProvider = {
  groq: config.groq.apiKey,
  gemini: config.gemini.apiKey,
  openai: config.openai.apiKey,
};
const activeKey = chatKeyByProvider[config.aiProvider];

if (!activeKey) {
  const envVarName = { groq: 'GROQ_API_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' }[
    config.aiProvider
  ];
  // eslint-disable-next-line no-console
  console.warn(
    `[NovaScribe] WARNING: No API key set for chat provider "${config.aiProvider}". ` +
      `Add ${envVarName} to backend/.env, or change AI_PROVIDER in .env to switch providers.`
  );
}

if (config.imageProvider === 'pollinations' && !config.pollinations.apiKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[NovaScribe] WARNING: No POLLINATIONS_API_KEY set. Image generation will fail. ' +
      'Get a free key at https://enter.pollinations.ai and add it to backend/.env.'
  );
}

module.exports = config;
MONGODB_URI=mongodb+srv://saadali001:SAADTYPIST001@cluster0.7hwcycj.mongodb.net/novascribe?appName=Cluster0
GOOGLE_CLIENT_ID=252649808144-3cpsurc2ckni4vmjos3if02hlfanh7ja.apps.googleusercontent.com
JWT_SECRET=novascribe-secret-key-change-this
