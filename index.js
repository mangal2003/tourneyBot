require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType,
} = require("discord.js");
const mongoose = require("mongoose");
const http = require("http");

// ==========================================
// 1. GLOBAL PROCESS ERROR GUARDS
// ==========================================
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 2. DATASETS & STYLING UTILITIES
// ==========================================
const FANCY_STYLES = {
  happy: [
    "(*≧︶≦))(￣▽￣* )ゞ",
    "(づ｡◕‿‿◕｡)づ",
    "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
    "ヾ(≧▽≦*)o",
    "٩(◕‿◕｡)۶",
    "(✿◠‿◠)",
    "(つ≧▽≦)つ",
    "(★ω★)",
  ],
  rage: [
    "___*( ￣皿￣)/#____",
    "(ノಠ益ಠ)ノ彡┻━┻",
    "凸(￣ヘ￣)",
    "(╯°□°)╯︵ ʞooqǝɔɐɟ",
    "ᕙ(⇀‸↼‶)ᕗ",
    "(╬ಠ益ಠ)",
    "ᕦ(ò_óˇ)ᕤ",
  ],
  tableflip: [
    "(ノ°Д°）ノ︵ ┻━┻",
    "(╯°□°)╯︵ ┻━┻",
    "┬─┬ノ( º _ ºノ)",
    "┻━┻ ︵ ヽ(Д´)ﾉ ︵ ┻━┻",
    "(ヘ･_･)ヘ┳━┳",
    "(/¯◡ ‿ ◡)/¯ ~ ┻━┻",
  ],
  battle: [
    "(ง •̀_•́)ง",
    "⚔️ ( ￣ー￣)爻(￣ー￣ ) ⚔️",
    "(งಠ_ಠ)ง",
    "o(>< )o ᕦ(ò_óˇ)ᕤ",
    "(☞◣д◢)☞",
    "━╤デ╦︻(▀̿̿Ĺ̯̿̿▀̿ ̿)",
  ],
  confused: [
    "＼（〇_ｏ）／",
    "(⊙_⊙)？",
    "¯\\_(ツ)_/¯",
    "(・・ ) ?",
    "(╬▔皿▔)凸",
    "(°ロ°) !",
    "(＠_＠;)",
  ],
  smug: [
    "( ͡° ͜ʖ ͡°)",
    "(¬‿¬)",
    "(¬_¬ )",
    "( ˘ω˘ )",
    "( •̀ᴗ•́ )و",
    "( ▀ ͜ʖ ͡・)",
    "¯\\(°_o)/¯",
  ],
  crying: [
    "(╥﹏╥)",
    "(T_T)",
    "(っ- ‸ - ς)",
    "(இ﹏இ`｡)",
    "｡ﾟ(ﾟ´Д｀ﾟ)ﾟ｡",
    "ಥ_ಥ",
    "•́ε•̀٥",
  ],
  flex: ["ᕙ(▀̿̿Ĺ̯̿̿▀̿ ̿)ᕗ", "ᕙ(⇀‸↼‶)ᕗ", "ᕦ( ͡° ͜ʖ ͡°)ᕤ", "ᕙ(˘̀_˘́)ᕗ", "ᕦ(ò_ó)ᕤ"],
  cat: ["(=^･ω･^=)", "(=^･ｪ･^=)", "(=⌒‿‿⌒=)", "(=චᆽච=)", "චᆽච", "/ᐠ｡ꞈ｡ᐟ\\"],
  bear: ["ʕ•ᴥ•ʔ", "ʕ º ᴥ ºʔ", "ʕ •̀ o •́ ʔ", "ʕ´•ᴥ•`ʔ", "ʕっ•ᴥ•ʔっ"],
  hug: ["(づ￣ ³￣)づ", "(つ✧ω✧)つ", "(⊃｡•́‿•̀｡)⊃", "⊂(´• ω •`⊂)", "(つ≧▽≦)つ"],
  dead: ["(x_x)", "(×_×)⌒☆", "(+_+)", "☠️ ( 💀 ͜ʖ 💀 ) ☠️", "(×﹏×)"],
  dance: [
    "ヘ(^_^ヘ)",
    "(ノ^_^)ノ",
    "ヽ(°◇° )ノ",
    "♪ヽ(･ˇ∀ˇ･ゞ)",
    "ヾ(⌐■_■)ノ♪",
  ],
  roast: [
    "You play like your screen brightness is at 0. (ノ°Д°）ノ︵ ┻━┻",
    "Even an easy bot has cleaner mechanics than you. ¯\\_(ツ)_/¯",
    "You're the reason your bracket group was finished in 3 minutes. (￣▽￣*)ゞ",
    "I've seen Uno reverses sharper than your gameplay. ＼（〇_ｏ）／",
    "Brain.exe has stopped responding. (×_×)",
    "Bro is clicking buttons based on pure vibes. ( ˘ω˘ )",
    "WiFi isn't the problem, your gameplay is. ( ͡° ͜ʖ ͡°)",
  ],
  praise: [
    "Literal god gamer right here! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
    "Main character energy detected. ( ▀ ͜ʖ ͡・)",
    "Cleanest execution I've ever seen! ٩(◕‿◕｡)۶",
    "Carrying the entire server on your back. ᕙ(▀̿̿Ĺ̯̿̿▀̿ ̿)ᕗ",
  ],
};

