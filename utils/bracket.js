const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const User = require("../models/User");

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

  for (let i = 0; i < shuffled.length; i += groupSize) {
    const group = shuffled.slice(i, i + groupSize);

    if (format === "2v2" && group.length === 4) {
      matches.push({
        matchId: `R${roundNumber}_M${matchIndex++}`,
        round: roundNumber,
        players: [`${group[0]},${group[1]}`, `${group[2]},${group[3]}`],
        winner: null,
        status: "PENDING",
      });
    } else {
      matches.push({
        matchId: `R${roundNumber}_M${matchIndex++}`,
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
    .setTitle(`${tourney.name} - Round ${match.round}`)
    .setDescription(
      `**Match ID:** \`${match.matchId}\`\n**Game:** ${tourney.game} (${tourney.format})`,
    )
    .setColor(match.status === "COMPLETED" ? 0x57f287 : 0x5865f2);

  const playerDetails = [];

  for (let i = 0; i < match.players.length; i++) {
    const entry = match.players[i];
    const ids = entry.split(",");
    const profiles = await User.find({ discordId: { $in: ids } });

    const details = ids
      .map((id) => {
        const user = profiles.find((p) => p.discordId === id);
        const platoTag = user
          ? `(Plato: **${user.platoId}**)`
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
      value: match.winner ? `🏆 Winner: ${match.winner}` : "⏳ In Progress",
    },
  );

  const row = new ActionRowBuilder();

  // Create button for each candidate slot
  match.players.forEach((playerStr, idx) => {
    const isWinner = match.winner === playerStr;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`win_${tourney._id}_${match.matchId}_${idx}`)
        .setLabel(`Slot ${idx + 1} Win`)
        .setStyle(isWinner ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(match.status === "COMPLETED" && isWinner),
    );
  });

  // Reset button to revert mistakes
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`reset_${tourney._id}_${match.matchId}`)
      .setLabel("🔄 Reset")
      .setStyle(ButtonStyle.Danger),
  );

  return { embed, components: [row] };
}

module.exports = { generateRoundMatches, buildMatchCard, FORMAT_SIZES };
