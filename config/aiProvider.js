const config = require('./env');

/**
 * Provider-agnostic AI interface.
 *
 * The rest of the backend (socket handlers, controllers) calls these
 * two functions only — `streamChat` and `generateImage` — and never
 * imports OpenAI or Gemini SDKs directly. This means switching
 * AI_PROVIDER in .env requires NO code changes anywhere else.
 */

const SYSTEM_PROMPT =
  'You are NovaScribe, a helpful, friendly, and concise AI assistant embedded in a chat app called NovaScribe.AI. Format responses clearly using markdown when useful. ' +
  'Facts about NovaScribe.AI, to use ONLY if relevant and ONLY answer what was actually asked: ' +
  'the owner, founder, and CEO (all three roles) is Saad Ali; he designed/built NovaScribe.AI; his date of birth is October 25, 2008; he is from Pakistan; his father\'s name is Sahib Ali. ' +
  'Answer precisely what is asked and nothing more: ' +
  'if asked only "who is the owner/founder/CEO" or "who made/designed this", answer with just the name "Saad Ali". ' +
  'If asked only for date of birth, answer with just that. If asked only for the father\'s name, answer with just that. ' +
  'Only combine multiple facts together (name, DOB, father\'s name, etc.) if the person explicitly asks for more detail, a full introduction, or "everything about" the founder — and even then keep it brief and professional, not a long biography. ' +
  'When responding in Urdu, prefer clear, simple, commonly-used Urdu script wording (avoid rare or highly literary words) so that text-to-speech voices can read it accurately.';
/**
 * Uses a fast, cheap classifier call to decide whether a user's message
 * is actually an image-generation request — even when phrased indirectly
 * (e.g. "a boy is standing with a bandage on his hand, make an image of
 * this") — without requiring the user to type a "/image" command.
 *
 * Returns either:
 * { isImageRequest: false }
 * { isImageRequest: true, prompt: "<a clean, descriptive image prompt>" }
 */
async function detectImageIntent(userText) {
  if (!userText || !userText.trim()) return { isImageRequest: false };

  // Power users typing the explicit command still work instantly,
  // without spending a classifier call.
  if (userText.trim().toLowerCase().startsWith('/image ')) {
    return { isImageRequest: true, prompt: userText.trim().slice(7).trim() };
  }

  const classifierPrompt =
    'Decide if the user message below is asking you to create/draw/generate a picture, image, photo, art, logo, or illustration — ' +
    'including indirect descriptions of a scene they want visualized (e.g. describing a person or setting and asking to see it). ' +
    'Respond with ONLY raw JSON, no markdown fences, no explanation, in exactly this shape:\n' +
    '{"isImageRequest": true or false, "prompt": "a clean, descriptive English image-generation prompt, or empty string if false"}\n\n' +
    `User message: "${userText.replace(/"/g, "'")}"`;

  try {
    let resultText = '';
    await streamChat(
      [{ role: 'user', content: classifierPrompt }],
      undefined,
      (chunk) => {
        resultText += chunk;
      }
    );

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { isImageRequest: false };

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.isImageRequest && parsed.prompt) {
      return { isImageRequest: true, prompt: String(parsed.prompt).trim() };
    }
    return { isImageRequest: false };
  } catch (err) {
    // If the classifier call itself fails for any reason, fail safe by
    // treating it as a normal chat message rather than blocking the
    // user's request entirely.
    console.error('[NovaScribe] Image-intent classification failed, defaulting to normal chat:', err.message);
    return { isImageRequest: false };
  }
}

/**
 * Streams a chat completion.
 * @param {Array<{role: 'user'|'assistant', content: string, imageBase64?: string, imageMimeType?: string}>} history
 * Each message may optionally include an attached image as base64 data
 * (no "data:" prefix) plus its mime type — this is how uploaded photos,
 * camera captures, and gallery images reach the AI as real visual input,
 * not just a "[image]" placeholder.
 * @param {AbortSignal} signal
 * @param {(chunkText: string) => void} onChunk
 * @returns {Promise<string>} the full assembled text
 */
