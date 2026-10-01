require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

// Internal Services
const { checkAndModerateProfanity } = require("./services/autoModService");
const {
  translateToEnglish,
  generateChatSummary,
  answerContextualQuery,
} = require("./services/aiService");

process.on("unhandledRejection", (r) =>
  console.error("[Process Safeguard] Unhandled Rejection:", r),
);
process.on("uncaughtException", (e) =>
  console.error("[Process Safeguard] Uncaught Exception:", e),
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
// VISUAL EMOJI GRID BUILDER (SERVERS & DMs)
// ==========================================
const userGridState = new Map(); // userId -> { page: 0, count: 1 }

let cachedAppEmojis = null;
let lastAppFetch = 0;

async function fetchAllAvailableEmojis(client, guild) {
  const emojiList = [];

  // Application Emojis (Universal across DMs & Servers)
  try {
    const now = Date.now();
    if (!cachedAppEmojis || now - lastAppFetch > 60000) {
      if (client.application) {
        cachedAppEmojis = await client.application.emojis.fetch();
        lastAppFetch = now;
      }
    }

    if (cachedAppEmojis) {
      cachedAppEmojis.forEach((e) => {
        emojiList.push({
          id: e.id,
          name: e.name,
          animated: e.animated,
          tag: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
        });
      });
    }
  } catch (err) {}

  // In DMs: Strictly application emojis
  if (!guild) {
    return emojiList;
  }

  // In Servers: Server custom emojis + application emojis
  try {
    const guildEmojis =
      guild.emojis.cache.size > 0
        ? guild.emojis.cache
        : await guild.emojis.fetch();
    guildEmojis.forEach((e) => {
      if (!emojiList.some((existing) => existing.id === e.id)) {
        emojiList.push({
          id: e.id,
          name: e.name,
          animated: e.animated,
          tag: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
        });
      }
    });
  } catch (err) {}

  return emojiList;
}

function buildEmojiGrid(emojiList, page = 0, count = 1, isDM = false) {
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(emojiList.length / PAGE_SIZE) || 1;
  const currentPage = Math.min(Math.max(0, page), totalPages - 1);

  const start = currentPage * PAGE_SIZE;
  const pageItems = emojiList.slice(start, start + PAGE_SIZE);

  const rows = [];
  let currentRow = new ActionRowBuilder();

  pageItems.forEach((emoji) => {
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `emj_send_${emoji.id}_${emoji.animated ? "1" : "0"}_${emoji.name}`,
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emoji.id),
    );

    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  });

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`emj_prev_${currentPage}`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId("emj_count_cycle")
      .setLabel(`Multiplier: ${count}x`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`emj_next_${currentPage}`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId("emj_close")
      .setLabel("✖ Close")
      .setStyle(ButtonStyle.Danger),
  );

  rows.push(controlRow);

  const titlePrefix = isDM ? "**MarsBot App Emojis**" : "**Select Emoji**";

  return {
    content: `${titlePrefix} • Page ${currentPage + 1}/${totalPages} (${emojiList.length} total)`,
    components: rows,
  };
}

