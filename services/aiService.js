const { GoogleGenAI } = require("@google/genai");
const ChatLog = require("../models/ChatLog");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Generates an analytical summary of the last X hours for the current channel
async function generateChatSummary(channel, hours = 3) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const logs = await ChatLog.find({
    channelId: channel.id,
    createdAt: { $gte: cutoff },
  })
    .sort({ createdAt: 1 })
    .limit(200);

  if (logs.length < 4) {
    return "Not enough conversation recorded in this timeframe to generate an accurate summary.";
  }

  const transcript = logs
    .map((l) => `[${l.authorTag}]: ${l.content}`)
    .join("\n");

  const prompt = `
You are the AI supervisor of this Discord server.
Summarize the following chat conversation from the past ${hours} hours.
Highlight primary topics discussed, disagreements/agreements, and key participants involved.
Format with clean bullet points and an engaging, objective tone.

Chat Log:
${transcript}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text;
}

// Answers user questions using recent channel activity as situational context
async function answerContextualQuery(message, query) {
  const recentLogs = await ChatLog.find({ channelId: message.channel.id })
    .sort({ createdAt: -1 })
    .limit(30);

  const contextChat = recentLogs
    .reverse()
    .map((l) => `[${l.authorTag}]: ${l.content}`)
    .join("\n");

  const prompt = `
You are ATX AI, an authentic, sharp, and helpful community AI assistant for this Discord server.
Use the recent channel activity below as context to understand ongoing server events or discussions.
You can also answer general world knowledge, trivia, coding, and day-to-day questions.

Recent Channel Activity:
${contextChat || "No recent channel logs recorded."}

User Question (@${message.author.username}):
${query}

Respond directly, concisely, and helpfully. Keep Discord Markdown clean and aesthetic.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text;
}

module.exports = {
  generateChatSummary,
  answerContextualQuery,
};
