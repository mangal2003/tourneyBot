require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  // 1. Spyfall
  new SlashCommandBuilder()
    .setName("spyfall")
    .setDescription("Start a game of AI Spyfall (3-8 players)"),

  // 2. Two Truths & An AI Lie
  new SlashCommandBuilder()
    .setName("twotruths")
    .setDescription("Spot the AI hallucination among two verified facts")
    .addStringOption((opt) =>
      opt
        .setName("topic")
        .setDescription("Topic (e.g. Science, Gaming, History)")
        .setRequired(false),
    ),

  // 3. Co-op Dungeon
  new SlashCommandBuilder()
    .setName("dungeon")
    .setDescription("Embark on an AI-narrated party dungeon raid"),

  // 4. Devil's Advocate Court
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

  // 5. Reverse 20 Questions
  new SlashCommandBuilder()
    .setName("twentyq")
    .setDescription(
      "Pick a secret entity and challenge the AI to guess it within 20 questions",
    ),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("[Slash Commands] Deploying all 5 game commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("[Slash Commands] All 5 commands deployed successfully.");
  } catch (error) {
    console.error("Deploy Error:", error);
  }
})();
