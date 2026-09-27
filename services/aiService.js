const { GoogleGenAI } = require("@google/genai");
const ChatLog = require("../models/ChatLog");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function executeGenAI(prompt) {
  let lastError = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      lastError = err;
      if (err.status === 429 || err.status === 503) {
        await sleep(500);
        continue;
      }
      console.warn(`[AI Service] ${model} warning:`, err.message || err);
    }
  }

  console.error("[AI Service] Candidates exhausted:", lastError);
  return "CAPACITY_EXHAUSTED";
}

/**
 * High-speed translation: 0-budget thinking for sub-second generation
 */
async function translateToEnglish(text) {
  if (!text || !text.trim()) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate into natural, conversational English only. Do NOT output quotes, prefixes, or explanations:\n\n${text}`,
      config: {
        temperature: 0.1,
        maxOutputTokens: 250,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    if (response && response.text) {
      return response.text.trim();
    }
  } catch (err) {
    console.warn(
      "[Fast Translation Error, attempting fallback]:",
      err.message || err,
    );
    try {
      const fallback = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: `Translate into English only: ${text}`,
      });
      return fallback?.text?.trim() || null;
    } catch {
      return null;
    }
  }
  return null;
}

async function getApplicationEmojiContext(client) {
  try {
    if (!client || !client.application) {
      return { listPrompt: "", emojiMap: new Map() };
    }

    const appEmojis = await client.application.emojis.fetch();
    if (!appEmojis || appEmojis.size === 0) {
      return { listPrompt: "", emojiMap: new Map() };
    }

    const emojiMap = new Map();
    const promptLines = [];

    appEmojis.forEach((emoji) => {
      const tag = emoji.animated
        ? `<a:${emoji.name}:${emoji.id}>`
        : `<:${emoji.name}:${emoji.id}>`;
      emojiMap.set(emoji.name.toLowerCase(), tag);
      promptLines.push(`- :${emoji.name}: -> ${tag}`);
    });

    const listPrompt = `\nCUSTOM APPLICATION EMOJIS AVAILABLE:\n${promptLines.join("\n")}\n`;
    return { listPrompt, emojiMap };
  } catch (err) {
    return { listPrompt: "", emojiMap: new Map() };
  }
}

async function evaluateContentModeration(rawText) {
  const prompt = `
Analyze this text for moderation.
1. "isProfane": true if vulgar, curse, slur, or insult in ANY language (English, Hindi, Hinglish, Arabic, Spanish, etc.).
2. "isNonEnglish": true if non-English script/words are present.
3. "detectedLanguage": the language or "English".

Return ONLY raw JSON with no backticks:
{"isProfane": boolean, "isNonEnglish": boolean, "detectedLanguage": "string"}

Text:
"${rawText.replace(/"/g, '\\"')}"
`;

  try {
    const raw = await executeGenAI(prompt);
    if (!raw || raw === "CAPACITY_EXHAUSTED") return null;
    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    return null;
  }
}

async function generateChatSummary(channel, hours = 3) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const logs = await ChatLog.find({
    channelId: channel.id,
    createdAt: { $gte: cutoff },
  })
    .sort({ createdAt: 1 })
    .limit(200);

  if (logs.length < 4) return null;

  const transcript = logs
    .map((l) => `[${l.authorTag}]: ${l.content}`)
    .join("\n");

  const prompt = `
You are MARSIAN AI, summarizing chat activity for a server debrief.
Write the entire debrief strictly in clear, natural ENGLISH only.

Sections required:
### 📡 The Narrative
(2-3 sentences capturing the topics and atmosphere)

### ⚔️ Highlights
(2-3 bullet points: jokes, debates, gaming talk)

### 👑 Main Characters
(Active participants in bold)

Chat:
${transcript}
`;

  return await executeGenAI(prompt);
}

async function answerContextualQuery(message, query) {
  const recentLogs = await ChatLog.find({ channelId: message.channel.id })
    .sort({ createdAt: -1 })
    .limit(30);

  const contextChat = recentLogs
    .reverse()
    .map((l) => `[${l.authorTag}]: ${l.content}`)
    .join("\n");
  const { listPrompt, emojiMap } = await getApplicationEmojiContext(
    message.client,
  );

  const prompt = `
You are MARSIAN AI, an intelligent, helpful Discord companion.
Respond in natural plain text. You MUST respond solely in clear ENGLISH.
${listPrompt}

Recent Channel Context:
${contextChat || "None"}

User (@${message.author.username}):
${query}
`;

  let responseText = await executeGenAI(prompt);
  if (responseText === "CAPACITY_EXHAUSTED") return "CAPACITY_EXHAUSTED";

  for (const [name, tag] of emojiMap.entries()) {
    const pattern = new RegExp(`(?<!<a?):${name}:(?!\\d+>)`, "gi");
    responseText = responseText.replace(pattern, tag);
  }

  return responseText;
}

module.exports = {
  translateToEnglish,
  evaluateContentModeration,
  generateChatSummary,
  answerContextualQuery,
};