async function streamChat(history, signal, onChunk) {
  // ⚡ سعد بھائی، یہ رہا وہ جادوئی چیک: اگر ہسٹری میں کوئی بھی امیج اپلوڈ ہوئی ہے، 
  // تو یہ آٹومیٹک ریکویسٹ کو Gemini کے پاس بھیج دے گا، چاہے .env میں کچھ بھی سیٹ ہو!
  const hasImage = history.some((m) => m.imageBase64);
  if (hasImage) {
    console.log("[NovaScribe] Image detected. Routing analysis request to Gemini.");
    return streamChatGemini(history, signal, onChunk);
  }

  // اگر امیج نہیں ہے، تو جو .env فائل میں پرووائیڈر ہے (جیسے 'groq')، وہی چلے گا
  if (config.aiProvider === 'groq') {
    return streamChatGroq(history, signal, onChunk);
  }
  if (config.aiProvider === 'gemini') {
    return streamChatGemini(history, signal, onChunk);
  }
  return streamChatOpenAI(history, signal, onChunk);
}

/**
 * Groq — free, fast inference (Llama 3.3 70B). Fully OpenAI-compatible,
 * so we reuse the same `openai` SDK, just pointed at Groq's base URL.
 * Free tier resets every minute (not once a day like Gemini), so this
 * is the default chat provider.
 */
