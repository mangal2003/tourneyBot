const { SlashCommandBuilder } = require("discord.js");

module.exports = [
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
          "Comma separated favorite games (e.g. Ocho, Pool, Plox,...)",
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
    .setDescription("Tournament management")
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
            .setDescription("Game (e.g. Ocho, Pool, Plox)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("format")
            .setDescription("Game format")
            .setRequired(true)
            .addChoices(
              { name: "1v1", value: "1v1" },
              { name: "2v2", value: "2v2" },
              { name: "1v1v1 (3P)", value: "1v1v1" },
              { name: "1v1v1v1 (4P)", value: "1v1v1v1" },
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
        .setDescription("Cancel current active tournament in this channel"),
    ),
];
