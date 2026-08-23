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
// 2. LIVE API FETCHERS WITH HEADERS & FALLBACKS
// ==========================================
const HTTP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

const FALLBACK_ROASTS = [
  "You play like your screen brightness is set to 0. (ノ°Д°）ノ︵ ┻━┻",
  "Even an easy bot has cleaner mechanics than you. ¯\\_(ツ)_/¯",
  "You're the reason your bracket group was finished in 3 minutes. (￣▽￣*)ゞ",
  "I've seen Uno reverses sharper than your gameplay. ＼（〇_ｏ）／",
  "Brain.exe has stopped responding. (×_×)",
  "Bro is clicking buttons based on pure vibes. ( ˘ω˘ )",
  "WiFi isn't the problem, your gameplay is. ( ͡° ͜ʖ ͡°)",
];

const FALLBACK_PRAISES = [
  "Literal god gamer right here! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
  "Main character energy detected. ( ▀ ͜ʖ ͡・)",
  "Cleanest execution I've ever seen! ٩(◕‿◕｡)۶",
  "Carrying the entire server on your back. ᕙ(▀̿̿Ĺ̯̿̿▀̿ ̿)ᕗ",
  "Your gaming IQ is beyond human comprehension! (★ω★)",
];

const FALLBACK_ORACLES = [
  "The stars say YES, but your skill issue says absolutely not. ¯\\_(ツ)_/¯",
  "Outlook is as dark as your Plato match history. (╥﹏╥)",
  "Without a doubt... unless you choke at the last second. ( ͡° ͜ʖ ͡°)",
  "Ask again when your WiFi actually works. ＼（〇_ｏ）／",
  "Signs point to absolute disaster. (╯°□°)╯︵ ┻━┻",
  "Yes, 100% guaranteed by the Ocho Gods! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
  "Don't count on it. Even an AI wouldn't bet on that. 凸(￣ヘ￣)",
];

const FALLBACK_SUS = [
  "Caught throwing the 8-Ball match on purpose.",
  "Blaming latency after missing a completely stationary shot.",
  "Secretly googling Plato strategy guides mid-match.",
  "Pretending their phone died after getting 4 Draw cards in Ocho.",
  "Flexing an unearned win in global chat.",
  "Button-mashing and claiming it was 200 IQ calculated strategy.",
];

async function fetchLiveRoast() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      "https://v2.jokeapi.dev/joke/Dark,Pun?blacklistFlags=nsfw,religious,racist,sexist&type=single",
      { headers: HTTP_HEADERS, signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.joke) return data.joke.trim();
    }
  } catch {}
  return FALLBACK_ROASTS[Math.floor(Math.random() * FALLBACK_ROASTS.length)];
}

async function fetchLivePraise() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://affirmations.dev/", {
      headers: HTTP_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.affirmation) return `${data.affirmation}! ٩(◕‿◕｡)۶`;
    }
  } catch {}
  return FALLBACK_PRAISES[Math.floor(Math.random() * FALLBACK_PRAISES.length)];
}