const ORACLE_ANSWERS = [
  "Outlook is brighter than your future in competitive gaming. ٩(◕‿◕｡)۶",
  "The stars say YES, but your skill issue says absolutely not. ¯\\_(ツ)_/¯",
  "Outlook is as dark as your Plato match history. (╥﹏╥)",
  "Without a doubt... unless you choke at the last second. ( ͡° ͜ʖ ͡°)",
  "Ask again when your WiFi actually works. ＼（〇_ｏ）／",
  "Signs point to absolute disaster. (╯°□°)╯︵ ┻━┻",
  "Yes, 100% guaranteed by the Ocho Gods! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
  "Don't count on it. Even an AI wouldn't bet on that. 凸(￣ヘ￣)",
  "My sources say you need to touch some grass first. ʕ •̀ o •́ ʔ",
  "Most likely, but don't blame me when it backfires. (¬‿¬)",
];

const SUS_CRIMES = [
  "Caught throwing the 8-Ball match on purpose.",
  "Blaming latency after missing a completely stationary shot.",
  "Secretly googling Plato strategy guides mid-match.",
  "Pretending their phone died after getting 4 Draw cards in Ocho.",
  "Flexing an unearned win in global chat.",
  "Button-mashing and claiming it was 200 IQ calculated strategy.",
];

const ANIME_DUEL_MOVES = [
  {
    name: "8-Ball Bank Shot of Destiny",
    minDmg: 20,
    maxDmg: 32,
    p1Pose: "━╤デ╦︻(▀̿̿Ĺ̯̿̿▀̿ ̿)",
    p2Pose: "(°ロ°) !",
    text: "calculated the geometry of the universe and sniped",
  },
  {
    name: "Wild Draw-4 Card Barrage",
    minDmg: 25,
    maxDmg: 38,
    p1Pose: "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ 🎴",
    p2Pose: "(இ﹏இ`｡)",
    text: "unleashed an illegal stack of Draw-4 cards directly at",
  },
  {
    name: "Sub-Atomic Table Flip",
    minDmg: 28,
    maxDmg: 42,
    p1Pose: "(ノಠ益ಠ)ノ彡┻━┻",
    p2Pose: "＼（〇_ｏ）／",
    text: "raged beyond human limits and shattered a whole oak table into",
  },
  {
    name: "Lag Teleport Strike",
    minDmg: 18,
    maxDmg: 28,
    p1Pose: "ヘ(^_^ヘ) ~ 💨",
    p2Pose: "(⊙_⊙)？",
    text: "abused 999ms ping, vanished from reality, and backstabbed",
  },
  {
    name: "Bowling Ball Meteor Strike",
    minDmg: 30,
    maxDmg: 45,
    p1Pose: "ᕦ(ò_óˇ)ᕤ 🎳",
    p2Pose: "☠️ (×﹏×)",
    text: "hurled an oversized Plato bowling ball at supersonic speed towards",
  },
];

const RAGEBAIT_FLAVORS = [
  (text) =>
    text
      .split("")
      .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
      .join(""),
  (text) => text.split(" ").join(" 👏 "),
  (text) => `Bro actually unironically typed "${text}" with a straight face 💀`,
  (text) =>
    `"${text.toUpperCase()}" — says the one who got eliminated Round 1 😭`,
  (text) =>
    `Imagine thinking "${text}" was a valid point in the year 2026 ( ˘ω˘ )`,
];

const RAGEBAIT_EMOTES = [
  "(ノಠ益ಠ)ノ彡┻━┻",
  "凸(￣ヘ￣)",
  "(¬‿¬)",
  "( ˘ω˘ )",
  "＼（〇_ｏ）／",
  "( ͡° ͜ʖ ͡°)",
  "¯\\_(ツ)_/¯",
];

function generateRagebait(originalText) {
  if (!originalText || originalText.trim().length === 0) {
    return "Bro sent an empty message and expected a standing ovation 💀 ( ˘ω˘ )";
  }
  const transformer =
    RAGEBAIT_FLAVORS[Math.floor(Math.random() * RAGEBAIT_FLAVORS.length)];
  const emote =
    RAGEBAIT_EMOTES[Math.floor(Math.random() * RAGEBAIT_EMOTES.length)];
  const transformed = transformer(originalText);
  return `### "${transformed}"\n${emote}`;
}

