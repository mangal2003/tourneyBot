require("dotenv").config();
const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const commands = [
  // 1. Right-Click Context Menu Command (Apps -> React With Emojis)
  new ContextMenuCommandBuilder()
    .setName("React With Emojis")
    .setType(ApplicationCommandType.Message)
    .setContexts([0, 1, 2]) // 0: Guild, 1: BotDM, 2: PrivateChannel
    .setIntegrationTypes([0, 1]), // 0: GuildInstall, 1: UserInstall

  // 2. Game: Spyfall
  new SlashCommandBuilder()
    .setName("spyfall")
    .setDescription("Start a game of AI Spyfall (3-8 players)"),

  // 3. Game: Two Truths & An AI Lie
  new SlashCommandBuilder()
    .setName("twotruths")
    .setDescription("Spot the AI hallucination among two verified facts")
    .addStringOption((opt) =>
      opt
        .setName("topic")
        .setDescription("Topic (e.g. Science, Gaming, History)")
        .setRequired(false),
    ),

  // 4. Game: Co-op Dungeon Raid
  new SlashCommandBuilder()
    .setName("dungeon")
    .setDescription("Embark on an AI-narrated party dungeon raid"),

  // 5. Game: Devil's Advocate Court
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

  // 6. Game: Reverse 20 Questions
  new SlashCommandBuilder()
    .setName("twentyq")
    .setDescription(
      "Pick a secret entity and challenge the AI to guess it within 20 questions",
    ),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("[Commands] Deploying slash and context menu commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("[Commands] Successfully deployed all 6 commands.");
  } catch (error) {
    console.error("[Deploy Error]:", error);
  }
})();
