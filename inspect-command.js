// inspect-commands.js
require("dotenv").config();
const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const commands = await rest.get(
      Routes.applicationCommands(process.env.CLIENT_ID),
    );
    console.log(`\nFound ${commands.length} registered global commands:`);
    commands.forEach((c) => console.log(` - /${c.name} (ID: ${c.id})`));
  } catch (err) {
    console.error("Fetch error:", err);
  }
})();
