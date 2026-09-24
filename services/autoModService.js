const { EmbedBuilder } = require("discord.js");
const Warning = require("../models/Warning");

// 1. Common Leet-speak character mappings
const LEET_MAP = {
  0: "o",
  1: "i",
  "!": "i",
  "|": "i",
  3: "e",
  4: "a",
  "@": "a",
  5: "s",
  $: "s",
  7: "t",
  "+": "t",
  8: "b",
  9: "g",
  v: "u", // e.g. "fvck"
};

// 2. Exact acronyms / common shortcuts (checked after whitespace removal)
const BANNED_ACRONYMS = new Set([
  "stfu",
  "wtf",
  "wth",
  "bc",
  "mc",
  "bkl",
  "mkc",
  "bsdk",
  "bhosdk",
  "fck",
  "btch",
  "mf",
]);

// 3. Flexible regex covering abbreviations, phonetic variations, and Hinglish
const FLEXIBLE_PROFANITY_REGEX = new RegExp(
  [
    // English variants
    "f+u*c*k+",
    "f+u+q+",
    "f+c+k+",
    "s+h+[i!|1]+t+",
    "b+[i!|1]+t*c*h+",
    "b+t+c+h+",
    "a+s+s+h*o*l*e*",
    "c+u+n+t+",
    "d+[i!|1]+c*k+",
    "b+a+s+t+a*r*d+",
    "n+[i!|1]+g+g+[a|e*r*]+",
    "p+u+s+s+y+",
    "w+h+o+r+e+",

    // Hinglish variants
    "m+[a*4*@*]*d+a*r*c*h+[o*0*]+d+",
    "b+h*e*n*c*h+[o*0*]+d+",
    "b+h*e*h*n*c*h+[o*0*]+d+",
    "c+h+[u*0*v*]+t+[i!|1]*y+[a*4*@*]+",
    "c+h+[u*0*v*]+t+",
    "g+[a*4*@*]*n+d+[u*0*v*]+",
    "g+[a*4*@*]*n+d+",
    "b+h*[o*0*]+s+d+[i!|1]*k+e*",
    "b+s+d+k+",
    "l+[a*4*@*]*u+d+[a*4*@*]+",
    "l+[o*0*]+d+[u*0*v*]+",
    "l+w+d+[a*4*@*]+",
    "h+[a*4*@*]*r+[a*4*@*]*m+[i!|1]+",
    "k+[a*4*@*]*m+[i!|1]+n+[a*4*@*]+",
    "r+[a*4*@*]*n+d+[i!|1]+",
  ].join("|"),
  "i",
);

/**
 * Normalizes text by removing non-alphanumeric noise,
 * converting leetspeak, and collapsing repeated characters.
 */
function normalizeText(text) {
  let lower = text.toLowerCase();

  // Replace leet characters with alphabet equivalents
  let decoded = "";
  for (const char of lower) {
    decoded += LEET_MAP[char] || char;
  }

  // Strip punctuation, symbols, and zero-width spaces (e.g. "f.u.c.k" -> "fuck")
  const stripped = decoded.replace(/[^a-z0-9\s]/g, "");

  // Collapse repeated characters: "fuuuuck" -> "fuck"
  const collapsed = stripped.replace(/(.)\1{2,}/g, "$1");

  return { stripped, collapsed };
}

function containsAbuse(rawContent) {
  const { stripped, collapsed } = normalizeText(rawContent);

  // Check 1: Collapsed text against regex patterns
  if (FLEXIBLE_PROFANITY_REGEX.test(collapsed)) return true;

  // Check 2: Stripped text against regex patterns (for short words)
  if (FLEXIBLE_PROFANITY_REGEX.test(stripped)) return true;

  // Check 3: Word-by-word acronym & slang matching
  const words = stripped.split(/\s+/);
  for (const word of words) {
    if (BANNED_ACRONYMS.has(word)) return true;
  }

  // Check 4: No-space bypass attempt (e.g., "b_s_d_k" -> "bsdk")
  const noSpaces = stripped.replace(/\s+/g, "");
  for (const acronym of BANNED_ACRONYMS) {
    if (noSpaces.includes(acronym)) return true;
  }

  return false;
}

async function checkAndModerateProfanity(message) {
  if (!containsAbuse(message.content)) return false;

  try {
    await message.delete().catch(() => {});

    const warnDoc = await Warning.findOneAndUpdate(
      { guildId: message.guild.id, userId: message.author.id },
      { $inc: { count: 1 }, $set: { lastWarning: new Date() } },
      { upsert: true, returnDocument: "after" },
    );

    const warnEmbed = new EmbedBuilder()
      .setColor(0xff0055)
      .setAuthor({
        name: "AUTOMATED CHAT POLICING",
        iconURL: message.guild.iconURL() || undefined,
      })
      .setDescription(
        `⚠️ ${message.author}, abusive/explicit language (including abbreviations & bypasses) is strictly prohibited.\n` +
          `Keep the server environment calm, civil, and curse-free.\n\n` +
          `\`\`\`fix\n[ STRIKE RECORD: ${warnDoc.count} WARNING(S) ]\n\`\`\``,
      )
      .setFooter({ text: "Message auto-deleted • Cleans in 7s" })
      .setTimestamp();

    const warnMsg = await message.channel.send({ embeds: [warnEmbed] });
    setTimeout(() => warnMsg.delete().catch(() => {}), 7000);

    return true;
  } catch (err) {
    console.error("AutoMod Service Error:", err);
    return false;
  }
}

module.exports = {
  checkAndModerateProfanity,
};