// ==========================================
// UNIFIED INTERACTION HANDLER
// ==========================================
client.on("interactionCreate", async (interaction) => {
  // 1. Interactive Emoji Grid Buttons
  if (interaction.isButton()) {
    try {
      // Action: Dispatch chosen emoji
      if (interaction.customId.startsWith("emj_send_")) {
        const [, , id, isAnim, name] = interaction.customId.split("_");
        const emojiTag =
          isAnim === "1" ? `<a:${name}:${id}>` : `<:${name}:${id}>`;

        const state = userGridState.get(interaction.user.id) || { count: 1 };
        const output = Array(state.count).fill(emojiTag).join(" ");
        userGridState.delete(interaction.user.id);

        if (interaction.guild) {
          // Server: Use Webhook impersonation
          await interaction.deferUpdate().catch(() => {});

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
          const channel = interaction.channel;

          if (
            channel &&
            channel.permissionsFor(botMember)?.has("ManageWebhooks")
          ) {
            try {
              const webhooks = await channel.fetchWebhooks();
              let hook = webhooks.find(
                (w) => w.owner?.id === interaction.client.user.id && w.token,
              );

              if (!hook) {
                hook = await channel.createWebhook({
                  name: "Mars Relay",
                  avatar: interaction.client.user.displayAvatarURL(),
                  reason: "Impersonated emoji dispatch",
                });
              }

              await interaction.client.rest.post(
                Routes.webhook(hook.id, hook.token),
                {
                  body: {
                    content: output,
                    username: displayName,
                    avatar_url: avatarURL,
                    allowed_mentions: { replied_user: false },
                  },
                  auth: false,
                },
              );
            } catch (err) {
              await channel.send({ content: output }).catch(() => {});
            }
          } else {
            await interaction.channel.send({ content: output }).catch(() => {});
          }

          return await interaction.deleteReply().catch(() => {});
        } else {
          // Direct Messages (User-Install context):
          // Edit the reply directly into the message to prevent "Missing Access" errors
          return await interaction.update({
            content: output,
            components: [],
          });
        }
      }

      // Action: Previous Page
      if (interaction.customId.startsWith("emj_prev_")) {
        await interaction.deferUpdate().catch(() => {});
        const cur = parseInt(interaction.customId.replace("emj_prev_", ""), 10);
        const state = userGridState.get(interaction.user.id) || { count: 1 };
        const emojis = await fetchAllAvailableEmojis(
          interaction.client,
          interaction.guild,
        );
        const targetPage = Math.max(0, cur - 1);
        userGridState.set(interaction.user.id, { ...state, page: targetPage });

        const grid = buildEmojiGrid(
          emojis,
          targetPage,
          state.count,
          !interaction.guild,
        );
        return await interaction.editReply(grid).catch(() => {});
      }

      // Action: Next Page
      if (interaction.customId.startsWith("emj_next_")) {
        await interaction.deferUpdate().catch(() => {});
        const cur = parseInt(interaction.customId.replace("emj_next_", ""), 10);
        const state = userGridState.get(interaction.user.id) || { count: 1 };
        const emojis = await fetchAllAvailableEmojis(
          interaction.client,
          interaction.guild,
        );
        const targetPage = cur + 1;
        userGridState.set(interaction.user.id, { ...state, page: targetPage });

        const grid = buildEmojiGrid(
          emojis,
          targetPage,
          state.count,
          !interaction.guild,
        );
        return await interaction.editReply(grid).catch(() => {});
      }

      // Action: Multiplier Cycle (1x -> 2x -> 3x -> 5x -> 8x -> 1x)
      if (interaction.customId === "emj_count_cycle") {
        await interaction.deferUpdate().catch(() => {});
        const state = userGridState.get(interaction.user.id) || {
          page: 0,
          count: 1,
        };
        const counts = [1, 2, 3, 5, 8];
        const nextIdx = (counts.indexOf(state.count) + 1) % counts.length;
        const newCount = counts[nextIdx];
        userGridState.set(interaction.user.id, { ...state, count: newCount });

        const emojis = await fetchAllAvailableEmojis(
          interaction.client,
          interaction.guild,
        );
        const grid = buildEmojiGrid(
          emojis,
          state.page || 0,
          newCount,
          !interaction.guild,
        );
        return await interaction.editReply(grid).catch(() => {});
      }

      // Action: Close Menu
      if (interaction.customId === "emj_close") {
        await interaction.deferUpdate().catch(() => {});
        userGridState.delete(interaction.user.id);
        return await interaction.deleteReply().catch(() => {});
      }
    } catch (btnErr) {
      console.error("[Button Error Guard]:", btnErr.message);
    }
    return;
  }

  // 2. Right-Click Context Menu Command: "React With Emojis"
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
        return;
      }
    }
  }

  // 3. Modal Submissions (From Context Menu)
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("emoji_modal_")) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});

      const targetMessageId = interaction.customId.replace("emoji_modal_", "");
      const vibe = interaction.fields
        .getTextInputValue("emoji_vibe_input")
        .toLowerCase();

      let targetMsg = null;
      try {
        targetMsg = await interaction.channel.messages.fetch(targetMessageId);
      } catch {}

      const allEmojis = await fetchAllAvailableEmojis(
        interaction.client,
        interaction.guild,
      );
      const matched = allEmojis
        .filter((e) => e.name.toLowerCase().includes(vibe))
        .map((e) => e.tag);

      const output =
        matched.length > 0 ? matched.slice(0, 3).join(" ") : "✨ 🔥 ⚡";

      if (targetMsg) {
        await targetMsg
          .reply({ content: output, allowedMentions: { repliedUser: false } })
          .catch(() => {});
        return await interaction.deleteReply().catch(() => {});
      } else {
        return await interaction.editReply({ content: output }).catch(() => {});
      }
    }
  }

  // 4. Slash Commands
  if (interaction.isChatInputCommand()) {
    // /emj & /emoji
    if (
      interaction.commandName === "emj" ||
      interaction.commandName === "emoji"
    ) {
      // In Servers: Ephemeral picker so it doesn't clutter public chat
      // In DMs: Non-ephemeral so the final selection stays visible with the command header
      const isEphemeral = !!interaction.guild;
      await interaction.deferReply({ ephemeral: isEphemeral }).catch(() => {});

      const initialCount = interaction.options.getInteger("count") || 1;
      userGridState.set(interaction.user.id, { page: 0, count: initialCount });

      const emojis = await fetchAllAvailableEmojis(
        interaction.client,
        interaction.guild,
      );

      if (emojis.length === 0) {
        const errorMsg = !interaction.guild
          ? "❌ No application emojis found. Upload emojis under your bot's Developer Portal **Emojis** tab to use them in DMs."
          : "❌ No custom emojis found in this server.";

        return await interaction.editReply({ content: errorMsg });
      }

      const grid = buildEmojiGrid(emojis, 0, initialCount, !interaction.guild);
      return await interaction.editReply(grid);
    }

    // /trn
    if (interaction.commandName === "trn") {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});

      const text = interaction.options.getString("text");
      const translation = await translateToEnglish(text);
      const output = translation || "*(Could not translate text)*";

      return await interaction.editReply({ content: output });
    }

    // Game Router Isolation
    const GAME_COMMANDS = [
      "spyfall",
      "twotruths",
      "dungeon",
      "court",
      "twentyq",
      "setwelcome",
    ];
    if (GAME_COMMANDS.includes(interaction.commandName)) {
      try {
        await handleGameInteractions(interaction);
      } catch (err) {
        console.error("[Game Router Error]:", err.message);
        if (interaction.deferred && !interaction.replied) {
          await interaction
            .followUp({ content: "Internal execution error.", ephemeral: true })
            .catch(() => {});
        } else if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({ content: "Internal execution error.", ephemeral: true })
            .catch(() => {});
        }
      }
    }
  }
});

