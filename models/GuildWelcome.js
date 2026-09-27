const mongoose = require("mongoose");

const guildWelcomeSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  channelId: {
    type: String,
    default: null,
  },
  greetingMessage: {
    type: String,
    default:
      "Welcome to **{server}**, {user}! We're thrilled to have you here.",
  },
  rulesChannelId: {
    type: String,
    default: null,
  },
  chatChannelId: {
    type: String,
    default: null,
  },
  rolesChannelId: {
    type: String,
    default: null,
  },
  bannerUrl: {
    type: String,
    default: null,
  },
  embedColor: {
    type: String,
    default: "#5865F2",
  },
  isEnabled: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("GuildWelcome", guildWelcomeSchema);
