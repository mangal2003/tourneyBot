const Warning = require("../models/Warning");

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
  v: "u",
};

const BANNED_ACRONYMS = new Set([
  "stfu",
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

const FLEXIBLE_PROFANITY_REGEX = new RegExp(
  [
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
    "p+u+s+s+y+",
    "w+h+o+r+e+",
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

const HINGLISH_DICTIONARY = new Set([
  "kyun",
  "kaise",
  "kaisa",
  "kaisi",
  "kaha",
  "kahan",
  "kidhar",
  "bhai",
  "yaar",
  "bhaiya",
  "dost",
  "apna",
  "apni",
  "mera",
  "meri",
  "tere",
  "tera",
  "teri",
  "tumhara",
  "tumhari",
  "humara",
  "uska",
  "uski",
  "unka",
  "inka",
  "hain",
  "hoga",
  "hogi",
  "honge",
  "nahi",
  "karo",
  "kare",
  "karna",
  "krna",
  "raha",
  "rahe",
  "rahi",
  "gaya",
  "gayi",
  "gaye",
  "aaya",
  "aayi",
  "aaye",
  "chal",
  "chalo",
  "bolo",
  "batao",
  "dekh",
  "dekho",
  "suno",
  "samjho",
  "samjha",
  "pata",
  "accha",
  "acha",
  "theek",
  "thik",
  "badiya",
  "sahi",
  "galat",
  "kuch",
  "bahut",
  "bohot",
  "zyada",
  "jyada",
  "abhi",
  "baad",
  "pehle",
  "andar",
  "bahar",
  "upar",
  "niche",
  "lekin",
  "magar",
  "mein",
]);

const NON_LATIN_SCRIPT_REGEX =
  /[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF]/;

function normalizeText(text) {
  let lower = text.toLowerCase();
  let decoded = "";
  for (const char of lower) {
    decoded += LEET_MAP[char] || char;
  }
  const stripped = decoded.replace(/[^a-z0-9\s]/g, "");
  const collapsed = stripped.replace(/(.)\1{2,}/g, "$1");
  return { stripped, collapsed };
}

function containsAbuse(rawContent) {
  if (!rawContent) return false;
  const { stripped, collapsed } = normalizeText(rawContent);

  if (FLEXIBLE_PROFANITY_REGEX.test(collapsed)) return true;
  if (FLEXIBLE_PROFANITY_REGEX.test(stripped)) return true;

  const words = stripped.split(/\s+/);
  for (const word of words) {
    if (BANNED_ACRONYMS.has(word)) return true;
  }

  const noSpaces = stripped.replace(/\s+/g, "");
  for (const acronym of BANNED_ACRONYMS) {
    if (noSpaces.includes(acronym)) return true;
  }

  return false;
}

function isExcessiveNonEnglish(rawContent) {
  if (!rawContent) return false;

  if (NON_LATIN_SCRIPT_REGEX.test(rawContent)) {
    return true;
  }

  const words = rawContent
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length < 4) return false;

  let hinglishCount = 0;
  for (const word of words) {
    if (HINGLISH_DICTIONARY.has(word)) {
      hinglishCount++;
    }
  }

  const density = hinglishCount / words.length;
  return density >= 0.35;
}

async function checkAndModerateProfanity(message) {
  // Check 1: Explicit Abuse / Profanity Warning (Text kept in chat)
  if (containsAbuse(message.content)) {
    try {
      const warnDoc = await Warning.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id },
        { $inc: { count: 1 }, $set: { lastWarning: new Date() } },
        { upsert: true, returnDocument: "after" },
      );

      await message.channel.send({
        content: `⚠️ ${message.author}, watch your language. Keep it civil and curse-free! \`[Strike #${warnDoc.count}]\``,
      });

      return false; // Return false so text is logged to rolling memory
    } catch (err) {
      console.error("AutoMod Profanity Error:", err);
      return false;
    }
  }

  // Check 2: Language Preference (English reminder)
  if (isExcessiveNonEnglish(message.content)) {
    try {
      await message.channel.send({
        content: `🌐 ${message.author}, please keep the conversation in **English** so everyone in the server can understand and participate!`,
      });
      return false;
    } catch (err) {
      console.error("AutoMod Language Error:", err);
      return false;
    }
  }

  return false;
}

module.exports = {
  checkAndModerateProfanity,
};
