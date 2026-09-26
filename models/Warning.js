const mongoose = require("mongoose");

const warningSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  strikes: {
    type: Number,
    default: 0,
  },
  lastReason: {
    type: String,
    default: "Profanity / Policy Violation",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

warningSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Warning", warningSchema);