// Auto-Provision Default Bot Role
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
    }
  } catch (err) {
    console.error(`[Auto-Role Error] Failed in ${guild.name}:`, err);
  }
});

// Member Welcome Listener
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

// Message Listener (AI, Auto-Mod, Summaries)
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const wasViolated = await checkAndModerateProfanity(message);
  if (wasViolated) return;

  if (activeGameChannels.has(message.channel.id)) return;

  const permissions = message.channel.permissionsFor(client.user);
  if (!permissions || !permissions.has(["ViewChannel", "SendMessages"])) return;

  ChatLog.create({
    guildId: message.guild.id,
    channelId: message.channel.id,
    authorId: message.author.id,
    authorTag: message.author.username,
    content: message.content,
  }).catch(() => {});

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

    if (!cleanPrompt) return message.reply("Hey! What's on your mind?");

    await message.channel.sendTyping();

    if (/summary|what happened|recap|tl;?dr/i.test(cleanPrompt)) {
      try {
        const summary = await generateChatSummary(message.channel, 3);
        if (summary === "CAPACITY_EXHAUSTED")
          return message.reply({ embeds: [createCapacityEmbed()] });
        if (!summary)
          return message.reply(
            "📡 *Radar is clear — not enough chat activity in the last 3 hours to form a debrief.*",
          );

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
        return message.reply({ embeds: [createCapacityEmbed()] });
      }
    }

    try {
      const response = await answerContextualQuery(message, cleanPrompt);
      if (response === "CAPACITY_EXHAUSTED")
        return message.reply({ embeds: [createCapacityEmbed()] });

      const chunks = splitMessage(response);
      await message.reply({ content: chunks[0] });
      for (let i = 1; i < chunks.length; i++) {
        await message.channel.send({ content: chunks[i] });
      }
    } catch (err) {
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
