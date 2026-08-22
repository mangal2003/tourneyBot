const GuildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  tourneyChannelId: { type: String, required: true },
});

const GuildConfig = mongoose.model("GuildConfig", GuildConfigSchema);
