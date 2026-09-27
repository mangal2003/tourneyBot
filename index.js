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

// Database Models
const ChatLog = require("./models/ChatLog");
const GuildWelcome = require("./models/GuildWelcome");

// Internal AI & Auto-Mod Services
const { checkAndModerateProfanity } = require("./services/autoModService");
const {
  translateToEnglish,
  generateChatSummary,
  answerContextualQuery,
} = require("./services/aiService");

// Process-level crash prevention
process.on("unhandledRejection", (reason) =>
  console.error("[Process Safeguard] Unhandled Rejection:", reason),
);
process.on("uncaughtException", (error) =>
  console.error("[Process Safeguard] Uncaught Exception:", error),
);

function splitMessage(text, maxLength = 1900) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let current = "";
  for (const line of text.split("\n")) {
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

function createCapacityEmbed() {
  return new EmbedBuilder()
    .setColor(0xff9900)
    .setDescription(
      "All active AI models are currently under heavy load.\nPlease wait **45–60 seconds** before making another request.",
    )
    .setFooter({ text: "Auto-Recovery System" })
    .setTimestamp();
}

// Client Gateway initialization with required Privileged Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
  rest: { timeout: 30000 },
});

client.once("clientReady", () => {
  console.log(`[MARSIAN AI] Bot connected as ${client.user.tag}`);
});

// ==========================================
// EMOJI RESOLVER & MATCHER ENGINE
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
  const list = [];
  try {
    if (client.application) {
      const appEmojis = await client.application.emojis.fetch();
      appEmojis.forEach((e) => {
        list.push({
          name: e.name.toLowerCase(),
          tag: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
        });
      });
    }
  } catch (err) {
    console.error("[Emoji Engine] Failed to fetch application emojis:", err);
  }

  if (guild) {
    guild.emojis.cache.forEach((e) => {
      list.push({
        name: e.name.toLowerCase(),
        tag: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
      });
    });
  }
  return list;
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
    matched =
      allEmojis.length > 0 ? allEmojis.map((e) => e.tag) : ["✨", "🔥", "⚡"];
  }

  const unique = Array.from(new Set(matched));
  const count = Math.min(unique.length, Math.floor(Math.random() * 2) + 2);
  return unique.slice(0, count).join(" ");
}

