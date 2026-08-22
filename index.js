require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const mongoose = require("mongoose");

// ==========================================
// 1. MONGOOSE SCHEMAS & MODELS
// ==========================================
const UserSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  platoId: { type: String, required: true },
  favGames: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const MatchSchema = new mongoose.Schema({
  matchId: { type: String, required: true },
  round: { type: Number, required: true },
  players: [{ type: String, required: true }],
  winner: { type: String, default: null },
  status: { type: String, enum: ["PENDING", "COMPLETED"], default: "PENDING" },
  messageId: { type: String, default: null },
});

const TournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  game: { type: String, required: true },
  format: {
    type: String,
    enum: ["1v1", "2v2", "1v1v1", "1v1v1v1"],
    required: true,
  },
  status: {
    type: String,
    enum: ["REGISTRATION", "IN_PROGRESS", "COMPLETED"],
    default: "REGISTRATION",
  },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  participants: [{ type: String }],
  currentRound: { type: Number, default: 1 },
  matches: [MatchSchema],
});

const GuildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  tourneyChannelId: { type: String, required: true },
});

const User = mongoose.model("User", UserSchema);
const Tournament = mongoose.model("Tournament", TournamentSchema);
const GuildConfig = mongoose.model("GuildConfig", GuildConfigSchema);

// ==========================================
// 2. BRACKET & FORMAT UTILITIES
// ==========================================
const FORMAT_SIZES = {
  "1v1": 2,
  "2v2": 4,
  "1v1v1": 3,
  "1v1v1v1": 4,
};

function generateRoundMatches(participantEntries, format, roundNumber) {
  const groupSize = FORMAT_SIZES[format];
  const shuffled = [...participantEntries].sort(() => Math.random() - 0.5);
  const matches = [];
  let matchIndex = 1;

  for (let i = 0; i + groupSize <= shuffled.length; i += groupSize) {
    const group = shuffled.slice(i, i + groupSize);

    if (format === "2v2" && group.length === 4) {
      matches.push({
        matchId: `R${roundNumber}M${matchIndex++}`,
        round: roundNumber,
        players: [`${group[0]},${group[1]}`, `${group[2]},${group[3]}`],
        winner: null,
        status: "PENDING",
      });
    } else {
      matches.push({
        matchId: `R${roundNumber}M${matchIndex++}`,
        round: roundNumber,
        players: group,
        winner: null,
        status: "PENDING",
      });
    }
  }
  return matches;
}

async function buildMatchCard(tourney, match) {
  const embed = new EmbedBuilder()
    .setTitle(`${tourney.name} — Round ${match.round}`)
    .setDescription(
      `**Match:** \`${match.matchId}\`\n**Game:** ${tourney.game} (${tourney.format})`,
    )
    .setColor(match.status === "COMPLETED" ? 0x57f287 : 0x5865f2);

  const playerDetails = [];

  for (let i = 0; i < match.players.length; i++) {
    const entry = match.players[i];
    const ids = entry.split(",");
    const profiles = await User.find({ discordId: { $in: ids } });

    const details = ids
      .map((id) => {
        const profile = profiles.find((p) => p.discordId === id);
        const platoTag = profile
          ? `(Plato: **${profile.platoId}**)`
          : "(Plato: *Unlinked*)";
        return `<@${id}> ${platoTag}`;
      })
      .join(" & ");

    playerDetails.push(`**Slot ${i + 1}:** ${details}`);
  }

  embed.addFields(
    { name: "Participants", value: playerDetails.join("\n") },
    {
      name: "Status",
      value: match.winner
        ? `🏆 Winner: ${match.winner
            .split(",")
            .map((id) => `<@${id}>`)
            .join(" & ")}`
        : "⏳ In Progress",
    },
  );

  const row = new ActionRowBuilder();

  match.players.forEach((playerStr, idx) => {
    const isWinner = match.winner === playerStr;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`win:${tourney._id}:${match.matchId}:${idx}`)
        .setLabel(`Slot ${idx + 1} Win`)
        .setStyle(isWinner ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(match.status === "COMPLETED" && isWinner),
    );
  });

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`reset:${tourney._id}:${match.matchId}`)
      .setLabel("🔄 Reset")
      .setStyle(ButtonStyle.Danger),
  );

  return { embed, components: [row] };
}

