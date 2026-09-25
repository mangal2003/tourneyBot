require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const path = require("path");
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

// Global Process Handlers
process.on("unhandledRejection", (reason) =>
  console.error("Unhandled Rejection:", reason),
);
process.on("uncaughtException", (error) =>
  console.error("Uncaught Exception:", error),
);

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

function createCapacityEmbed(guild, user) {
  return new EmbedBuilder()
    .setColor(0xff9900)
    .setDescription(
      `All active AI models are currently experiencing high request demand.\n\n` +
        `> **Cooldown Advisory:** Please give the AI processors **45–60 seconds** to reset before initiating another request or channel recap.`,
    )
    .setFooter({
      text: `Auto-Recovery`,
    })
    .setTimestamp();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  rest: {
    timeout: 30000,
  },
});

client.once("clientReady", () => {
  console.log(`[ATX AI] Bot online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // Check channel permissions
  const permissions = message.channel.permissionsFor(client.user);
  if (!permissions || !permissions.has(["ViewChannel", "SendMessages"])) {
    return;
  }

  // 1. Auto-Moderation (Warnings only, no message deletion)
  const wasViolated = await checkAndModerateProfanity(message);
  if (wasViolated) return;

  // 2. Persist to 24-hr TTL MongoDB memory
  ChatLog.create({
    guildId: message.guild.id,
    channelId: message.channel.id,
    authorId: message.author.id,
    authorTag: message.author.username,
    content: message.content,
  }).catch(() => {});

  // 3. Intelligent Conversation Triggers
  const botMentioned = message.mentions.has(client.user);
  const isPrefixed = message.content.toLowerCase().startsWith("?atx");

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

  const containsBotName = /\b(atxai|atx ai|ai atx|aiatx|ai|atx)\b/i.test(
    message.content,
  );

  let isContinuingChat = false;
  if (!botMentioned && !isPrefixed && !isReplyingToBot) {
    try {
      const lastMessages = await message.channel.messages.fetch({ limit: 4 });
      const recentBotMsg = lastMessages.find(
        (m) =>
          m.author.id === client.user.id &&
          Date.now() - m.createdTimestamp < 60000,
      );
      if (
        recentBotMsg &&
        (message.content.endsWith("?") ||
          message.content.split(" ").length <= 8)
      ) {
        isContinuingChat = true;
      }
    } catch (e) {}
  }

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
        .replace(/\b(atxai|atx ai|ai atx|aiatx|ai|atx)\b/gi, "")
        .trim();
    }

    if (!cleanPrompt) {
      return message.reply("Hey! What's on your mind?");
    }

    await message.channel.sendTyping();

    // Route A: Channel Debrief Summary
    if (/summary|what happened|recap|tl;?dr/i.test(cleanPrompt)) {
      try {
        const summary = await generateChatSummary(message.channel, 3);

        if (summary === "CAPACITY_EXHAUSTED") {
          return message.reply({
            embeds: [createCapacityEmbed(message.guild, message.author)],
          });
        }

        if (!summary) {
          return message.reply(
            "📡 *Radar is clear — not enough chat activity in the last 3 hours to form a debrief.*",
          );
        }
        const bannerFile = new AttachmentBuilder(
          path.join(__dirname, "assets/atx-banner.png"),
          {
            name: "atx-banner.png",
          },
        );
        const summaryEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🛰️ Summary • Last 3 Hours`)
          .setDescription(`${summary}`)
          .setImage("attachment://atx-banner.png")
          .setTimestamp();

        return message.reply({ embeds: [summaryEmbed], files: [bannerFile] });
      } catch (err) {
        console.error("Summary Generation Error:", err);
        return message.reply({
          embeds: [createCapacityEmbed(message.guild, message.author)],
        });
      }
    }

    // Route B: Contextual Q&A
    try {
      const response = await answerContextualQuery(message, cleanPrompt);

      if (response === "CAPACITY_EXHAUSTED") {
        return message.reply({
          embeds: [createCapacityEmbed(message.guild, message.author)],
        });
      }

      const chunks = splitMessage(response);
      await message.reply({ content: chunks[0] });
      for (let i = 1; i < chunks.length; i++) {
        await message.channel.send({ content: chunks[i] });
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      return message.reply({
        embeds: [createCapacityEmbed(message.guild, message.author)],
      });
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
