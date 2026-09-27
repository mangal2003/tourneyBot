require("dotenv").config();
const {
  REST,
  Routes,
  ApplicationCommandType,
  PermissionFlagsBits,
} = require("discord.js");

// Pure raw API payload: guarantees Discord registers them everywhere (Guilds, DMs, Group DMs)
const ALL_CONTEXTS = [0, 1, 2];
const ALL_INTEGRATIONS = [0, 1];

const commands = [
  // 1. /emj
  {
    name: "emj",
    description: "Dispatch custom server & reaction emojis",
    type: ApplicationCommandType.ChatInput,
    contexts: ALL_CONTEXTS,
    integration_types: ALL_INTEGRATIONS,
    options: [
      {
        name: "vibe",
        description: "Emotion or vibe (e.g. fire, laugh, skull, gg, happy)",
        type: 3, // STRING
        required: false,
      },
    ],
  },

  // 2. /emoji (Alias)
  {
    name: "emoji",
    description: "Dispatch custom server & reaction emojis",
    type: ApplicationCommandType.ChatInput,
    contexts: ALL_CONTEXTS,
    integration_types: ALL_INTEGRATIONS,
    options: [
      {
        name: "vibe",
        description: "Emotion or vibe (e.g. fire, laugh, skull, gg, happy)",
        type: 3, // STRING
        required: false,
      },
    ],
  },

  // 3. /trn
  {
    name: "trn",
    description: "Translate foreign text, slang, or phrases into English",
    type: ApplicationCommandType.ChatInput,
    contexts: ALL_CONTEXTS,
    integration_types: ALL_INTEGRATIONS,
    options: [
      {
        name: "text",
        description: "The foreign phrase or text to translate",
        type: 3, // STRING
        required: true,
      },
    ],
  },

  // 4. Context Menu: React With Emojis
  {
    name: "React With Emojis",
    type: ApplicationCommandType.Message,
    contexts: ALL_CONTEXTS,
    integration_types: ALL_INTEGRATIONS,
  },

  // 5. Game: /spyfall
  {
    name: "spyfall",
    description: "Start a game of AI Spyfall (3-8 players)",
    type: ApplicationCommandType.ChatInput,
  },

  // 6. Game: /twotruths
  {
    name: "twotruths",
    description: "Spot the AI hallucination among two verified facts",
    type: ApplicationCommandType.ChatInput,
    options: [
      {
        name: "topic",
        description: "Topic (e.g. Science, Gaming, History)",
        type: 3,
        required: false,
      },
    ],
  },

  // 7. Game: /dungeon
  {
    name: "dungeon",
    description: "Embark on an AI-narrated party dungeon raid",
    type: ApplicationCommandType.ChatInput,
  },

  // 8. Game: /court
  {
    name: "court",
    description: "Start an absurd debate duel judged by AI",
    type: ApplicationCommandType.ChatInput,
    options: [
      {
        name: "opponent",
        description: "Debate opponent",
        type: 6, // USER
        required: true,
      },
      {
        name: "topic",
        description: "Custom debate topic",
        type: 3,
        required: false,
      },
    ],
  },

  // 9. Game: /twentyq
  {
    name: "twentyq",
    description:
      "Pick a secret entity and challenge the AI to guess it within 20 questions",
    type: ApplicationCommandType.ChatInput,
  },

  // 10. /setwelcome
  {
    name: "setwelcome",
    description:
      "Configure custom welcome embeds for this server (Admins only)",
    type: ApplicationCommandType.ChatInput,
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    options: [
      {
        name: "channel",
        description: "Channel where welcome cards will be dispatched",
        type: 7, // CHANNEL
        required: true,
      },
      {
        name: "greeting",
        description:
          "Custom greeting text (Use {user}, {server}, {memberCount})",
        type: 3,
        required: false,
      },
      {
        name: "rules",
        description: "Select your server's rules channel",
        type: 7,
        required: false,
      },
      {
        name: "general",
        description: "Select your primary general chat channel",
        type: 7,
        required: false,
      },
      {
        name: "roles",
        description: "Select your roles / self-assign channel",
        type: 7,
        required: false,
      },
      {
        name: "banner",
        description: "Upload a custom welcome banner graphic",
        type: 11, // ATTACHMENT
        required: false,
      },
      {
        name: "color",
        description: "Hex color code for the embed border (e.g. #FF0055)",
        type: 3,
        required: false,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(
      `[Deploy] Registering ${commands.length} application commands globally...`,
    );
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log(
      `[Deploy] ✅ Successfully registered ${data.length} commands with full DM and Guild support:`,
    );
    data.forEach((c) =>
      console.log(
        `   - /${c.name} [Contexts: ${JSON.stringify(c.contexts || "Default")}]`,
      ),
    );
  } catch (error) {
    console.error("[Deploy Error]:", error);
  }
})();