// ==========================================
// IMPERSONATION TRANSMISSION PIPELINE
// ==========================================
async function sendContextImpersonatedMessage(
  interaction,
  targetMessage,
  content,
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

  if (!interaction.guild) {
    return await interaction.editReply({ content });
  }

  const botMember = interaction.guild.members.me;
  const channelPerms = interaction.channel.permissionsFor(botMember);

  if (!channelPerms || !channelPerms.has("ManageWebhooks")) {
    if (targetMessage) {
      return await targetMessage
        .reply({
          content: `**${displayName}**: ${content}`,
          allowedMentions: { repliedUser: false },
        })
        .catch(() =>
          interaction.channel.send(`**${displayName}**: ${content}`),
        );
    }
    return await interaction.channel.send(`**${displayName}**: ${content}`);
  }

  try {
    const webhooks = await interaction.channel.fetchWebhooks();
    let hook = webhooks.find(
      (w) => w.owner?.id === interaction.client.user.id && w.token,
    );

    if (!hook) {
      hook = await interaction.channel.createWebhook({
        name: "Mars Relay",
        avatar: interaction.client.user.displayAvatarURL(),
        reason: "Impersonated emoji & translation relay",
      });
    }

    const payload = {
      content: content,
      username: displayName,
      avatar_url: avatarURL,
      allowed_mentions: { replied_user: false },
    };

    if (targetMessage) {
      payload.message_reference = {
        message_id: targetMessage.id,
        fail_if_not_exists: false,
      };
    }

    await interaction.client.rest.post(Routes.webhook(hook.id, hook.token), {
      body: payload,
      auth: false,
    });
  } catch (err) {
    console.error("[Webhook Error] Fallback to standard message reply:", err);
    if (targetMessage) {
      await targetMessage
        .reply({
          content: `**${displayName}**: ${content}`,
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
    } else {
      await interaction.channel.send(`**${displayName}**: ${content}`);
    }
  }
}

// ==========================================
// UNIFIED INTERACTION HANDLER
// ==========================================
client.on("interactionCreate", async (interaction) => {
  // 1. Context Menu Command: "React With Emojis"
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
      await interaction.deferReply({ ephemeral: isGuild }).catch(() => {});

      const targetMessageId = interaction.customId.replace("emoji_modal_", "");
      const vibe = interaction.fields.getTextInputValue("emoji_vibe_input");

      let targetMsg = null;
      try {
        targetMsg = await interaction.channel.messages.fetch(targetMessageId);
      } catch {}

      const output = await selectEmojisForQuery(
        interaction.client,
        interaction.guild,
        vibe,
      );

      if (isGuild) {
        await sendContextImpersonatedMessage(interaction, targetMsg, output);
        return await interaction.deleteReply().catch(() => {});
      } else {
        return await interaction.editReply({ content: output });
      }
    }
  }

  // 3. Slash Commands
  if (interaction.isChatInputCommand()) {
    // /emj & /emoji
    if (
      interaction.commandName === "emj" ||
      interaction.commandName === "emoji"
    ) {
      const isGuild = !!interaction.guild;
      await interaction.deferReply({ ephemeral: isGuild }).catch(() => {});

      const vibe = interaction.options.getString("vibe") || "";
      const output = await selectEmojisForQuery(
        interaction.client,
        interaction.guild,
        vibe,
      );

      if (isGuild) {
        await sendContextImpersonatedMessage(interaction, null, output);
        return await interaction.deleteReply().catch(() => {});
      } else {
        return await interaction.editReply({ content: output });
      }
    }

    // /trn (Universal Fast Translation)
    if (interaction.commandName === "trn") {
      const isGuild = !!interaction.guild;
      await interaction.deferReply({ ephemeral: isGuild }).catch(() => {});

      const text = interaction.options.getString("text");
      const translation = await translateToEnglish(text);
      const output = translation || "*(Could not translate text)*";

      if (isGuild) {
        await sendContextImpersonatedMessage(interaction, null, output);
        return await interaction.deleteReply().catch(() => {});
      } else {
        return await interaction.editReply({ content: output });
      }
    }

    // Multiplayer Party Games & Admin Setup (/court, /dungeon, /spyfall, /twotruths, /twentyq, /setwelcome)
    try {
      await handleGameInteractions(interaction);
    } catch (err) {
      console.error("[Command Router Error]:", err);
      if (interaction.deferred || interaction.replied) {
        await interaction
          .followUp({ content: "Internal execution error.", ephemeral: true })
          .catch(() => {});
      } else {
        await interaction
          .reply({ content: "Internal execution error.", ephemeral: true })
          .catch(() => {});
      }
    }
  }
});

