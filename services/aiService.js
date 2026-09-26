const { GoogleGenAI } = require("@google/genai");
const ChatLog = require("../models/ChatLog");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CANDIDATES = [
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.1-pro-preview",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetches Application Emojis uploaded to Discord Developer Portal
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

    const listPrompt = `
CUSTOM APPLICATION EMOJIS AVAILABLE:
You can naturally use the following custom server emojis when contextually fitting:
${promptLines.join("\n")}
`;

    return { listPrompt, emojiMap };
  } catch (err) {
    console.error("[AI Service] Failed to fetch application emojis:", err);
    return { listPrompt: "", emojiMap: new Map() };
  }
}

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
        console.warn(
          `[AI Service] ${model} throttled (${err.status}). Trying next candidate...`,
        );
        await sleep(600);
        continue;
      }

      console.warn(
        `[AI Service] ${model} encountered error (${err.status || "ERR"}):`,
        err.message || err,
      );
    }
  }

  console.error("[AI Service] All AI model candidates exhausted:", lastError);
  return "CAPACITY_EXHAUSTED";
}

/**
 * Universal Multilingual Auto-Mod Inspection:
 * Uses fast AI inference to determine profanity, toxicity, or swearing in ANY language
 * (e.g. Spanish "puta", Arabic "اللعنة", Hindi "bkl/mc", etc.)
 */
async function evaluateContentModeration(rawText) {
  const prompt = `
You are a strict, multilingual content safety evaluator for a Discord community.
Analyze the following text message for:
1. "isProfane": true if the text contains vulgarity, curses, insults, slurs, obscene body references, or profanity in ANY language (e.g. English, Spanish, Arabic, Hindi, Hinglish, Russian, French, etc.). Else false.
2. "isNonEnglish": true if the text contains non-English words, phrases, or scripts (e.g. Arabic, Hindi, Spanish, Cyrillic, etc.). Else false.
3. "detectedLanguage": the language or "English".

Return ONLY raw JSON with no Markdown backticks, matching this exact shape:
{"isProfane": boolean, "isNonEnglish": boolean, "detectedLanguage": "string"}

Message to analyze:
"${rawText.replace(/"/g, '\\"')}"
`;

  try {
    const rawResult = await executeGenAI(prompt);
    if (!rawResult || rawResult === "CAPACITY_EXHAUSTED") return null;

    const cleaned = rawResult
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[AI Moderation Evaluator Error]:", err);
    return null;
  }
}

// Generates an atmospheric channel debrief strictly in English
async function generateChatSummary(channel, hours = 6) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const logs = await ChatLog.find({
    channelId: channel.id,
    createdAt: { $gte: cutoff },
  })
    .sort({ createdAt: 1 })
    .limit(200);

  if (logs.length < 4) {
    return null;
  }

  const transcript = logs
    .map((l) => `[${l.authorTag}]: ${l.content}`)
    .join("\n");

  const prompt = `
You are MARSIAN AI, summarizing the chat for a gaming server debrief.
Summarize the conversation from the past ${hours} hours.

LANGUAGE ENFORCEMENT:
- You must write the ENTIRE summary in clear, natural ENGLISH only.
- Even if the users spoke in Hindi, Hinglish, or any other language, translate their points and write the debrief strictly in English.

FORMATTING REQUIREMENTS:
- DO NOT write an intro like "Here is the rundown" or "As an AI supervisor".
- Write 3 punchy sections with the EXACT headings below:

### 📡 The Narrative
(Write 2-3 engaging, crisp sentences capturing the vibe, hot topics, banter, or issues.)

### ⚔️ Highlights
(Provide 2-3 bullet points: key jokes, game talk, arguments, or questions.)

### 👑 Main Characters
(Mention who dominated the chat and what they were up to, using bold usernames.)

Tone: Sharp, observant, slightly witty, but accurate.

Chat Log:
${transcript}
`;

  return await executeGenAI(prompt);
}

// Answers questions in natural plain text
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
You are MARSIAN AI, a helpful, sharp, and authentic Discord assistant for this server.
Use the recent channel activity below to understand current discussions or inside context if relevant.
You can answer general questions, technical coding queries, or casually banter.

CRITICAL LANGUAGE RULE:
- YOU MUST RESPOND SOLELY AND EXCLUSIVELY IN ENGLISH.
- DO NOT mirror or speak in Hinglish, Hindi, Spanish, or any non-English language under any circumstances.
- If the user asks their question in Hinglish or another language, understand their question, but answer strictly in English. You may add a friendly, casual reminder like: "(Also, friendly reminder: please keep chat in English so everyone here can follow along!)".

CRITICAL FORMATTING INSTRUCTIONS:
- Speak naturally like a human participant in a Discord chat.
- Output ONLY plain text (standard Discord markdown like *italics*, **bold**, or code blocks is fine).
- DO NOT wrap your entire response in quote blocks ('>') or decorative ASCII frames.
- DO NOT add robotic prefixes like "Answer:", "AI Output:", or sign off with signatures.
- NEVER ping @everyone or @here.
${listPrompt}
- If you use any custom emojis listed above, write them naturally as :emoji_name: or use standard emojis where appropriate. Do not overuse them.

Recent Channel Activity:
${contextChat || "No recent channel logs recorded."}

User Question (@${message.author.username}):
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
  evaluateContentModeration,
  generateChatSummary,
  answerContextualQuery,
};