// ==========================================
// 3. SLASH COMMAND DEFINITIONS
// ==========================================
const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set the dedicated channel for hosting tournaments")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("The tournament channel")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Plato username and favorite games")
    .addStringOption((opt) =>
      opt
        .setName("plato_id")
        .setDescription("Your exact Plato username")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("fav_games")
        .setDescription(
          "Comma-separated favorite games (e.g. Ocho, Pool, 8-Ball)",
        )
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View a player profile")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("Discord user to check")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Unlink your Plato account data"),

  new SlashCommandBuilder()
    .setName("tourney")
    .setDescription("Tournament management commands")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new tournament registration")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Tournament Name")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("game")
            .setDescription("Plato Game (e.g. Ocho, Pool, Bowling)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("format")
            .setDescription("Match structure")
            .setRequired(true)
            .addChoices(
              { name: "1v1", value: "1v1" },
              { name: "2v2", value: "2v2" },
              { name: "(3P) 1v1v1", value: "1v1v1" },
              { name: "(4P) 1v1v1v1", value: "1v1v1v1" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Close registration and generate Round 1 brackets"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("cancel")
        .setDescription("Cancel active tournament in this channel"),
    ),
];

// ==========================================
// 4. CLIENT INITIALIZATION & EVENTS
// ==========================================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log("Registering global slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands.map((c) => c.toJSON()),
    });
    console.log("Global slash commands deployed successfully.");
  } catch (err) {
    console.error("Error deploying commands:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  // --- A. SLASH COMMANDS ---
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === "setup") {
      if (
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          content: "You need `Manage Server` permissions to run `/setup`.",
          ephemeral: true,
        });
      }

      const targetChannel = interaction.options.getChannel("channel");

      await GuildConfig.findOneAndUpdate(
        { guildId: interaction.guildId },
        { tourneyChannelId: targetChannel.id },
        { upsert: true, new: true },
      );

      return interaction.reply({
        content: `Tournament operations are now locked to <#${targetChannel.id}>.`,
        ephemeral: true,
      });
    }

    if (commandName === "link") {
      const platoId = interaction.options.getString("plato_id");
      const favGamesRaw = interaction.options.getString("fav_games");
      const favGames = favGamesRaw
        ? favGamesRaw.split(",").map((g) => g.trim())
        : [];

      await User.findOneAndUpdate(
        { discordId: interaction.user.id },
        { platoId, favGames },
        { upsert: true, new: true },
      );

      return interaction.reply({
        content: `Linked! Plato ID: **${platoId}** | Fav Games: ${
          favGames.length ? favGames.join(", ") : "None specified"
        }`,
        ephemeral: true,
      });
    }

    if (commandName === "profile") {
      const targetUser =
        interaction.options.getUser("target") || interaction.user;
      const profile = await User.findOne({ discordId: targetUser.id });

      if (!profile) {
        return interaction.reply({
          content: `${targetUser.username} has not linked their Plato account yet. Run \`/link\` first.`,
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Plato Profile`)
        .setColor(0x00ae86)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: "Plato ID", value: `\`${profile.platoId}\``, inline: true },
          {
            name: "Favorite Games",
            value: profile.favGames.length
              ? profile.favGames.join("\n")
              : "None added",
            inline: true,
          },
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "unlink") {
      await User.findOneAndDelete({ discordId: interaction.user.id });
      return interaction.reply({
        content: "Your Plato account has been unlinked.",
        ephemeral: true,
      });
    }

    if (commandName === "tourney") {
      // Channel locking enforcement
      const config = await GuildConfig.findOne({
        guildId: interaction.guildId,
      });
      if (!config) {
        return interaction.reply({
          content:
            "This server has not configured a tournament channel yet. An admin must run `/setup channel:#your-channel` first.",
          ephemeral: true,
        });
      }

      if (interaction.channelId !== config.tourneyChannelId) {
        return interaction.reply({
          content: `Tournament commands can only be used in <#${config.tourneyChannelId}>.`,
          ephemeral: true,
        });
      }

      const sub = interaction.options.getSubcommand();

      if (sub === "create") {
        const name = interaction.options.getString("name");
        const game = interaction.options.getString("game");
        const format = interaction.options.getString("format");

        const active = await Tournament.findOne({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          status: { $in: ["REGISTRATION", "IN_PROGRESS"] },
        });

        if (active) {
          return interaction.reply({
            content: "An active tournament is already running in this channel.",
            ephemeral: true,
          });
        }

        const tourney = await Tournament.create({
          name,
          game,
          format,
          channelId: interaction.channelId,
          guildId: interaction.guildId,
          participants: [],
        });

        const joinRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`join_${tourney._id}`)
            .setLabel("🎮 Join Tournament")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`leave_${tourney._id}`)
            .setLabel("Leave")
            .setStyle(ButtonStyle.Secondary),
        );

        const embed = new EmbedBuilder()
          .setTitle(`🏆 Tournament: ${name}`)
          .setDescription(
            `**Game:** ${game}\n**Format:** ${format}\n\nClick below to register. You must run \`/link\` before joining!`,
          )
          .addFields({
            name: "Participants (0)",
            value: "No one has joined yet.",
          })
          .setColor(0xfee75c);

        return interaction.reply({ embeds: [embed], components: [joinRow] });
      }

      if (sub === "start") {
        if (
          !interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)
        ) {
          return interaction.reply({
            content:
              "Only staff with `Manage Events` permission can start the tournament.",
            ephemeral: true,
          });
        }

        const tourney = await Tournament.findOne({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          status: "REGISTRATION",
        });

        if (!tourney) {
          return interaction.reply({
            content:
              "No tournament currently in registration found in this channel.",
            ephemeral: true,
          });
        }

        const groupSize = FORMAT_SIZES[tourney.format];
        if (tourney.participants.length < groupSize) {
          return interaction.reply({
            content: `You need at least ${groupSize} participants for a ${tourney.format} format (Current: ${tourney.participants.length}).`,
            ephemeral: true,
          });
        }

        // Exclude late registrations outside whole groups
        const remainder = tourney.participants.length % groupSize;
        const validCount = tourney.participants.length - remainder;

        const activeParticipants = tourney.participants.slice(0, validCount);
        const excludedParticipants = tourney.participants.slice(validCount);

        tourney.participants = activeParticipants;

        const matches = generateRoundMatches(
          tourney.participants,
          tourney.format,
          1,
        );
        tourney.matches = matches;
        tourney.status = "IN_PROGRESS";
        tourney.currentRound = 1;
        await tourney.save();

        let startNotice = `🚀 **Tournament Started with ${validCount} Players! Generating Round 1 Brackets...**`;
        if (excludedParticipants.length > 0) {
          const excludedMentions = excludedParticipants
            .map((id) => `<@${id}>`)
            .join(", ");
          startNotice += `\n⚠️ **Late Registration Cutoff (${excludedParticipants.length}):** ${excludedMentions} were excluded to maintain clean ${tourney.format} groups.`;
        }

        await interaction.reply({ content: startNotice });

        for (const match of tourney.matches) {
          const { embed, components } = await buildMatchCard(tourney, match);
          const msg = await interaction.channel.send({
            embeds: [embed],
            components,
          });
          match.messageId = msg.id;
        }
        await tourney.save();
      }

      if (sub === "cancel") {
        if (
          !interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)
        ) {
          return interaction.reply({
            content:
              "Only staff with `Manage Events` permission can cancel tournaments.",
            ephemeral: true,
          });
        }

        await Tournament.deleteMany({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          status: { $in: ["REGISTRATION", "IN_PROGRESS"] },
        });

        return interaction.reply({
          content: "Active tournament in this channel has been cancelled.",
        });
      }
    }
  }

  // --- B. BUTTON INTERACTIONS ---
  if (interaction.isButton()) {
    const { customId } = interaction;

    // Join / Leave Registration
    if (customId.startsWith("join_") || customId.startsWith("leave_")) {
      const [action, tourneyId] = customId.split("_");
      const tourney = await Tournament.findById(tourneyId);

      if (!tourney || tourney.status !== "REGISTRATION") {
        return interaction.reply({
          content: "Registration is closed.",
          ephemeral: true,
        });
      }

      const isLinked = await User.findOne({ discordId: interaction.user.id });
      if (!isLinked) {
        return interaction.reply({
          content:
            "You must link your Plato account using `/link` before joining!",
          ephemeral: true,
        });
      }

      if (action === "join") {
        if (tourney.participants.includes(interaction.user.id)) {
          return interaction.reply({
            content: "You are already registered in this tournament.",
            ephemeral: true,
          });
        }
        tourney.participants.push(interaction.user.id);
      } else {
        tourney.participants = tourney.participants.filter(
          (id) => id !== interaction.user.id,
        );
      }

      await tourney.save();

      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.spliceFields(0, 1, {
        name: `Participants (${tourney.participants.length})`,
        value: tourney.participants.length
          ? tourney.participants.map((id) => `<@${id}>`).join(", ")
          : "No one has joined yet.",
      });

      await interaction.update({ embeds: [embed] });
    }

    // Staff Select Winner / Reset
    if (customId.startsWith("win:") || customId.startsWith("reset:")) {
      if (
        !interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)
      ) {
        return interaction.reply({
          content:
            "Only staff with `Manage Events` permission can select winners or reset matches.",
          ephemeral: true,
        });
      }

      await interaction.deferUpdate().catch(() => {});

      try {
        const parts = customId.split(":");
        const action = parts[0];
        const tourneyId = parts[1];
        const matchId = parts[2];

        const tourney = await Tournament.findById(tourneyId);
        if (!tourney || tourney.status !== "IN_PROGRESS") return;

        const match = tourney.matches.find((m) => m.matchId === matchId);
        if (!match) return;

        if (action === "win") {
          const slotIndex = parseInt(parts[3], 10);
          match.winner = match.players[slotIndex];
          match.status = "COMPLETED";
        } else if (action === "reset") {
          match.winner = null;
          match.status = "PENDING";
        }

        await tourney.save();

        const { embed, components } = await buildMatchCard(tourney, match);
        await interaction.editReply({ embeds: [embed], components });

        // Check round completion
        const currentRoundMatches = tourney.matches.filter(
          (m) => m.round === tourney.currentRound,
        );
        const allDone = currentRoundMatches.every(
          (m) => m.status === "COMPLETED",
        );

        if (allDone) {
          const winners = [];
          currentRoundMatches.forEach((m) => {
            const winnerIds = m.winner.split(",");
            winners.push(...winnerIds);
          });

          // Final tournament winner check
          if (
            winners.length === 1 ||
            (tourney.format === "2v2" && winners.length === 2)
          ) {
            tourney.status = "COMPLETED";
            await tourney.save();

            const winnerMentions = winners.map((id) => `<@${id}>`).join(" & ");
            return interaction.channel.send({
              content: `🎉 **TOURNAMENT COMPLETE!**\n👑 Congratulations to the Champion(s): ${winnerMentions}!`,
            });
          }

          // Advance to next round
          tourney.currentRound += 1;
          const nextRoundMatches = generateRoundMatches(
            winners,
            tourney.format,
            tourney.currentRound,
          );
          tourney.matches.push(...nextRoundMatches);
          await tourney.save();

          await interaction.channel.send({
            content: `🔔 **Round ${tourney.currentRound - 1} complete! Starting Round ${tourney.currentRound}...**`,
          });

          for (const nextMatch of nextRoundMatches) {
            const card = await buildMatchCard(tourney, nextMatch);
            const msg = await interaction.channel.send({
              embeds: [card.embed],
              components: card.components,
            });
            nextMatch.messageId = msg.id;
          }
          await tourney.save();
        }
      } catch (err) {
        console.error("Error processing match action:", err);
      }
    }
  }
});

// ==========================================
// 5. DATABASE CONNECTION & LOGIN
// ==========================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB database.");
    client.login(process.env.DISCORD_TOKEN);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
