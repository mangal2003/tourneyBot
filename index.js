require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  Routes,
} = require("discord.js");
const path = require("path");
const mongoose = require("mongoose");
const http = require("http");
const {
  handleGameInteractions,
  activeGameChannels,
} = require("./handlers/gameHandlers");

// Models
const ChatLog = require("./models/ChatLog");

// Services
const { checkAndModerateProfanity } = require("./services/autoModService");
const {
  generateChatSummary,
  answerContextualQuery,
} = require("./services/aiService");

// Process safeguards
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
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
  rest: {
    timeout: 30000,
  },
});

client.once("clientReady", () => {
  console.log(`[MARSIAN AI] Bot online as ${client.user.tag}`);
});

// ==========================================
// EMOJI RESOLVER & DISPATCH ENGINE
// ==========================================
const EMOTION_FALLBACKS = {
  laugh: ["😂", "🤣", "💀"],
  happy: ["😄", "✨", "🥳"],
  sad: ["😢", "😭", "🥺"],
  angry: ["😡", "🤬", "💢"],
  fire: ["🔥", "⚡", "💥"],
  love: ["❤️", "💖", "😍"],
  cry: ["😭", "😿", "💔"],
  gg: ["🏆", "👑", "🎯"],
  clown: ["🤡", "🎪", "🃏"],
  cool: ["😎", "🤙", "🕶️"],
  shock: ["😱", "🤯", "😳"],
  think: ["🤔", "🧐", "💭"],
};

async function getAvailableEmojis(client, guild) {
  const customList = [];

  try {
    if (client.application) {
      const appEmojis = await client.application.emojis.fetch();
      appEmojis.forEach((e) => {
        customList.push({
          name: e.name.toLowerCase(),
          tag: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
        });
      });
    }
  } catch (err) {
    console.error("Failed fetching app emojis:", err);
  }

  if (guild) {
    guild.emojis.cache.forEach((e) => {
      customList.push({
        name: e.name.toLowerCase(),
        tag: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
      });
    });
  }

  return customList;
}

async function selectEmojisForQuery(client, guild, query) {
  const allEmojis = await getAvailableEmojis(client, guild);
  const cleanQuery = query ? query.toLowerCase().trim() : "";

  let matched = [];

  if (cleanQuery) {
    matched = allEmojis
      .filter((e) => e.name.includes(cleanQuery) || cleanQuery.includes(e.name))
      .map((e) => e.tag);
  }

  if (matched.length === 0 && allEmojis.length > 0 && !cleanQuery) {
    matched = allEmojis.sort(() => 0.5 - Math.random()).map((e) => e.tag);
  }

  if (matched.length < 2 && cleanQuery) {
    for (const [key, fallbacks] of Object.entries(EMOTION_FALLBACKS)) {
      if (cleanQuery.includes(key) || key.includes(cleanQuery)) {
        matched.push(...fallbacks);
      }
    }
  }

  if (matched.length === 0) {
    if (allEmojis.length > 0) {
      matched = allEmojis.sort(() => 0.5 - Math.random()).map((e) => e.tag);
    } else {
      matched = ["✨", "🔥", "⚡"];
    }
  }

  const unique = Array.from(new Set(matched));
  const count = Math.min(unique.length, Math.floor(Math.random() * 2) + 2);
  return unique.slice(0, count).join(" ");
}

