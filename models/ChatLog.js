const mongoose = require("mongoose");

const chatLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  authorId: { type: String, required: true },
  authorTag: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // 24-hour TTL
});

module.exports = mongoose.model("ChatLog", chatLogSchema);