async function streamChatGroq(history, signal, onChunk) {
  const OpenAI = require('openai');
  const groqClient = new OpenAI({
    apiKey: config.groq.apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const selectedModel = config.groq.chatModel;

  const messages = history.map((m) => {
    return { role: m.role, content: m.content };
  });

  let stream;
  try {
    stream = await groqClient.chat.completions.create(
      {
        model: selectedModel,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      },
      { signal }
    );
  } catch (err) {
    const detail = err?.message || 'Unknown error from Groq.';
    const wrapped = new Error(`Groq chat failed: ${detail}`);
    wrapped.status = err.status;
    throw wrapped;
  }

  let fullText = '';
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (!delta) continue;
    fullText += delta;
    onChunk(delta);
  }
  return fullText;
}

async function streamChatOpenAI(history, signal, onChunk) {
  const openai = require('./openai');

  const messages = history.map((m) => {
    if (m.imageBase64) {
      return {
        role: m.role,
        content: [
          { type: 'text', text: m.content || 'What is in this image?' },
          {
            type: 'image_url',
            image_url: { url: `data:${m.imageMimeType || 'image/png'};base64,${m.imageBase64}` },
          },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const stream = await openai.chat.completions.create(
    {
      model: config.openai.chatModel,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    },
    { signal }
  );

  let fullText = '';
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (!delta) continue;
    fullText += delta;
    onChunk(delta);
  }
  return fullText;
}

async function streamChatGemini(history, signal, onChunk) {
  const gemini = require('./gemini');

  // Gemini's chat format: roles are 'user' / 'model' (not 'assistant'),
  // and the system prompt is passed separately as systemInstruction.
  // Image parts use inlineData with raw base64 (no "data:" prefix).
  const contents = history.map((m) => {
    const parts = [];
    if (m.content) parts.push({ text: m.content });
    if (m.imageBase64) {
      parts.push({
        inlineData: {
          mimeType: m.imageMimeType || 'image/png',
          data: m.imageBase64,
        },
      });
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const stream = await gemini.models.generateContentStream({
    model: config.gemini.chatModel,
    contents,
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  let fullText = '';
  for await (const chunk of stream) {
    if (signal?.aborted) {
      const err = new Error('Generation stopped.');
      err.name = 'AbortError';
      err.name = 'AbortError';
      throw err;
    }
    const text = chunk.text;
    if (!text) continue;
    fullText += text;
    onChunk(text);
  }
  return fullText;
}

/**
 * Generates an image from a prompt.
 * Uses config.imageProvider (independent from the chat provider) so
 * chat can stay on Gemini while images use a separate free service.
 * @param {string} prompt
 * @returns {Promise<{ url: string }>} a usable image URL (http or data: URI)
 */
async function generateImage(prompt) {
  if (config.imageProvider === 'openai') {
    return generateImageOpenAI(prompt);
  }
  if (config.imageProvider === 'gemini') {
    return generateImageGemini(prompt);
  }

  // Default: Pollinations — free, open-source, needs a free no-card key.
  try {
    return await generateImagePollinations(prompt);
  } catch (err) {
    console.error('[NovaScribe] Pollinations image generation failed, falling back to Gemini:', err.message);
    // If Gemini has a key configured, try it as a fallback so the user
    // still gets an image instead of a hard failure.
    if (config.gemini.apiKey) {
      return generateImageGemini(prompt);
    }
    throw err;
  }
}

/**
 * Pollinations.ai — open-source generative AI platform. As of mid-2026,
 * image generation requires a free API key (no credit card) from
 * https://enter.pollinations.ai — the old fully-anonymous endpoint was
 * retired. The current endpoint is gen.pollinations.ai.
 */
async function generateImagePollinations(prompt) {
  if (!config.pollinations.apiKey) {
    throw new Error(
      'No POLLINATIONS_API_KEY set. Get a free key (no credit card) at https://enter.pollinations.ai and add it to backend/.env, or change IMAGE_PROVIDER in backend/.env.'
    );
  }

  const seed = Math.floor(Math.random() * 2_000_000_000);
  const url =
    `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}` +
    `?model=${encodeURIComponent(config.pollinations.imageModel)}&width=1024&height=1024&seed=${seed}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000); // 45s safety timeout

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.pollinations.apiKey}` },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Pollinations image generation timed out. Please try again.');
    }
    throw new Error(`Could not reach Pollinations image service: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      detail = body ? ` — ${body.slice(0, 300)}` : '';
    } catch {
      /* response body unavailable */
    }
    throw new Error(`Pollinations image generation failed with status ${response.status}${detail}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  return { url: `data:${contentType};base64,${base64}` };
}

async function generateImageOpenAI(prompt) {
  const openai = require('./openai');

  const response = await openai.images.generate({
    model: config.openai.imageModel,
    prompt,
    size: '1024x1024',
    n: 1,
  });

  const imageData = response.data[0];
  const url = imageData.url || `data:image/png;base64,${imageData.b64_json}`;
  return { url };
}

async function generateImageGemini(prompt) {
  const gemini = require('./gemini');

  let response;
  try {
    response = await gemini.models.generateContent({
      model: config.gemini.imageModel,
      contents: prompt,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
  } catch (err) {
    // Surface the real Gemini error (model name issues, quota, safety
    // blocks, etc.) instead of masking it with a generic message.
    const detail = err?.message || 'Unknown error from Gemini.';
    throw new Error(`Gemini image generation failed: ${detail}`);
  }

  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData);

  if (!imagePart) {
    const textPart = parts.find((p) => p.text)?.text;
    throw new Error(
      textPart
        ? `Gemini responded with text instead of an image: "${textPart.slice(0, 200)}"`
        : 'Gemini did not return an image for this prompt. Try a more descriptive prompt, or switch AI_PROVIDER to "openai" in backend/.env.'
    );
  }

  const mimeType = imagePart.inlineData.mimeType || 'image/png';
  const url = `data:${mimeType};base64,${imagePart.inlineData.data}`;
  return { url };
}

function stripMarkdownForSpeech(text) {
  return text.replace(/#{1,6}\s?/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}

module.exports = { streamChat, generateImage, detectImageIntent, stripMarkdownForSpeech };