// ==========================================
// AUTO-PROVISION DEFAULT BOT ROLE
// ==========================================
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
          "ModerateMembers",
        ],
        reason: "Default automated role for MarsBot functionality",
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
// MEMBER WELCOME LISTENER
// ==========================================
client.on("guildMemberAdd", async (member) => {
  if (member.user.bot) return;

  try {
    const config = await GuildWelcome.findOne({ guildId: member.guild.id });
    if (!config || !config.isEnabled || !config.channelId) return;

    const welcomeChannel = member.guild.channels.cache.get(config.channelId);
    if (!welcomeChannel) return;

    const perms = welcomeChannel.permissionsFor(member.guild.members.me);
    if (!perms || !perms.has(["SendMessages", "EmbedLinks"])) return;

    const formattedGreeting = config.greetingMessage
      .replace(/{user}/g, `${member}`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{memberCount}/g, member.guild.memberCount);

    const guideLines = [];
    if (config.rulesChannelId)
      guideLines.push(`📜 **Guidelines:** <#${config.rulesChannelId}>`);
    if (config.chatChannelId)
      guideLines.push(`💬 **General Chat:** <#${config.chatChannelId}>`);
    if (config.rolesChannelId)
      guideLines.push(`🎭 **Pick Roles:** <#${config.rolesChannelId}>`);

    const welcomeEmbed = new EmbedBuilder()
      .setColor(config.embedColor || 0x5865f2)
      .setAuthor({
        name: `Welcome to ${member.guild.name}!`,
        iconURL: member.guild.iconURL({ dynamic: true }) || undefined,
      })
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `${formattedGreeting}\n\n` +
          (guideLines.length > 0
            ? `### 🧭 Quick Start Guide\n${guideLines.join("\n")}\n\n`
            : "") +
          `> *You are member **#${member.guild.memberCount}** to join the community.*`,
      )
      .setTimestamp()
      .setFooter({
        text: `ID: ${member.id}`,
        iconURL: member.guild.iconURL({ dynamic: true }) || undefined,
      });

    if (config.bannerUrl) welcomeEmbed.setImage(config.bannerUrl);

    await welcomeChannel.send({
      content: `👋 Welcome ${member}!`,
      embeds: [welcomeEmbed],
    });
  } catch (err) {
    console.error("[Welcome Dispatch Error]:", err);
  }
});

// ==========================================
// MESSAGE LISTENER
// ==========================================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // Ignore DMs for general channel logging and auto-mod

  // 1. Auto-Moderation Interceptor (Multilingual profanity & dynamic scaling timeouts)
  const wasViolated = await checkAndModerateProfanity(message);
  if (wasViolated) return;

  // 2. Channel Isolation: Prevent interrupting active multiplayer game channels
  if (activeGameChannels.has(message.channel.id)) return;

  const permissions = message.channel.permissionsFor(client.user);
  if (!permissions || !permissions.has(["ViewChannel", "SendMessages"])) return;

  // 3. Save to 24-hr TTL MongoDB memory
  ChatLog.create({
    guildId: message.guild.id,
    channelId: message.channel.id,
    authorId: message.author.id,
    authorTag: message.author.username,
    content: message.content,
  }).catch(() => {});

  // 4. Conversational AI Triggers
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

    // Summary debrief trigger
    if (/summary|what happened|recap|tl;?dr/i.test(cleanPrompt)) {
      try {
        const summary = await generateChatSummary(message.channel, 3);

        if (summary === "CAPACITY_EXHAUSTED") {
          return message.reply({ embeds: [createCapacityEmbed()] });
        }

        if (!summary) {
          return message.reply(
            "📡 *Radar is clear — not enough chat activity in the last 3 hours to form a debrief.*",
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
          .setTitle("🛰️ Summary • Last 3 Hours")
          .setDescription(`${summary}`)
          .setImage("attachment://mars-banner.png")
          .setTimestamp();

        return message.reply({ embeds: [summaryEmbed], files: [bannerFile] });
      } catch (err) {
        console.error("[Summary Error]:", err);
        return message.reply({ embeds: [createCapacityEmbed()] });
      }
    }

    // Contextual Chat Response
    try {
      const response = await answerContextualQuery(message, cleanPrompt);

      if (response === "CAPACITY_EXHAUSTED") {
        return message.reply({ embeds: [createCapacityEmbed()] });
      }

      const chunks = splitMessage(response);
      await message.reply({ content: chunks[0] });
      for (let i = 1; i < chunks.length; i++) {
        await message.channel.send({ content: chunks[i] });
      }
    } catch (err) {
      console.error("[AI Error]:", err);
      return message.reply({ embeds: [createCapacityEmbed()] });
    }
  }
});

// Database & Server Initialization
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("[Database] Connected to MongoDB Atlas.");
    client.login(process.env.DISCORD_TOKEN);
  })
  .catch((err) =>
    console.error("[Database Error] MongoDB connection failed:", err),
  );

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("MARSIAN AI Engine Operational");
  })
  .listen(PORT, () =>
    console.log(`[Web] Keep-alive server running on port ${PORT}`),
  );