async function fetchLiveOracle() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.adviceslip.com/advice?t=${Date.now()}`,
      { headers: HTTP_HEADERS, signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.slip?.advice) return data.slip.advice.trim();
    }
  } catch {}
  return FALLBACK_ORACLES[Math.floor(Math.random() * FALLBACK_ORACLES.length)];
}

async function fetchLiveSusCrime() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      "https://v2.jokeapi.dev/joke/Miscellaneous,Pun?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=single",
      { headers: HTTP_HEADERS, signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.joke) return data.joke.trim();
    }
  } catch {}
  return FALLBACK_SUS[Math.floor(Math.random() * FALLBACK_SUS.length)];
}

// ==========================================
// 3. DATASETS & STYLING UTILITIES
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
};

const ANIME_DUEL_MOVES = [
  {
    name: "8-Ball Bank Shot of Destiny",
    minDmg: 20,
    maxDmg: 32,
    p1Pose: "━╤デ╦︻(▀̿̿Ĺ̯̿̿▀̿ ̿)",
    p2Pose: "(°ロ°) !",
    text: "calculated cosmic geometry and hyper-sniped",
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
    text: "shattered the physics engine and launched an oak table into",
  },
  {
    name: "Lag Teleport Strike",
    minDmg: 18,
    maxDmg: 28,
    p1Pose: "ヘ(^_^ヘ) ~ 💨",
    p2Pose: "(⊙_⊙)？",
    text: "exploited 999ms ping, vanished from reality, and backstabbed",
  },
  {
    name: "Bowling Ball Meteor Strike",
    minDmg: 30,
    maxDmg: 45,
    p1Pose: "ᕦ(ò_óˇ)ᕤ 🎳",
    p2Pose: "☠️ (×﹏×)",
    text: "hurled a titanium bowling ball at supersonic speed towards",
  },
];

const RAGEBAIT_FLAVORS = [
  (text) =>
    text
      .split("")
      .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
      .join(""),
  (text) => text.split(" ").join(" 👏 "),
  (text) => `Bro actually typed "${text}" with a straight face 💀`,
  (text) => `"${text.toUpperCase()}" — says the one hardstuck in tutorial 😭`,
  (text) => `Imagine unironically saying "${text}" in 2026 ( ˘ω˘ )`,
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
  return `\`[${"█".repeat(filled)}${"░".repeat(empty)}]\` **${Math.max(0, current)}/${max} HP**`;
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
      return await interaction.editReply(options);
    }
    return await interaction.reply(options);
  } catch (err) {
    if (err.code === 40060 || err.code === 10062) return;
    console.error("Error executing safeReply:", err);
  }
}