// Prefix Command (>emoji / >emj) Impersonation
async function sendImpersonatedEmojis(message, emojiOutput) {
  if (!message.guild) {
    const dmEmbed = new EmbedBuilder()
      .setAuthor({
        name: message.author.displayName || message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(emojiOutput)
      .setColor(0x2b2d31);

    return message.channel.send({ embeds: [dmEmbed] }).catch(() => {});
  }

  const botMember = message.guild.members.me;
  const channelPerms = message.channel.permissionsFor(botMember);

  if (!channelPerms || !channelPerms.has("ManageWebhooks")) {
    return message.channel.send({
      content: `**${message.member?.displayName || message.author.username}**: ${emojiOutput}`,
    });
  }

  try {
    const webhooks = await message.channel.fetchWebhooks();
    let hook = webhooks.find(
      (w) => w.owner?.id === message.client.user.id && w.token,
    );

    if (!hook) {
      hook = await message.channel.createWebhook({
        name: "ATX Emoji Dispatcher",
        avatar: message.client.user.displayAvatarURL(),
        reason: "Impersonated emoji messaging pipeline",
      });
    }

    await hook.send({
      content: emojiOutput,
      username:
        message.member?.displayName ||
        message.author.displayName ||
        message.author.username,
      avatarURL: message.author.displayAvatarURL({ dynamic: true }),
    });
  } catch (err) {
    console.error("Webhook Dispatch Failure:", err);
    await message.channel.send({
      content: `**${message.member?.displayName || message.author.username}**: ${emojiOutput}`,
    });
  }
}

// True Native Reply Connector Line for Webhooks (Guilds)
async function sendContextImpersonatedEmojis(
  interaction,
  targetMessage,
  emojiOutput,
) {
  const member = interaction.member;
  const user = interaction.user;
  const displayName = (
    member?.displayName ||
    user.displayName ||
    user.username
  ).slice(0, 32);
  const avatarURL = user.displayAvatarURL({
    forceStatic: false,
    extension: "png",
    size: 512,
  });

  const botMember = interaction.guild.members.me;
  const channelPerms = interaction.channel.permissionsFor(botMember);

  if (!channelPerms || !channelPerms.has("ManageWebhooks")) {
    console.warn(
      `[Webhook Warning] Missing "Manage Webhooks" in #${interaction.channel.name}`,
    );
    if (targetMessage) {
      return await targetMessage
        .reply({
          content: `**${displayName}**: ${emojiOutput}`,
          allowedMentions: { repliedUser: false },
        })
        .catch(() =>
          interaction.channel.send(`**${displayName}**: ${emojiOutput}`),
        );
    }
    return await interaction.channel.send(`**${displayName}**: ${emojiOutput}`);
  }

  try {
    const webhooks = await interaction.channel.fetchWebhooks();
    let hook = webhooks.find(
      (w) => w.owner?.id === interaction.client.user.id && w.token,
    );

    if (!hook) {
      hook = await interaction.channel.createWebhook({
        name: "Mars Context Relay",
        avatar: interaction.client.user.displayAvatarURL(),
        reason: "Context menu native reply impersonation",
      });
    }

    // Execute via REST API with message_reference to force Discord's native grey reply connector line
    const requestBody = {
      content: emojiOutput,
      username: displayName,
      avatar_url: avatarURL,
      allowed_mentions: {
        replied_user: false,
      },
    };

    if (targetMessage) {
      requestBody.message_reference = {
        message_id: targetMessage.id,
        fail_if_not_exists: false,
      };
    }

    await interaction.client.rest.post(Routes.webhook(hook.id, hook.token), {
      body: requestBody,
      auth: false,
    });
  } catch (err) {
    console.error("[Webhook Error] Could not send via webhook:", err);

    if (targetMessage) {
      await targetMessage
        .reply({
          content: `**${displayName}**: ${emojiOutput}`,
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
    } else {
      await interaction.channel.send(`**${displayName}**: ${emojiOutput}`);
    }
  }
}

// ==========================================
// UNIFIED INTERACTION HANDLER (SINGLETON)
// ==========================================
client.on("interactionCreate", async (interaction) => {
  // 1. Right-Click Context Menu Command ("React With Emojis")
  if (interaction.isMessageContextMenuCommand()) {
    if (interaction.commandName === "React With Emojis") {
      try {
        const modal = new ModalBuilder()
          .setCustomId(`emoji_modal_${interaction.targetMessage.id}`)
          .setTitle("Emoji Dispatcher");

        const input = new TextInputBuilder()
          .setCustomId("emoji_vibe_input")
          .setLabel("Enter Emotion, Action, or Vibe:")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. fire, happy, gg, laugh, cry, skull")
          .setMinLength(2)
          .setMaxLength(50)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return await interaction.showModal(modal);
      } catch (err) {
        if (err.code !== 40060 && err.code !== 10062) {
          console.error("[Context Menu Error]:", err);
        }
        return;
      }
    }
  }

  // 2. Modal Form Submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("emoji_modal_")) {
      const isGuild = !!interaction.guild;

      try {
        // In Guilds: defer ephemerally so the webhook can post separately.
        // In DMs/Group DMs: defer without ephemeral so editReply delivers the emojis.
        if (isGuild) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
          await interaction.deferReply();
        }
      } catch {
        return;
      }

      const targetMessageId = interaction.customId.replace("emoji_modal_", "");
      const vibe = interaction.fields.getTextInputValue("emoji_vibe_input");

      let targetMessage = null;
      try {
        targetMessage =
          await interaction.channel.messages.fetch(targetMessageId);
      } catch {
        // Message might be deleted or uncached
      }

      const emojiOutput = await selectEmojisForQuery(
        interaction.client,
        interaction.guild,
        vibe,
      );

      if (isGuild) {
        // Guild: send via impersonated webhook with native curved connector line
        await sendContextImpersonatedEmojis(
          interaction,
          targetMessage,
          emojiOutput,
        );
        return await interaction.deleteReply().catch(() => {});
      } else {
        // DMs / Group DMs: edit the deferred interaction reply without quotes
        return await interaction.editReply({
          content: emojiOutput,
        });
      }
    }
  }

  // 3. Slash Commands (/court, /dungeon, /spyfall, /twotruths, /twentyq)
  if (interaction.isChatInputCommand()) {
    try {
      await handleGameInteractions(interaction);
    } catch (err) {
      console.error("[Game Execution Error]:", err);
      if (interaction.deferred || interaction.replied) {
        await interaction
          .followUp({
            content: "Encountered an internal error while running this game.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: "Encountered an internal error while running this game.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
    return;
  }
});

// Auto-provision standard roles on server join
client.on("guildCreate", async (guild) => {
  try {
    const botMember = guild.members.me;
    if (!botMember) return;

    let defaultBotRole = guild.roles.cache.find(
      (r) => r.name.toLowerCase() === "bots",
    );

    if (!defaultBotRole && botMember.permissions.has("ManageRoles")) {
      defaultBotRole = await guild.roles.create({
        name: "Bots",
        color: 0xd62828,
        permissions: [
          "ViewChannel",
          "SendMessages",
          "ManageMessages",
          "ManageWebhooks",
          "UseExternalEmojis",
          "EmbedLinks",
          "AttachFiles",
          "ReadMessageHistory",
        ],
        reason: "Default automated role for bot functionality",
      });
    }

    if (defaultBotRole && botMember.permissions.has("ManageRoles")) {
      await botMember.roles.add(defaultBotRole);
      console.log(
        `[Auto-Role] Assigned "${defaultBotRole.name}" in ${guild.name}`,
      );
    }
  } catch (err) {
    console.error(`[Auto-Role Error] Failed in ${guild.name}:`, err);
  }
});

// ==========================================
// MESSAGE LISTENER (EMOJIS, AUTO-MOD, AI)
// ==========================================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const isEmojiCmd = /^>(emoji|emj)\b/i.test(content);

  // 1. Emoji Dispatcher (>emoji or >emj)
  if (isEmojiCmd) {
    const rawQuery = content.replace(/^>(emoji|emj)/i, "").trim();

    if (message.guild) {
      const botPerms = message.channel.permissionsFor(message.client.user);
      if (botPerms && botPerms.has("ManageMessages")) {
        await message.delete().catch(() => {});
      }
    }

    const emojiOutput = await selectEmojisForQuery(
      message.client,
      message.guild,
      rawQuery,
    );

    return await sendImpersonatedEmojis(message, emojiOutput);
  }

  if (!message.guild) return;

  if (activeGameChannels.has(message.channel.id)) return;

  const permissions = message.channel.permissionsFor(client.user);
  if (!permissions || !permissions.has(["ViewChannel", "SendMessages"])) {
    return;
  }

  // 2. Auto-Moderation (Warnings only)
  const wasViolated = await checkAndModerateProfanity(message);
  if (wasViolated) return;

  // 3. Persist to 24-hr TTL MongoDB memory
  ChatLog.create({
    guildId: message.guild.id,
    channelId: message.channel.id,
    authorId: message.author.id,
    authorTag: message.author.username,
    content: message.content,
  }).catch(() => {});

  // 4. Intelligent Conversation Triggers
  const botMentioned = message.mentions.has(client.user);
  const isPrefixed = message.content.toLowerCase().startsWith("?mars");

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

  const containsBotName = /\b(marsai|mars ai|ai mars|aimars|ai|mars)\b/i.test(
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
      cleanPrompt = cleanPrompt.slice(5).trim();
    } else {
      cleanPrompt = cleanPrompt
        .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
        .replace(/\b(marsai|mars ai|ai mars|aimars|ai|mars)\b/gi, "")
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
            "📡 **Radar is clear — not enough chat activity in the last 6 hours to form a debrief.**",
          );
        }
        const bannerFile = new AttachmentBuilder(
          path.join(__dirname, "assets/mars-banner.png"),
          {
            name: "mars-banner.png",
          },
        );
        const summaryEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🛰️ Summary • Last 6 Hours`)
          .setDescription(`${summary}`)
          .setImage("attachment://mars-banner.png")
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

// Database & Server Listener
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
    res.end("MARSIAN AI Engine Operational");
  })
  .listen(PORT, () =>
    console.log(`[Web] Keep-alive server running on port ${PORT}`),
  );
