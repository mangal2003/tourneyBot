const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema({
  matchId: { type: String, required: true },
  round: { type: Number, required: true },
  players: [{ type: String, required: true }], // Array of Discord IDs or team strings
  winner: { type: String, default: null },
  status: { type: String, enum: ["PENDING", "COMPLETED"], default: "PENDING" },
  messageId: { type: String, default: null }, // Stores Discord message ID for button updates
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
  participants: [{ type: String }], // Array of Discord IDs
  currentRound: { type: Number, default: 1 },
  matches: [MatchSchema],
});

module.exports = mongoose.model("Tournament", TournamentSchema);