// ==========================================
// 4. MONGOOSE SCHEMAS & MODELS
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
// 5. BRACKET & UI HELPERS
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
  const isDone = match.status === "COMPLETED";
  const statusBadge = isDone ? "🟢MATCH CONCLUDED" : "⚡IN PROGRESS";

  const embed = new EmbedBuilder()
    .setColor(isDone ? 0x00f5d4 : 0x5865f2)
    .setAuthor({
      name: `🏆 ${tourney.name.toUpperCase()} • ROUND ${match.round}`,
      iconURL: "https://i.imgur.com/v8tTj8z.png",
    })
    .setTitle(`⚔️ MATCH ID: \`${match.matchId}\``)
    .setDescription(
      `\`\`\`fix\n[${tourney.game.toUpperCase()}] • [${tourney.format}] • [${statusBadge}]\n\`\`\`\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );

  const playerDetails = [];

  for (let i = 0; i < match.players.length; i++) {
    const entry = match.players[i];
    const ids = entry.split(",");
    const profiles = await User.find({ discordId: { $in: ids } });

    const details = ids
      .map((id) => {
        const profile = profiles.find((p) => p.discordId === id);
        const platoTag = profile
          ? `(Plato: \`${profile.platoId}\`)`
          : "(Plato: *Unlinked*)";
        return `<@${id}> ${platoTag}`;
      })
      .join(" & ");

    const isWinner = match.winner === entry;
    playerDetails.push(
      `${isWinner ? "👑" : `🔹`} **SLOT ${i + 1}:** ${details}`,
    );
  }

  embed.addFields(
    {
      name: "👥 PARTICIPANTS",
      value: playerDetails.join("\n"),
      inline: false,
    },
    {
      name: "🏆 CURRENT STANDING",
      value: match.winner
        ? `> 🎖️ **Winner:** ${match.winner
            .split(",")
            .map((id) => `<@${id}>`)
            .join(" & ")} \`(Victory Secured)\``
        : `> ⏳ *Awaiting match confirmation by event staff...*`,
      inline: false,
    },
  );

  embed
    .setFooter({
      text: "Tournament Engine • Automated Bracket System",
      iconURL: "https://i.imgur.com/v8tTj8z.png",
    })
    .setTimestamp();

  const row = new ActionRowBuilder();

  match.players.forEach((playerStr, idx) => {
    const isWinner = match.winner === playerStr;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`win:${tourney._id}:${match.matchId}:${idx}`)
        .setLabel(`Slot ${idx + 1} Win`)
        .setStyle(isWinner ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(isDone && isWinner),
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
// 6. SLASH & CONTEXT COMMAND DEFINITIONS
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
          "Type to search: rage, tableflip, cat, bear, roast, praise, smug, etc.",
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
      "🔮 Ask the live oracle API for unpredictable fortunes & advice",
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
    .setDescription("📦 Run a lie detector & live crime scan on a player")
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
// 7. CLIENT INITIALIZATION & EVENTS
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
        try {
          const focusedValue = interaction.options.getFocused().toLowerCase();
          const choices = [...Object.keys(FANCY_STYLES), "roast", "praise"];
          const filtered = choices
            .filter((choice) => choice.toLowerCase().includes(focusedValue))
            .slice(0, 25);

          await interaction.respond(
            filtered.map((choice) => ({
              name: `${choice.toUpperCase()}`,
              value: choice,
            })),
          );
        } catch (err) {
          if (err.code === 40060 || err.code === 10062) return;
        }
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

        const embed = new EmbedBuilder()
          .setColor(0xff0055)
          .setAuthor({
            name: `RAGEBAIT TRANSFORMER`,
            iconURL: author.displayAvatarURL(),
          })
          .setDescription(
            `\`\`\`text\n"${originalContent}"\n\`\`\`\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `### 🎯 **TRANSLATED ROAST:**\n${ragebaitResult}`,
          )
          .setFooter({
            text: `Target: @${author.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        return safeReply(interaction, { embeds: [embed] });
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

        if (category === "roast" || category === "praise") {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply().catch(() => {});
          }
          const liveText =
            category === "roast"
              ? await fetchLiveRoast()
              : await fetchLivePraise();

          const isRoast = category === "roast";
          const embed = new EmbedBuilder()
            .setColor(isRoast ? 0xff4500 : 0x00f5d4)
            .setAuthor({
              name: isRoast ? "🔥 SAVAGE ROAST" : "✨ DIVINE PRAISE",
              iconURL: interaction.user.displayAvatarURL(),
            })
            .setDescription(
              `${target ? `> 🎯 **Target:** ${target}\n` : ""}` +
                `\`\`\`fix\n${liveText}\n\`\`\`\n` +
                `### ${isRoast ? "(ノ°Д°）ノ︵ ┻━┻" : "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧"}`,
            )
            .setFooter({ text: "Generated via AI" });

          return interaction.editReply({ embeds: [embed] }).catch(() => {});
        }

        const list = FANCY_STYLES[category] || FANCY_STYLES.happy;
        const pick = list[Math.floor(Math.random() * list.length)];

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setAuthor({
            name: `KAOMOJI EXPRESSION • [${category.toUpperCase()}]`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setDescription(
            `${target ? `> ➔ Directed towards: ${target}\n\n` : ""}` +
              `# ${pick}`,
          );

        return safeReply(interaction, { embeds: [embed] });
      }

      // 2. FANCY VAPORWAVE TEXT
      if (commandName === "fancy") {
        const rawText = interaction.options.getString("text");
        const vaporText = toVaporwave(rawText);

        const embed = new EmbedBuilder()
          .setColor(0xff77a8)
          .setAuthor({
            name: "ＡＥＳＴＨＥＴＩＣ  ＴＥＸＴ  ＧＥＮＥＲＡＴＯＲ",
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setDescription(`\`\`\`fix\n${vaporText}\n\`\`\``)
          .setFooter({ text: "Vaporwave Typography" });

        return safeReply(interaction, { embeds: [embed] });
      }

      // 3. RAGEBAIT (SLASH)
      if (commandName === "ragebait") {
        const rawText = interaction.options.getString("text");
        const ragebaitResult = generateRagebait(rawText);

        const embed = new EmbedBuilder()
          .setColor(0xff0055)
          .setAuthor({
            name: "🔥 RAGEBAIT TRANSLATOR",
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setDescription(
            `\`\`\`text\n"${rawText}"\n\`\`\`\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `### 🎯 **REACTION:**\n${ragebaitResult}`,
          );

        return safeReply(interaction, { embeds: [embed] });
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
            `⚔️ ANIME DUEL: ${initiator.username.toUpperCase()} VS ${opponent.username.toUpperCase()}`,
          )
          .setColor(0xffaa00)
          .setThumbnail("https://i.imgur.com/8Qe7O7S.png")
          .setDescription(
            `\`\`\`fix\n[⚡ARENA GATES OPENING • BATTLE COMMENCING...]\n\`\`\`\n` +
              `> 👤 **${initiator.username}:** ${renderHealthBar(p1Hp, maxHp)}\n` +
              `> 👤 **${opponent.username}:** ${renderHealthBar(p2Hp, maxHp)}\n\n` +
              `\`\`\`text\n(ง •̀_•́)ง ═══════════════ ⚔️ ═══════════════ ᕦ(ò_óˇ)ᕤ\n\`\`\``,
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
            lastActionLog = `💥 **${initiator.username}** unleashed **[${move.name}]**!\n> *${move.text} ${opponent.username} for **${dmg} CRIT DMG!***`;
            arenaVisual = `${move.p1Pose} ━━━━━━💥━━━━━━▶ ${move.p2Pose}`;
            turn = 2;
          } else {
            p1Hp = Math.max(0, p1Hp - dmg);
            lastActionLog = `💥 **${opponent.username}** unleashed **[${move.name}]**!\n> *${move.text} ${initiator.username} for **${dmg} CRIT DMG!***`;
            arenaVisual = `${move.p2Pose} ◀━━━━━━💥━━━━━━ ${move.p1Pose}`;
            turn = 1;
          }

          duelEmbed = new EmbedBuilder()
            .setTitle(
              `⚔️ ROUND ${roundNum}: ${initiator.username.toUpperCase()} VS ${opponent.username.toUpperCase()}`,
            )
            .setColor(0xff4500)
            .setDescription(
              `\`\`\`text\n${arenaVisual}\n\`\`\`\n` +
                `> 👤 **${initiator.username}:** ${renderHealthBar(p1Hp, maxHp)}\n` +
                `> 👤 **${opponent.username}:** ${renderHealthBar(p2Hp, maxHp)}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `### ⚡ACTION LOG:\n${lastActionLog}`,
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
          .setTitle(`🏆 KNOCKOUT! ${winner.username.toUpperCase()} WINS!`)
          .setColor(0x00f5d4)
          .setThumbnail(winner.displayAvatarURL())
          .setDescription(
            `\`\`\`fix\n[ 👑 CHAMPION CROWNED: ${winner.username.toUpperCase()} ]\n\`\`\`\n` +
              `> 🌟 **WINNER:** ${winner} \`(Survived with ${winnerHp} HP)\`\n` +
              `> 💀 **DEFEATED:** ${loser} *(x_x)⌒☆*\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `### 🎖️ FINAL HEALTH METRICS:\n` +
              `> ${renderHealthBar(winnerHp, maxHp)}\n\n` +
              `> *"Another warrior falls into the archives."*`,
          )
          .setFooter({ text: "Anime Combat Simulator • 2026 Engine" });

        return interaction.editReply({ embeds: [finalEmbed] }).catch(() => {});
      }

      // 5. UNHINGED ORACLE (REDESIGNED LUXURY EMBED)
      if (commandName === "oracle") {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply().catch(() => {});
        }
        const question = interaction.options.getString("question");
        const answer = await fetchLiveOracle();

        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setAuthor({
            name: "MYSTICAL PROPHECY & COSMIC GUIDANCE",
            iconURL: "https://i.imgur.com/G5qZp3T.png",
          })
          .setTitle("🔮 The Unhinged Kaomoji Oracle")
          .setDescription(
            `\`\`\`fix\n[QUESTION:"${question}"]\n\`\`\`\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `### 📜 **THE REVELATION:**\n` +
              `> *" ${answer} "*\n\n` +
              `\`\`\`text\n( ˘ω˘ )...The cosmos have spoken.\n\`\`\``,
          )
          .setFooter({
            text: `Queried by @${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] }).catch(() => {});
      }

      // 6. SUS LIE DETECTOR (REDESIGNED SCANNER EMBED)
      if (commandName === "sus") {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply().catch(() => {});
        }
        const target = interaction.options.getUser("target");
        const susPercent = Math.floor(Math.random() * 101);
        const crime = await fetchLiveSusCrime();

        let verdict = "🟢INNOCENT CITIZEN";
        let kaomoji = "(✿◠‿◠)";
        let color = 0x00f5d4;
        let threatBadge = "LOW THREAT";

        if (susPercent > 70) {
          verdict = "🚨CRITICALLY SUSPECT / IMPOSTOR";
          kaomoji = "(╬ಠ益ಠ) ━╤デ╦︻";
          color = 0xff0055;
          threatBadge = "MAXIMUM DANGER";
        } else if (susPercent > 35) {
          verdict = "🟡SUSPICIOUS ACTIVITY DETECTED";
          kaomoji = "(¬_¬ )";
          color = 0xfee75c;
          threatBadge = "MODERATE SUSPICION";
        }

        const embed = new EmbedBuilder()
          .setColor(color)
          .setAuthor({
            name: `CYBERNETIC DIAGNOSTIC SCANNER`,
            iconURL: "https://i.imgur.com/rA8f57s.png",
          })
          .setTitle(`📦SCAN RESULTS: @${target.username.toUpperCase()}`)
          .setThumbnail(target.displayAvatarURL())
          .setDescription(
            `\`\`\`fix\n[THREAT LEVEL: ${threatBadge}] • [PROBABILITY: ${susPercent}%]\n\`\`\`\n` +
              `> 📊 **SUS METER:**\n> ${renderHealthBar(susPercent, 100)}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `### ⚖️ **VERDICT:**\n` +
              `> **${verdict}**\n` +
              `> \`\`\`\n${kaomoji}\n\`\`\`\n` +
              `### 📂 **CHARGES / ALLEGATIONS:**\n` +
              `> 📜 *${crime}*`,
          )
          .setFooter({
            text: `Diagnostic run by @${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] }).catch(() => {});
      }

      // 7. HOT POTATO BOMB DEFUSAL
      if (commandName === "defuse") {
        const wires = ["red", "blue", "green"];
        const correctWire = wires[Math.floor(Math.random() * wires.length)];

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("defuse_red")
            .setLabel("🔴Cut Red Wire")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("defuse_blue")
            .setLabel("🔵Cut Blue Wire")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("defuse_green")
            .setLabel("🟢Cut Green Wire")
            .setStyle(ButtonStyle.Success),
        );

        const bombEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setAuthor({
            name: "🚨 EMERGENCY DEFUSAL",
            iconURL: "https://i.imgur.com/Qk1jQzM.png",
          })
          .setTitle("💣 TICK... TICK... DETONATION IMMINENT!")
          .setDescription(
            `\`\`\`fix\n[ ⏳ TIME REMAINING: 15.00 SECONDS ] • [ STATUS: ARMED ]\n\`\`\`\n` +
              `\`\`\`text\n` +
              `       .---.\n` +
              `      /     \\\n` +
              `     | () () |\n` +
              `      \\  -  /   === [ 🔴 | 🔵 | 🟢 ]\n` +
              `       \`---\`\n` +
              `\`\`\`\n` +
              `> ⚠️ *Choose the exact wire to cut before the whole server detonates!*`,
          )
          .setFooter({ text: "Operative: @" + interaction.user.username });

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
              .setColor(0x00f5d4)
              .setTitle("🎉 BOMB DEFUSED! SAFE!")
              .setDescription(
                `\`\`\`fix\n[STATUS: CRISIS AVERTED] • [SUCCESS]\n\`\`\`\n` +
                  `> 🛡️ **${interaction.user.username}** successfully snipped the **${correctWire.toUpperCase()}** wire!\n\n` +
                  `### (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ *The tournament venue is secure!*`,
              );
            await replyMsg
              .edit({ embeds: [winEmbed], components: [disabledRow] })
              .catch(() => {});
          } else {
            const failEmbed = new EmbedBuilder()
              .setColor(0x2b2d31)
              .setTitle("💥 KABOOOOOM! DETONATION!")
              .setDescription(
                `\`\`\`fix\n[STATUS: TOTAL DISASTER] • [KABOOM]\n\`\`\`\n` +
                  `> ☠️ The safe wire was: **${correctWire.toUpperCase()}**\n\n` +
                  `### ☠️ ( 💀 ͜ʖ 💀 ) ☠️ *${reason === "time" ? "Timer reached zero! (×_×)" : "Wrong wire cut! (ノಠ益ಠ)ノ"}*`,
              );
            await replyMsg
              .edit({ embeds: [failEmbed], components: [disabledRow] })
              .catch(() => {});
          }
        });
        return;
      }

      // 8. MULTI-SCENARIO ASCII HEIST
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
                  "You slipped through the ventilation shaft, bypassed heat sensors, and snatched 500,000 Plato Coins! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
                failTitle: "💀 VENT COLLAPSE!",
                failArt: "   💥 ┌───┐ 💥\n      │(x_x)│ [STUCK!]",
                failText:
                  "The rusty vent gave way and you crashed directly onto the Chief Admin's desk! (╥﹏╥)",
              },
              {
                id: "bribe",
                label: "🎴 Offer Wild Draw-4 Card",
                style: ButtonStyle.Secondary,
                winRate: 0.5,
                winTitle: "🏆 BRIBE ACCEPTED BY GUARD!",
                winArt: "   👮‍♂️ 🤝 (¬‿¬)\n   [VIP PASS GRANTED]",
                winText:
                  "The guard gasped: *'A golden Draw-4?! Pass right through, boss!'* You walked out the front door with the trophy! (★ω★)",
                failTitle: "💀 BRIBE REJECTED!",
                failArt: "   👮‍♂️ ━╤デ╦︻ (╬ಠ益ಠ)\n   [CAUGHT IN 4K]",
                failText:
                  "The guard was an undercover moderator. You were banned to the shadow realm on the spot! 凸(￣ヘ￣)",
              },
              {
                id: "smash",
                label: "💥 Tableflip the Titanium Door",
                style: ButtonStyle.Danger,
                winRate: 0.35,
                winTitle: "🏆 UNSTOPPABLE CRITICAL SMASH!",
                winArt: "   (ノ°Д°）ノ︵ 🏢\n   [VAULT SHATTERED!]",
                winText:
                  "Against all laws of physics, your rage obliterated the titanium door and blasted the vault open! ᕙ(▀̿̿Ĺ̯̿̿▀̿ ̿)ᕗ",
                failTitle: "💀 SPINE FRACTURE!",
                failArt: "   💥 ┬─┬ノ( º _ ºノ)\n   [DOOR DIDN'T BUDGE]",
                failText:
                  "You threw yourself at a 50-ton blast door and bounced off like a cartoon character! (×_×)⌒☆",
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
              "You just cleared the high-roller table and the house bouncers are blocking the exits! What's your escape move?",
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
                  "Your smoke grenade was just baby powder. The bouncers calmly escorted you to the kitchen dish pit. ＼（〇_ｏ）／",
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
                  "The cue ball bounced directly into your forehead. You woke up in the back alley with empty pockets. ಥ_ಥ",
              },
              {
                id: "roulette",
                label: "🎲 Bet Everything on Double 0",
                style: ButtonStyle.Success,
                winRate: 0.4,
                winTitle: "🏆 CASINO OVERLORD!",
                winArt: "   🎰 [ 7 | 7 | 7 ] 🎰\n   (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ [JACKPOT!]",
                winText:
                  "The ball landed on Double Zero! The whole casino cheered and the bouncers carried you out like royalty! (★ω★)",
                failTitle: "💀 TOTAL BANKRUPTCY!",
                failArt: "   (╯°□°)╯︵ ʞooqǝɔɐɟ\n   [ZERO BALANCE]",
                failText:
                  "You lost every single coin. The casino took your watch, your shoes, and your Plato username! (ノಠ益ಠ)ノ彡┻━┻",
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
              `### 🎯 **THE SITUATION:**\n> ${scenario.prompt}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*Choose your action below before the timer runs out! ᕦ(ò_óˇ)ᕤ*`,
          )
          .setFooter({ text: "Interactive Heist Simulator" });

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
            .setColor(isSuccess ? 0x00f5d4 : 0xff0055)
            .setDescription(
              `\`\`\`text\n${isSuccess ? choiceData.winArt : choiceData.failArt}\n\`\`\`\n` +
                `### **${isSuccess ? "🎉 MISSION ACCOMPLISHED!" : "💀 MISSION FAILED!"}**\n` +
                `> ${isSuccess ? choiceData.winText : choiceData.failText}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `> 👤 **Player:** ${interaction.user} • **Odds:** \`${Math.round(choiceData.winRate * 100)}%\``,
            );

          return btnInt.update({ embeds: [resultEmbed], components: [] });
        });

        collector.on("end", async (collected, reason) => {
          if (reason === "time") {
            const timeoutEmbed = new EmbedBuilder()
              .setTitle("⏰ HEIST TIMED OUT!")
              .setColor(0x2b2d31)
              .setDescription(
                `\`\`\`text\n   (x_x) 💤 ...\n\`\`\`\n` +
                  `> You hesitated for too long and were caught sleeping on the job! (¯\\_(ツ)_/¯)`,
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

        const embed = new EmbedBuilder()
          .setColor(0x00f5d4)
          .setTitle("⚙️ TOURNAMENT CONFIGURATION SAVED")
          .setDescription(
            `\`\`\`fix\n[CHANNEL LOCKED: #${targetChannel.name}]\n\`\`\`\n` +
              `> All bracket generations and match management are now routed exclusively to <#${targetChannel.id}>.`,
          )
          .setFooter({ text: "Tournament System Settings" });

        return safeReply(interaction, { embeds: [embed], flags: 64 });
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

        const embed = new EmbedBuilder()
          .setColor(0x00f5d4)
          .setTitle("✅ PLATO ACCOUNT LINKED")
          .setDescription(
            `\`\`\`fix\n[ PLATO ID: ${platoId} ]\n\`\`\`\n` +
              `> 🎮 **FAVORITE GAMES:** ${favGames.length ? favGames.map((g) => `\`${g}\``).join(", ") : "*None specified*"}\n\n` +
              `*You are now eligible to enter official server tournaments!*`,
          );

        return safeReply(interaction, { embeds: [embed], flags: 64 });
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
          .setTitle(`🎮 PLAYER: @${targetUser.username.toUpperCase()}`)
          .setColor(0x5865f2)
          .setThumbnail(targetUser.displayAvatarURL())
          .setDescription(
            `\`\`\`fix\n[PLATO PASSPORT]\n\`\`\`\n` +
              `> **PLATO ID:** \`${profile.platoId}\`\n` +
              `> **REGISTERED:** <t:${Math.floor(new Date(profile.createdAt).getTime() / 1000)}:R>\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `### 🏆 GAMES:\n` +
              `> ${profile.favGames.length ? profile.favGames.map((g) => `\`• ${g}\``).join("\n> ") : "*No favorite titles listed*"}`,
          )
          .setFooter({
            text: "Plato Registry",
            iconURL: "https://i.imgur.com/v8tTj8z.png",
          });

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
            .setColor(0xfee75c)
            .setAuthor({
              name: "🏆 OFFICIAL TOURNAMENT REGISTRATION",
              iconURL: "https://i.imgur.com/v8tTj8z.png",
            })
            .setTitle(name.toUpperCase())
            .setDescription(
              `\`\`\`fix\n[${game.toUpperCase()}] • [${format}] • [REGISTRATION OPEN]\n\`\`\`\n` +
                `> 📌 Click the **Join** button below to enter.\n` +
                `> ⚠️ *You must link your Plato account using \`/link\` prior to registering!*`,
            )
            .addFields({
              name: "👥 REGISTERED CONTENDERS (0)",
              value: "> *No players have registered yet. Be the first!*",
            })
            .setFooter({ text: "Tournament Coordinator System" })
            .setTimestamp();

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
          name: `👥 REGISTERED CONTENDERS (${tourney.participants.length})`,
          value: tourney.participants.length
            ? tourney.participants.map((id) => `<@${id}>`).join(", ")
            : "> *No players have registered yet. Be the first!*",
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

              const finishEmbed = new EmbedBuilder()
                .setColor(0x00f5d4)
                .setTitle("🎉 TOURNAMENT FINALE!")
                .setDescription(
                  `\`\`\`fix\n[🏆 CHAMPION OF THE TOURNAMENT]\n\`\`\`\n` +
                    `### 👑 Congratulations to our Champion(s):\n> ${winnerMentions} (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧\n\n` +
                    `*All bracket data has been logged to the server archives.*`,
                )
                .setThumbnail("https://i.imgur.com/v8tTj8z.png");

              return interaction.channel.send({ embeds: [finishEmbed] });
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
// 8. DATABASE CONNECTION, LOGIN & HTTP SERVER
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
