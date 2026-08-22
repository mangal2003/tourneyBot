require("dotenv").config();
const { REST, Routes } = require("discord.js");
const commands = require("./commands");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering global slash commands across all servers...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands.map((c) => c.toJSON()),
    });
    console.log("Successfully registered global commands!");
  } catch (error) {
    console.error("Error deploying commands:", error);
  }
})();
