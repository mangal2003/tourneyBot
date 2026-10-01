require("dotenv").config();
const {
  REST,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  PermissionFlagsBits,
} = require("discord.js");

// Contexts: 0 = Guild, 1 = BotDM, 2 = PrivateChannel (Group DMs)
const ALL_CONTEXTS = [0, 1, 2];
// Integration Types: 0 = GuildInstall (Servers), 1 = UserInstall (DMs / Account)
const ALL_INTEGRATIONS = [0, 1];

const commands = [
  // 1. Right-Click Context Menu: React With Emojis
  new ContextMenuCommandBuilder()
    .setName("React With Emojis")
    .setType(ApplicationCommandType.Message),

  // 2. /emj - Visual Grid with Pagination
  new SlashCommandBuilder()
    .setName("emj")
    .setDescription("Open visual grid of custom emojis with pagination")
    .addIntegerOption((opt) =>
      opt
        .setName("count")
        .setDescription("Repeat count (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    ),

  // 3. /emoji - Alias
  new SlashCommandBuilder()
    .setName("emoji")
    .setDescription("Open visual grid of custom emojis with pagination")
    .addIntegerOption((opt) =>
      opt
        .setName("count")
        .setDescription("Repeat count (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    ),

  // 4. /trn - Fast Translation
  new SlashCommandBuilder()
    .setName("trn")
    .setDescription("Translate foreign text, slang, or phrases into English")
    .addStringOption((opt) =>
      opt
        .setName("text")
        .setDescription("The foreign phrase or text to translate")
        .setRequired(true),
    ),

  // 5. Game: Spyfall
  new SlashCommandBuilder()
    .setName("spyfall")
    .setDescription("Start a game of AI Spyfall (3-8 players)"),

  // 6. Game: Two Truths & An AI Lie
  new SlashCommandBuilder()
    .setName("twotruths")
    .setDescription("Spot the AI hallucination among two verified facts")
    .addStringOption((opt) =>
      opt
        .setName("topic")
        .setDescription("Topic (e.g. Science, Gaming, History)")
        .setRequired(false),
    ),

  // 7. Game: Co-op Dungeon Raid
  new SlashCommandBuilder()
    .setName("dungeon")
    .setDescription("Embark on an AI-narrated party dungeon raid"),

  // 8. Game: Devil's Advocate Court
  new SlashCommandBuilder()
    .setName("court")
    .setDescription("Start an absurd debate duel judged by AI")
    .addUserOption((opt) =>
      opt
        .setName("opponent")
        .setDescription("Debate opponent")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("topic")
        .setDescription("Custom debate topic")
        .setRequired(false),
    ),

  // 9. Game: Reverse 20 Questions
  new SlashCommandBuilder()
    .setName("twentyq")
    .setDescription(
      "Pick a secret entity and challenge the AI to guess it within 20 questions",
    ),

  // 10. Server Welcome Configuration
  new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription(
      "Configure custom welcome embeds for this server (Admins only)",
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel where welcome cards will be dispatched")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("greeting")
        .setDescription(
          "Custom greeting text (Use {user}, {server}, {memberCount})",
        )
        .setRequired(false),
    )
    .addChannelOption((opt) =>
      opt
        .setName("rules")
        .setDescription("Select your server's rules channel")
        .setRequired(false),
    )
    .addChannelOption((opt) =>
      opt
        .setName("general")
        .setDescription("Select your primary general chat channel")
        .setRequired(false),
    )
    .addChannelOption((opt) =>
      opt
        .setName("roles")
        .setDescription("Select your roles / self-assign channel")
        .setRequired(false),
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("banner")
        .setDescription("Upload a custom welcome banner graphic")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("color")
        .setDescription("Hex color code for the embed border (e.g. #FF0055)")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((cmd) => {
  const json = cmd.toJSON();
  if (["emj", "emoji", "trn", "React With Emojis"].includes(json.name)) {
    json.contexts = ALL_CONTEXTS;
    json.integration_types = ALL_INTEGRATIONS;
  }
  return json;
});

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
      `[Deploy] ✅ Successfully registered ${data.length} global commands.`,
    );
  } catch (error) {
    console.error("[Deploy Error]:", error);
  }
})();
