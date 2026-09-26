const Warning = require("../models/Warning");
const { evaluateContentModeration } = require("./aiService");

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

function localContainsAbuse(rawContent) {
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

function localIsNonEnglish(rawContent) {
  if (!rawContent) return false;
  if (NON_LATIN_SCRIPT_REGEX.test(rawContent)) return true;

  const words = rawContent
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length < 3) return false;

  let hinglishCount = 0;
  for (const word of words) {
    if (HINGLISH_DICTIONARY.has(word)) hinglishCount++;
  }

  return hinglishCount / words.length >= 0.35;
}

async function checkAndModerateProfanity(message) {
  if (!message.guild || message.author.bot) return false;

  const rawText = message.content.trim();
  if (!rawText) return false;

  // 1. Fast Local Pattern Evaluation
  let isProfane = localContainsAbuse(rawText);
  let isNonEnglish = localIsNonEnglish(rawText);

  // 2. Multilingual AI Moderation Check (detects cuss words in Spanish, Arabic, Hindi, etc.)
  if (!isProfane) {
    const aiAnalysis = await evaluateContentModeration(rawText);
    if (aiAnalysis) {
      if (aiAnalysis.isProfane) isProfane = true;
      if (aiAnalysis.isNonEnglish) isNonEnglish = true;
    }
  }

  // ==========================================
  // PROFANITY / CUSSING DETECTED (ANY LANGUAGE)
  // ==========================================
  if (isProfane) {
    try {
      const warnDoc = await Warning.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id },
        {
          $inc: { strikes: 1 },
          $set: {
            lastReason: "Multilingual Profanity / Abusive Language",
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      const strikes = warnDoc.strikes;
      const member =
        message.member ||
        (await message.guild.members
          .fetch(message.author.id)
          .catch(() => null));

      // Dynamic Timeout for > 20 Strikes
      if (strikes > 5 && member) {
        const timeoutSeconds = strikes; // e.g. 21s, 22s, 35s
        const timeoutMs = timeoutSeconds * 1000;

        const botMember = message.guild.members.me;
        if (botMember && botMember.permissions.has("ModerateMembers")) {
          try {
            await member.timeout(
              timeoutMs,
              `Exceeded 5 warning threshold (${strikes} strikes)`,
            );

            await message.channel.send({
              content: `⚠️ ${message.author}, watch your language. Curse words in any language are not permitted! **[Warning #${strikes}]** \n\n 🔇 **Timeout Applied:** ${message.author} is muted for **${timeoutSeconds} seconds**.`,
            });
            return true;
          } catch (timeoutErr) {
            console.error("[AutoMod Timeout Error]:", timeoutErr);
          }
        }
      }

      // If cuss word was in a non-English language, combine the cuss warning with the English policy
      const langNote = isNonEnglish
        ? ` Please also note that conversations must remain in **English**.`
        : "";

      await message.channel.send({
        content: `⚠️ ${message.author}, watch your language. Curse words in any language are not permitted! \`[Warning #${strikes}]\`${langNote}`,
      });

      return true; // Blocks AI response and halts pipeline
    } catch (err) {
      console.error("[AutoMod Profanity Error]:", err);
      return false;
    }
  }

  // ==========================================
  // PURE NON-ENGLISH LANGUAGE CHECK (NO CUSSING)
  // ==========================================
  if (isNonEnglish) {
    try {
      await message.channel.send({
        content: `🌐 ${message.author}, please keep the conversation in **English** so everyone in the server can understand and participate!`,
      });
      return true; // Halts conversational AI execution
    } catch (err) {
      console.error("[AutoMod Language Error]:", err);
      return false;
    }
  }

  return false;
}

module.exports = {
  checkAndModerateProfanity,
};
