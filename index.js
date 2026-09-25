require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const http = require("http");

// Models
const ChatLog = require("./models/ChatLog");

// Services
const { checkAndModerateProfanity } = require("./services/autoModService");
const {
  generateChatSummary,
  answerContextualQuery,
} = require("./services/aiService");

// Process Protections
process.on("unhandledRejection", (reason) =>
  console.error("Unhandled Rejection:", reason),
);
process.on("uncaughtException", (error) =>
  console.error("Uncaught Exception:", error),
);

// Split helper for long Discord messages (> 2000 characters)
function splitMessage(text, maxLength = 1900) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let current = "";

  const lines = text.split("\n");
  for (const line of lines) {
    if ((current + "\n" + line).length > maxLength) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  rest: {
    timeout: 30000, // 30s timeout guard to avoid local UND_ERR_CONNECT_TIMEOUT issues
  },
});

client.once("clientReady", () => {
  console.log(`[ATX AI] Bot online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // 1. Auto-Moderation (Profanity & Language Check)
  const wasViolated = await checkAndModerateProfanity(message);
  if (wasViolated) return;

  // 2. Persist Message into Rolling Memory (MongoDB)
  ChatLog.create({
    guildId: message.guild.id,
    channelId: message.channel.id,
    authorId: message.author.id,
    authorTag: message.author.username,
    content: message.content,
  }).catch(() => {});

  // 3. INTELLIGENT TRIGGER DETECTION
  const botMentioned = message.mentions.has(client.user);
  const isPrefixed = message.content.toLowerCase().startsWith("?atx");

  // Check A: Did user click Discord "Reply" to one of the bot's previous messages?
  let isReplyingToBot = false;
  if (message.reference && message.reference.messageId) {
    try {
      const referencedMsg = await message.channel.messages.fetch(
        message.reference.messageId,
      );
      if (referencedMsg && referencedMsg.author.id === client.user.id) {
        isReplyingToBot = true;
      }
    } catch (e) {}
  }

  // Check B: Did user say the bot's name ("atx", "hey atx", "atx bot") naturally in sentence?
  const containsBotName = /\b(atx|atx ai|tourneybot)\b/i.test(message.content);

  // Check C: Ongoing Thread Continuity (Did bot speak in this channel within the last 60 seconds?)
  let isContinuingChat = false;
  if (!botMentioned && !isPrefixed && !isReplyingToBot) {
    try {
      const lastMessages = await message.channel.messages.fetch({ limit: 4 });
      const recentBotMsg = lastMessages.find(
        (m) =>
          m.author.id === client.user.id &&
          Date.now() - m.createdTimestamp < 60000,
      );
      // If bot spoke <60s ago and current message ends with "?" or is a short follow-up
      if (
        recentBotMsg &&
        (message.content.endsWith("?") ||
          message.content.split(" ").length <= 8)
      ) {
        isContinuingChat = true;
      }
    } catch (e) {}
  }

  // If any trigger conditions are met, invoke the AI
  const shouldRespond =
    botMentioned ||
    isPrefixed ||
    isReplyingToBot ||
    containsBotName ||
    isContinuingChat;

  if (shouldRespond) {
    let cleanPrompt = message.content;
    if (isPrefixed) {
      cleanPrompt = cleanPrompt.slice(4).trim();
    } else {
      cleanPrompt = cleanPrompt
        .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
        .replace(/\b(atx|atx ai)\b/gi, "")
        .trim();
    }

    if (!cleanPrompt) {
      return message.reply("Hey! What's on your mind?");
    }

    await message.channel.sendTyping();

    // Route A: Summary
    if (/summary|what happened|recap|tl;?dr/i.test(cleanPrompt)) {
      try {
        const summary = await generateChatSummary(message.channel, 3);
        if (!summary) {
          return message.reply(
            "📡 *Radar is clear — not enough chat activity in the last 3 hours to form a debrief.*",
          );
        }

        const summaryEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🛰️ Activity Log • Last 3 Hours`)
          .setDescription(
            `${summary}\n\n` + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          )
          .setFooter({
            text: `ATX AI `,
            iconURL: message.author.displayAvatarURL(),
          })
          .setTimestamp();

        return message.reply({ embeds: [summaryEmbed] });
      } catch (err) {
        console.error("Summary Generation Error:", err);
        return message.reply(
          "Could not generate summary at this moment. Try again shortly.",
        );
      }
    }

    // Route B: Natural Conversation & Q&A
    try {
      const response = await answerContextualQuery(message, cleanPrompt);
      const chunks = splitMessage(response);

      await message.reply({ content: chunks[0] });
      for (let i = 1; i < chunks.length; i++) {
        await message.channel.send({ content: chunks[i] });
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      return message.reply(
        "My neural processors hit a snag. Please ask again in a moment.",
      );
    }
  }
});

// Database & Keep-Alive Server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("[Database] Connected to MongoDB Atlas.");
    client.login(process.env.DISCORD_TOKEN);
  })
  .catch((err) => console.error("Database Connection Failure:", err));

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ATX AI Engine Operational");
  })
  .listen(PORT, () =>
    console.log(`[Web] Keep-alive server running on port ${PORT}`),
  );
