const mongoose = require("mongoose");

const warningSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  count: { type: Number, default: 0 },
  lastWarning: { type: Date, default: Date.now },
});

warningSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Warning", warningSchema);