function renderHealthBar(current, max = 100) {
  const totalBars = 10;
  const filled = Math.max(
    0,
    Math.min(totalBars, Math.round((current / max) * totalBars)),
  );
  const empty = totalBars - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${Math.max(0, current)}/${max} HP`;
}

function toVaporwave(text) {
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 33 && code <= 126
        ? String.fromCharCode(code + 0xfee0)
        : char === " "
          ? "  "
          : char;
    })
    .join("");
}

async function safeReply(interaction, options) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp(options);
    }
    return await interaction.reply(options);
  } catch (err) {
    if (err.code === 40060 || err.code === 10062) return;
    console.error("Error executing safeReply:", err);
  }
}

// ==========================================
// 3. MONGOOSE SCHEMAS & MODELS
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
// 4. BRACKET UTILITIES
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
// 5. SLASH & CONTEXT COMMAND DEFINITIONS
// ==========================================
const commands = [
  new SlashCommandBuilder()
    .setName("kaomoji")
    .setDescription(
      "Send expressive Japanese kaomoji art (Works in DMs, Groups, Servers)",
    )
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2])
    .addStringOption((opt) =>
      opt
        .setName("category")
        .setDescription(
          "Type to search: rage, tableflip, cat, bear, roast, smug, etc.",
        )
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("Direct this emote towards a user")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("fancy")
    .setDescription("Convert plain text into aesthetic vaporwave text")
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2])
    .addStringOption((opt) =>
      opt
        .setName("text")
        .setDescription("The text to stylize")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("duel")
    .setDescription("⚔️ Challenge someone to an animated mini RPG anime duel")
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2])
    .addUserOption((opt) =>
      opt
        .setName("opponent")
        .setDescription("The player to battle")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("oracle")
    .setDescription(
      "🔮 Ask the unhinged kaomoji oracle for a sarcastic fortune",
    )
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2])
    .addStringOption((opt) =>
      opt
        .setName("question")
        .setDescription("What question plagues your soul?")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("sus")
    .setDescription("📦 Run a lie detector & diagnostic scan on a player")
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2])
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User to scan").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("defuse")
    .setDescription(
      "💣 Hot Potato Bomb Defusal minigame (15s to pick the right wire)",
    )
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),

  new SlashCommandBuilder()
    .setName("escape")
    .setDescription(
      "🏃 Interactive ASCII Heist & Multi-Scenario Escape adventure",
    )
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),

  new SlashCommandBuilder()
    .setName("ragebait")
    .setDescription(
      "Transform any text into an obnoxious ragebait / mocking message",
    )
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2])
    .addStringOption((opt) =>
      opt
        .setName("text")
        .setDescription("The text to ragebait")
        .setRequired(true),
    ),

  new ContextMenuCommandBuilder()
    .setName("Ragebait Translate")
    .setType(ApplicationCommandType.Message)
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),

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
// 6. CLIENT INITIALIZATION & EVENTS
// ==========================================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log("Registering global slash and context commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands.map((c) => c.toJSON()),
    });
    console.log("Global commands deployed successfully.");
  } catch (err) {
    console.error("Error deploying commands:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    // --- A. AUTOCOMPLETE HANDLER ---
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === "kaomoji") {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = Object.keys(FANCY_STYLES);
        const filtered = choices
          .filter((choice) => choice.toLowerCase().includes(focusedValue))
          .slice(0, 25);

        await interaction.respond(
          filtered.map((choice) => ({
            name: `${choice.toUpperCase()} (${FANCY_STYLES[choice].length} options)`,
            value: choice,
          })),
        );
      }
      return;
    }

    // --- B. MESSAGE CONTEXT MENU COMMANDS ---
    if (interaction.isMessageContextMenuCommand()) {
      if (interaction.commandName === "Ragebait Translate") {
        const targetMsg = interaction.targetMessage;
        const author = targetMsg.author;
        const originalContent = targetMsg.content || "[Non-text attachment]";
        const ragebaitResult = generateRagebait(originalContent);

        return safeReply(interaction, {
          content: `> **${author.username}:** *${originalContent}*\n\n${ragebaitResult}`,
        });
      }
    }

    // --- C. SLASH COMMANDS ---
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // 1. KAOMOJI
      if (commandName === "kaomoji") {
        const category = interaction.options
          .getString("category")
          .toLowerCase();
        const target = interaction.options.getUser("target");
        const list = FANCY_STYLES[category] || FANCY_STYLES.happy;
        const pick = list[Math.floor(Math.random() * list.length)];

        if (category === "roast" || category === "praise") {
          const text = target ? `${target}, ${pick}` : pick;
          return safeReply(interaction, { content: text });
        }

        const response = target
          ? `${interaction.user} ➔ ${target}\n### ${pick}`
          : `### ${pick}`;

        return safeReply(interaction, { content: response });
      }

      // 2. FANCY VAPORWAVE TEXT
      if (commandName === "fancy") {
        const rawText = interaction.options.getString("text");
        const vaporText = toVaporwave(rawText);
        return safeReply(interaction, { content: vaporText });
      }

      // 3. RAGEBAIT (SLASH)
      if (commandName === "ragebait") {
        const rawText = interaction.options.getString("text");
        const ragebaitResult = generateRagebait(rawText);
        return safeReply(interaction, { content: ragebaitResult });
      }

      // 4. ANIMATED ANIME DUEL
      if (commandName === "duel") {
        const opponent = interaction.options.getUser("opponent");
        const initiator = interaction.user;

        if (opponent.id === initiator.id) {
          return safeReply(interaction, {
            content: "You can't duel yourself! (ノಠ益ಠ)ノ彡┻━┻",
            flags: 64,
          });
        }

        let p1Hp = 100;
        let p2Hp = 100;
        const maxHp = 100;

        let duelEmbed = new EmbedBuilder()
          .setTitle(
            `⚔️ ANIME DUEL: ${initiator.username} vs ${opponent.username}`,
          )
          .setColor(0xffaa00)
          .setDescription(
            `### ⚡ FIGHTERS ARE ENTERING THE ARENA...\n\n` +
              `**${initiator.username}** ${renderHealthBar(p1Hp, maxHp)}\n` +
              `**${opponent.username}** ${renderHealthBar(p2Hp, maxHp)}\n\n` +
              `*(ง •̀_•́)ง ═════════ ⚔️ ═════════ ᕦ(ò_óˇ)ᕤ*`,
          );

        await interaction.reply({ embeds: [duelEmbed] });
        await sleep(2000);

        let turn = Math.random() < 0.5 ? 1 : 2;
        let roundNum = 1;
        let lastActionLog = "";

        while (p1Hp > 0 && p2Hp > 0 && roundNum <= 7) {
          const move =
            ANIME_DUEL_MOVES[
              Math.floor(Math.random() * ANIME_DUEL_MOVES.length)
            ];
          const dmg =
            Math.floor(Math.random() * (move.maxDmg - move.minDmg + 1)) +
            move.minDmg;
          let arenaVisual = "";

          if (turn === 1) {
            p2Hp = Math.max(0, p2Hp - dmg);
            lastActionLog = `💥 **${initiator.username}** used **[${move.name}]**!\n*${move.text} ${opponent.username} for **${dmg} DMG!***`;
            arenaVisual = `${move.p1Pose} ━━━━━━💥━━━━━━▶ ${move.p2Pose}`;
            turn = 2;
          } else {
            p1Hp = Math.max(0, p1Hp - dmg);
            lastActionLog = `💥 **${opponent.username}** used **[${move.name}]**!\n*${move.text} ${initiator.username} for **${dmg} DMG!***`;
            arenaVisual = `${move.p2Pose} ◀━━━━━━💥━━━━━━ ${move.p1Pose}`;
            turn = 1;
          }

          duelEmbed = new EmbedBuilder()
            .setTitle(
              `⚔️ ROUND ${roundNum}: ${initiator.username} VS ${opponent.username}`,
            )
            .setColor(0xff4500)
            .setDescription(
              `### ${arenaVisual}\n\n` +
                `**${initiator.username}:** ${renderHealthBar(p1Hp, maxHp)}\n` +
                `**${opponent.username}:** ${renderHealthBar(p2Hp, maxHp)}\n\n` +
                `**Latest Move:**\n${lastActionLog}`,
            );

          await interaction.editReply({ embeds: [duelEmbed] }).catch(() => {});
          if (p1Hp <= 0 || p2Hp <= 0) break;
          await sleep(2200);
          roundNum++;
        }

        await sleep(1500);
        const winner = p1Hp > p2Hp ? initiator : opponent;
        const loser = p1Hp > p2Hp ? opponent : initiator;
        const winnerHp = Math.max(p1Hp, p2Hp);

        const finalEmbed = new EmbedBuilder()
          .setTitle(`🏆 K.O.! ${winner.username.toUpperCase()} IS VICTORIOUS!`)
          .setColor(0x57f287)
          .setDescription(
            `### 👑 **CHAMPION:** ${winner} (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧\n` +
              `💀 **KNOCKED OUT:** ${loser} *(x_x)⌒☆*\n\n` +
              `**Remaining Health:** ${renderHealthBar(winnerHp, maxHp)}\n\n` +
              `> *"Another warrior falls in the Plato battlegrounds."*`,
          );

        return interaction.editReply({ embeds: [finalEmbed] }).catch(() => {});
      }

      // 5. UNHINGED ORACLE
      if (commandName === "oracle") {
        const question = interaction.options.getString("question");
        const answer =
          ORACLE_ANSWERS[Math.floor(Math.random() * ORACLE_ANSWERS.length)];

        const embed = new EmbedBuilder()
          .setTitle("🔮 The Unhinged Kaomoji Oracle")
          .setColor(0x9b59b6)
          .addFields(
            { name: "❓ Your Question", value: `*${question}*` },
            { name: "📜 Prophecy", value: `### ${answer}` },
          );

        return safeReply(interaction, { embeds: [embed] });
      }

      // 6. SUS LIE DETECTOR
      if (commandName === "sus") {
        const target = interaction.options.getUser("target");
        const susPercent = Math.floor(Math.random() * 101);
        const crime = SUS_CRIMES[Math.floor(Math.random() * SUS_CRIMES.length)];

        let verdict = "🟢 INNOCENT (for now)";
        let kaomoji = "(✿◠‿◠)";
        let color = 0x57f287;

        if (susPercent > 70) {
          verdict = "🚨 CRITICALLY SUSPECT / IMPOSTOR DETECTED";
          kaomoji = "(╬ಠ益ಠ) ━╤デ╦︻";
          color = 0xed4245;
        } else if (susPercent > 35) {
          verdict = "🟡 SUSPICIOUS BEHAVIOR";
          kaomoji = "(¬_¬ )";
          color = 0xfee75c;
        }

        const embed = new EmbedBuilder()
          .setTitle(`📦 SUS DIAGNOSTIC SCAN: ${target.username}`)
          .setColor(color)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            {
              name: "Sus Meter",
              value: `${renderHealthBar(susPercent, 100)} (${susPercent}%)`,
            },
            { name: "Verdict", value: `**${verdict}**\n${kaomoji}` },
            { name: "Charge / Allegation", value: `*${crime}*` },
          );

        return safeReply(interaction, { embeds: [embed] });
      }

      // 7. HOT POTATO BOMB DEFUSAL
      if (commandName === "defuse") {
        const wires = ["red", "blue", "green"];
        const correctWire = wires[Math.floor(Math.random() * wires.length)];

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("defuse_red")
            .setLabel("🔴 Cut Red Wire")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("defuse_blue")
            .setLabel("🔵 Cut Blue Wire")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("defuse_green")
            .setLabel("🟢 Cut Green Wire")
            .setStyle(ButtonStyle.Success),
        );

        const bombEmbed = new EmbedBuilder()
          .setTitle("💣 TICK... TICK... BOMB ARMED!")
          .setColor(0xed4245)
          .setDescription(
            `### ⏳ **15 SECONDS TO DETONATION!**\n` +
              `\`\`\`text\n` +
              `    _____  \n` +
              `  /  BOMB \\ \n` +
              ` |  00:15  |=== [ 🔴 | 🔵 | 🟢 ]\n` +
              `  \\_______/\n` +
              `\`\`\`\n` +
              `*Choose a wire to cut before the whole server blows up! ᕦ(ò_óˇ)ᕤ*`,
          );

        const replyMsg = await interaction.reply({
          embeds: [bombEmbed],
          components: [row],
          fetchReply: true,
        });

        const collector = replyMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 15000,
        });

        collector.on("collect", async (btnInt) => {
          if (btnInt.user.id !== interaction.user.id) {
            return btnInt.reply({
              content: "This isn't your bomb to defuse! 凸(￣ヘ￣)",
              flags: 64,
            });
          }
          const chosenColor = btnInt.customId.replace("defuse_", "");
          collector.stop(chosenColor === correctWire ? "defused" : "exploded");
        });

        collector.on("end", async (collected, reason) => {
          const disabledRow = ActionRowBuilder.from(row);
          disabledRow.components.forEach((c) => c.setDisabled(true));

          if (reason === "defused") {
            const winEmbed = new EmbedBuilder()
              .setTitle("🎉 BOMB DEFUSED! SAFE!")
              .setColor(0x57f287)
              .setDescription(
                `### (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ **MISSION ACCOMPLISHED!**\n` +
                  `**${interaction.user.username}** successfully cut the safe wire (**${correctWire.toUpperCase()}**).\n\n` +
                  `*The tournament hall is saved! ٩(◕‿◕｡)۶*`,
              );
            await replyMsg
              .edit({ embeds: [winEmbed], components: [disabledRow] })
              .catch(() => {});
          } else {
            const failEmbed = new EmbedBuilder()
              .setTitle("💥 KABOOOOOM! DETONATION!")
              .setColor(0x2f3136)
              .setDescription(
                `### ☠️ ( 💀 ͜ʖ 💀 ) ☠️ **EVERYONE DIED!**\n` +
                  `The correct wire was: **${correctWire.toUpperCase()}**.\n\n` +
                  `*${reason === "time" ? "Timer ran out! (×_×)⌒☆" : "Wrong wire was cut! (ノಠ益ಠ)ノ彡┻━┻"}*`,
              );
            await replyMsg
              .edit({ embeds: [failEmbed], components: [disabledRow] })
              .catch(() => {});
          }
        });
        return;
      }

      // 8. MULTI-SCENARIO ASCII HEIST / ESCAPE
      if (commandName === "escape") {
        const SCENARIOS = [
          {
            title: "🏃 THE PLATO VAULT HEIST",
            color: 0xfee75c,
            art:
              "   [ TITANIUM VAULT ]\n" +
              "      ┌─────────┐\n" +
              "      │ 🔒 💎 🔒 │   👮‍♂️ (Laser Sensors)\n" +
              "      └────┬────┘\n" +
              "           ▲\n" +
              "      ( •_•) [YOU]",
            prompt:
              "You are standing outside the high-security Plato Trophy Vault. How will you breach it?",
            choices: [
              {
                id: "vent",
                label: "🪜 Crawl Through Vents",
                style: ButtonStyle.Primary,
                winRate: 0.65,
                winTitle: "🏆 SSS-RANK STEALTH INFILTRATION!",
                winArt: "   💎 💰 👑\n   \\(^ヮ^)/ [LOOT SECURED!]",
                winText:
                  "You slipped through the narrow ventilation shaft, dodged the heat sensors, and snatched 500,000 Plato Coins! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
                failTitle: "💀 VENT COLLAPSE!",
                failArt: "   💥 ┌───┐ 💥\n      │(x_x)│ [STUCK!]",
                failText:
                  "The rusty vent gave way under your weight and you crashed straight onto the Chief Admin's desk! (╥﹏╥)",
              },
              {
                id: "bribe",
                label: "🎴 Offer Wild Draw-4 Card",
                style: ButtonStyle.Secondary,
                winRate: 0.5,
                winTitle: "🏆 BRIBE ACCEPTED BY GUARD!",
                winArt: "   👮‍♂️ 🤝 (¬‿¬)\n   [VIP PASS GRANTED]",
                winText:
                  "The guard gasped: *'A golden Draw-4?! Take whatever you want, boss!'* You walked right out the front door with the trophy! (★ω★)",
                failTitle: "💀 BRIBE REJECTED!",
                failArt: "   👮‍♂️ ━╤デ╦︻ (╬ಠ益ಠ)\n   [CAUGHT IN 4K]",
                failText:
                  "The guard turned out to be an undercover tournament moderator. You were instantly banned to the shadow realm! 凸(￣ヘ￣)",
              },
              {
                id: "smash",
                label: "💥 Tableflip the Titanium Door",
                style: ButtonStyle.Danger,
                winRate: 0.35,
                winTitle: "🏆 UNSTOPPABLE CRITICAL SMASH!",
                winArt: "   (ノ°Д°）ノ︵ 🏢\n   [VAULT SHATTERED!]",
                winText:
                  "Against all laws of physics, your pure rage obliterated the titanium door and blasted the vault wide open! ᕙ(▀̿̿Ĺ̯̿̿▀̿ ̿)ᕗ",
                failTitle: "💀 SPINE FRACTURE!",
                failArt: "   💥 ┬─┬ノ( º _ ºノ)\n   [DOOR DIDN'T BUDGE]",
                failText:
                  "You threw yourself at a 50-ton blast door. You bounced off like a cartoon character and knocked yourself out cold. (×_×)⌒☆",
              },
            ],
          },
          {
            title: "🎰 UNDERGROUND 8-BALL CASINO BREAKOUT",
            color: 0x9b59b6,
            art:
              "   [ CASINO VIP LOUNGE ]\n" +
              "   🎱 🎲 🍸 💵\n" +
              "   🕵️‍♂️ (Bouncers Surrounding)\n" +
              "       ▲\n" +
              "   (⊙_⊙) [YOU'RE CORNERED]",
            prompt:
              "You just won all the chips at the VIP table and the house bouncers are blocking the exits! What's your escape plan?",
            choices: [
              {
                id: "smoke",
                label: "💨 Throw Smoke Bomb & Dive",
                style: ButtonStyle.Primary,
                winRate: 0.6,
                winTitle: "🏆 NINJA VANISH ESCAPE!",
                winArt: "   💨 💨 💨\n   ( ▀ ͜ʖ ͡・) [DISAPPEARED]",
                winText:
                  "You deployed a smoke screen, slid across the felt table, and vanished into the night with bags of cash! ٩(◕‿◕｡)۶",
                failTitle: "💀 SMOKE BOMB WAS A DUD!",
                failArt: "   (・・ ) ? 💥\n   [COUGHING FIT]",
                failText:
                  "You threw a smoke grenade, but it was just baby powder. The bouncers calmly escorted you to the kitchen dish pit. ＼（〇_ｏ）／",
              },
              {
                id: "bankshot",
                label: "🎱 Trick Cue-Ball Ricochet",
                style: ButtonStyle.Secondary,
                winRate: 0.45,
                winTitle: "🏆 200 IQ GEOMETRY MASTER!",
                winArt: "   🎱 💥 💥 💥\n   (ง •̀_•́)ง [ALL BOUNCERS K.O.]",
                winText:
                  "You struck the cue ball at mach 3, ricocheted it off 4 walls, and knocked out all 3 bouncers in one trick shot! 👑",
                failTitle: "💀 SCRATCHED THE CUE BALL!",
                failArt: "   🎱 ━━▶ (×﹏×)\n   [OWN GOAL]",
                failText:
                  "The cue ball bounced directly back into your forehead. You woke up in the back alley with empty pockets. ಥ_ಥ",
              },
              {
                id: "roulette",
                label: "🎲 Bet Everything on Double 0",
                style: ButtonStyle.Success,
                winRate: 0.4,
                winTitle: "🏆 CASINO OVERLORD!",
                winArt: "   🎰 [ 7 | 7 | 7 ] 🎰\n   (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ [JACKPOT!]",
                winText:
                  "The ball landed on Double Zero! The whole casino erupted in cheers and the bouncers carried you out like a king! (★ω★)",
                failTitle: "💀 TOTAL BANKRUPTCY!",
                failArt: "   (╯°□°)╯︵ ʞooqǝɔɐɟ\n   [ZERO BALANCE]",
                failText:
                  "You lost every single coin. The casino took your watch, your shoes, and your Plato account credentials! (ノಠ益ಠ)ノ彡┻━┻",
              },
            ],
          },
          {
            title: "🏯 OCHO TOWER ROOFTOP GETAWAY",
            color: 0x5865f2,
            art:
              "   [ SKYSCRAPER ROOFTOP ]\n" +
              "   🚁 ☁️   ☁️   ☁️\n" +
              "   ════════════════\n" +
              "       ( •_•) [YOU ON EDGE]\n" +
              "   [500 FT DROP BELOW]",
            prompt:
              "You are stuck on the 100th floor of Ocho Tower with security closing in on the helipad! How do you escape?",
            choices: [
              {
                id: "zipline",
                label: "🪢 Zipline Down Power Cables",
                style: ButtonStyle.Primary,
                winRate: 0.55,
                winTitle: "🏆 CINEMATIC ZIPLINE DIVE!",
                winArt: "   🪢 ~ ~ ~ 💨\n   ( •̀ᴗ•́ )و [PERFECT LANDING]",
                winText:
                  "You hooked your belt onto the cable, soared over the city skyline, and landed safely into the getaway truck! ٩(◕‿◕｡)۶",
                failTitle: "💀 BELT SNAPPED!",
                failArt: "   💥 (x_x) 💥\n   [DUMPSTER CRASH]",
                failText:
                  "Your belt snapped halfway down. You plummeted directly into a dumpster full of rotten cabbage. (இ﹏இ`｡)",
              },
              {
                id: "heli",
                label: "🚁 Hijack the Escape Chopper",
                style: ButtonStyle.Danger,
                winRate: 0.45,
                winTitle: "🏆 SKY PIRATE VICTORY!",
                winArt: "   🚁 💨 💨 💨\n   ( ▀ ͜ʖ ͡・) [WE ARE AIRBORNE]",
                winText:
                  "You dropkicked the pilot into the passenger seat, pulled the throttle, and flew into the sunset! ᕙ(▀̿̿Ĺ̯̿̿▀̿ ̿)ᕗ",
                failTitle: "💀 DON'T KNOW HOW TO FLY!",
                failArt: "   🚁 🔄 🔄 🔄\n   ＼（〇_ｏ）／ [SPINNING]",
                failText:
                  "You jumped into the cockpit, mashed random buttons, and deployed the windshield wipers while security surrounded you. ¯\\_(ツ)_/¯",
              },
              {
                id: "cardshield",
                label: "🛡️ Block with Reverse Card",
                style: ButtonStyle.Success,
                winRate: 0.5,
                winTitle: "🏆 ULTIMATE REVERSE ACTIVATED!",
                winArt: "   🔄 🎴 💫\n   (☞◣д◢)☞ [GUARDS ARREST THEMSELVES]",
                winText:
                  "You pulled an Uno Reverse card. The guards were forced by cosmic law to cuff themselves and hand you the keys! (¬‿¬)",
                failTitle: "💀 REVERSE CARD COUNTERED!",
                failArt: "   🎴 ⚔️ 🎴\n   (╬ಠ益ಠ) [DRAW-4 STACKED!]",
                failText:
                  "The captain pulled a Wild Draw-4 card. You were overwhelmed by the card stack and pinned down! 凸(￣ヘ￣)",
              },
            ],
          },
        ];

        const scenario =
          SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
        const row = new ActionRowBuilder();
        scenario.choices.forEach((c) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`esc_${c.id}`)
              .setLabel(c.label)
              .setStyle(c.style),
          );
        });

        const startEmbed = new EmbedBuilder()
          .setTitle(scenario.title)
          .setColor(scenario.color)
          .setDescription(
            `\`\`\`text\n${scenario.art}\n\`\`\`\n` +
              `### 🎯 **THE SITUATION:**\n${scenario.prompt}\n\n` +
              `*Choose your action below before the timer runs out! ᕦ(ò_óˇ)ᕤ*`,
          );

        const msg = await interaction.reply({
          embeds: [startEmbed],
          components: [row],
          fetchReply: true,
        });

        const collector = msg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 25000,
        });

        collector.on("collect", async (btnInt) => {
          if (btnInt.user.id !== interaction.user.id) {
            return btnInt.reply({
              content: "Start your own heist with `/escape`! 凸(￣ヘ￣)",
              flags: 64,
            });
          }

          collector.stop("resolved");
          const pickedId = btnInt.customId.replace("esc_", "");
          const choiceData = scenario.choices.find((c) => c.id === pickedId);

          if (!choiceData) return;
          const isSuccess = Math.random() < choiceData.winRate;

          const resultEmbed = new EmbedBuilder()
            .setTitle(isSuccess ? choiceData.winTitle : choiceData.failTitle)
            .setColor(isSuccess ? 0x57f287 : 0xed4245)
            .setDescription(
              `\`\`\`text\n${isSuccess ? choiceData.winArt : choiceData.failArt}\n\`\`\`\n` +
                `### **${isSuccess ? "🎉 MISSION ACCOMPLISHED!" : "💀 MISSION FAILED!"}**\n` +
                `${isSuccess ? choiceData.winText : choiceData.failText}\n\n` +
                `> *Player: ${interaction.user} | Success Rate: ${Math.round(choiceData.winRate * 100)}%*`,
            );

          return btnInt.update({ embeds: [resultEmbed], components: [] });
        });

        collector.on("end", async (collected, reason) => {
          if (reason === "time") {
            const timeoutEmbed = new EmbedBuilder()
              .setTitle("⏰ HEIST TIMED OUT!")
              .setColor(0x2f3136)
              .setDescription(
                `\`\`\`text\n   (x_x) 💤 ...\n\`\`\`\n` +
                  `You hesitated for too long and were caught sleeping on the job! (¯\\_(ツ)_/¯)`,
              );
            await msg
              .edit({ embeds: [timeoutEmbed], components: [] })
              .catch(() => {});
          }
        });
        return;
      }

      // 9. SETUP
      if (commandName === "setup") {
        if (!interaction.guildId) {
          return safeReply(interaction, {
            content: "This command can only be used in a server.",
            flags: 64,
          });
        }

        if (
          !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
        ) {
          return safeReply(interaction, {
            content: "You need `Manage Server` permissions to run `/setup`.",
            flags: 64,
          });
        }

        const targetChannel = interaction.options.getChannel("channel");

        await GuildConfig.findOneAndUpdate(
          { guildId: interaction.guildId },
          { tourneyChannelId: targetChannel.id },
          { upsert: true, returnDocument: "after" },
        );

        return safeReply(interaction, {
          content: `Tournament operations are now locked to <#${targetChannel.id}>.`,
          flags: 64,
        });
      }

      // 10. LINK
      if (commandName === "link") {
        const platoId = interaction.options.getString("plato_id");
        const favGamesRaw = interaction.options.getString("fav_games");
        const favGames = favGamesRaw
          ? favGamesRaw.split(",").map((g) => g.trim())
          : [];

        await User.findOneAndUpdate(
          { discordId: interaction.user.id },
          { platoId, favGames },
          { upsert: true, returnDocument: "after" },
        );

        return safeReply(interaction, {
          content: `Linked! Plato ID: **${platoId}** | Fav Games: ${
            favGames.length ? favGames.join(", ") : "None specified"
          }`,
          flags: 64,
        });
      }

      // 11. PROFILE
      if (commandName === "profile") {
        const targetUser =
          interaction.options.getUser("target") || interaction.user;
        const profile = await User.findOne({ discordId: targetUser.id });

        if (!profile) {
          return safeReply(interaction, {
            content: `${targetUser.username} has not linked their Plato account yet. Run \`/link\` first.`,
            flags: 64,
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

        return safeReply(interaction, { embeds: [embed] });
      }

      // 12. UNLINK
      if (commandName === "unlink") {
        await User.findOneAndDelete({ discordId: interaction.user.id });
        return safeReply(interaction, {
          content: "Your Plato account has been unlinked.",
          flags: 64,
        });
      }

      // 13. TOURNEY
      if (commandName === "tourney") {
        if (!interaction.guildId) {
          return safeReply(interaction, {
            content: "Tournament commands can only be used inside servers.",
            flags: 64,
          });
        }

        const config = await GuildConfig.findOne({
          guildId: interaction.guildId,
        });
        if (!config) {
          return safeReply(interaction, {
            content:
              "This server has not configured a tournament channel yet. An admin must run `/setup channel:#your-channel` first.",
            flags: 64,
          });
        }

        if (interaction.channelId !== config.tourneyChannelId) {
          return safeReply(interaction, {
            content: `Tournament commands can only be used in <#${config.tourneyChannelId}>.`,
            flags: 64,
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
            return safeReply(interaction, {
              content:
                "An active tournament is already running in this channel.",
              flags: 64,
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

          return safeReply(interaction, {
            embeds: [embed],
            components: [joinRow],
          });
        }

        if (sub === "start") {
          if (
            !interaction.memberPermissions?.has(
              PermissionFlagsBits.ManageEvents,
            )
          ) {
            return safeReply(interaction, {
              content:
                "Only staff with `Manage Events` permission can start the tournament.",
              flags: 64,
            });
          }

          const tourney = await Tournament.findOne({
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            status: "REGISTRATION",
          });

          if (!tourney) {
            return safeReply(interaction, {
              content:
                "No tournament currently in registration found in this channel.",
              flags: 64,
            });
          }

          const groupSize = FORMAT_SIZES[tourney.format];
          if (tourney.participants.length < groupSize) {
            return safeReply(interaction, {
              content: `You need at least ${groupSize} participants for a ${tourney.format} format (Current: ${tourney.participants.length}).`,
              flags: 64,
            });
          }

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

          await safeReply(interaction, { content: startNotice });

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
            !interaction.memberPermissions?.has(
              PermissionFlagsBits.ManageEvents,
            )
          ) {
            return safeReply(interaction, {
              content:
                "Only staff with `Manage Events` permission can cancel tournaments.",
              flags: 64,
            });
          }

          await Tournament.deleteMany({
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            status: { $in: ["REGISTRATION", "IN_PROGRESS"] },
          });

          return safeReply(interaction, {
            content: "Active tournament in this channel has been cancelled.",
          });
        }
      }
    }

    // --- D. BUTTON INTERACTIONS ---
    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId.startsWith("join_") || customId.startsWith("leave_")) {
        const [action, tourneyId] = customId.split("_");
        const tourney = await Tournament.findById(tourneyId);

        if (!tourney || tourney.status !== "REGISTRATION") {
          return safeReply(interaction, {
            content: "Registration is closed.",
            flags: 64,
          });
        }

        const isLinked = await User.findOne({ discordId: interaction.user.id });
        if (!isLinked) {
          return safeReply(interaction, {
            content:
              "You must link your Plato account using `/link` before joining!",
            flags: 64,
          });
        }

        if (action === "join") {
          if (tourney.participants.includes(interaction.user.id)) {
            return safeReply(interaction, {
              content: "You are already registered in this tournament.",
              flags: 64,
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

        await interaction.update({ embeds: [embed] }).catch(() => {});
      }

      if (customId.startsWith("win:") || customId.startsWith("reset:")) {
        if (
          !interaction.memberPermissions?.has(PermissionFlagsBits.ManageEvents)
        ) {
          return safeReply(interaction, {
            content:
              "Only staff with `Manage Events` permission can select winners or reset matches.",
            flags: 64,
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
          await interaction
            .editReply({ embeds: [embed], components })
            .catch(() => {});

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

            if (
              winners.length === 1 ||
              (tourney.format === "2v2" && winners.length === 2)
            ) {
              tourney.status = "COMPLETED";
              await tourney.save();

              const winnerMentions = winners
                .map((id) => `<@${id}>`)
                .join(" & ");
              return interaction.channel.send({
                content: `🎉 **TOURNAMENT COMPLETE!**\n👑 Congratulations to the Champion(s): ${winnerMentions}!`,
              });
            }

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
  } catch (globalErr) {
    console.error("Error handling interaction:", globalErr);
  }
});

// ==========================================
// 7. DATABASE CONNECTION, LOGIN & HTTP SERVER
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

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("PlatoBot is online!");
  })
  .listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
  });
