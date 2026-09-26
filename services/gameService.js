const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash-lite";

async function queryAI(prompt) {
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    return res.text;
  } catch (err) {
    console.error("[GameService Error]:", err);
    return null;
  }
}

// 1. Spyfall Generator
async function getSpyfallSetup() {
  const prompt = `
Generate a single secret location and 5 distinctive character roles for that location in JSON format.
Output ONLY raw JSON with NO markdown backticks.

Example format:
{
  "location": "Submarine",
  "roles": ["Captain", "Sonar Technician", "Cook", "Torpedo Engineer", "Navigator"]
}
`;
  const text = await queryAI(prompt);
  try {
    return JSON.parse(
      text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim(),
    );
  } catch {
    return {
      location: "Space Station",
      roles: [
        "Commander",
        "Astrobiologist",
        "Docking Specialist",
        "Maintenance Robot",
        "Physicist",
      ],
    };
  }
}

// 2. Two Truths & An AI Lie Generator
async function getTwoTruths(topic = "Weird World History & Science") {
  const prompt = `
Topic: "${topic}"
Generate 3 statements: exactly 2 MUST be completely true, real, and surprising facts. Exactly 1 MUST be a completely fabricated, plausible-sounding AI lie.
Randomize which index is the lie.
Output ONLY raw JSON with NO markdown formatting:
{
  "statements": ["Statement 1", "Statement 2", "Statement 3"],
  "lieIndex": 0,
  "explanation": "Why the lie is false and context on the truths."
}
`;
  const text = await queryAI(prompt);
  try {
    return JSON.parse(
      text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim(),
    );
  } catch {
    return null;
  }
}

// 3. Dungeon Master Turn Resolver
async function resolveDungeonTurn(state, partyActions) {
  const prompt = `
You are an epic Dungeon Master running a dynamic co-op RPG combat encounter.
Current Boss/Threat: ${state.threatName} (HP: ${state.threatHp}/100)
Party Status: ${JSON.stringify(state.players)}
Encounter Stage: Round ${state.round}

Actions taken this round:
${partyActions.map((a) => `- ${a.user}:${a.action}`).join("\n")}

Rules:
1. Narrate the outcome of their actions in 2-3 cinematic sentences.
2. Determine damage dealt to the threat (10-35 depending on action creativity).
3. The threat counterattacks! Inflict 10-25 damage to random players.
4. Output ONLY valid JSON:
{
  "narration": "Cinematic description of what just happened.",
  "bossDamage": 25,
  "playerDamage": { "username": 15 },
  "isDefeated": false
}
`;
  const text = await queryAI(prompt);
  try {
    return JSON.parse(
      text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim(),
    );
  } catch {
    return {
      narration: "The battle echoes violently! Your strikes land firmly.",
      bossDamage: 20,
      playerDamage: {},
      isDefeated: false,
    };
  }
}

// 4. Courtroom Duel Moderator & Judge
async function getDebateTopic() {
  const prompt = `Generate a single absurd, hilarious, yet highly debatable courtroom motion. Return ONLY the debate title.`;
  const res = await queryAI(prompt);
  return res
    ? res.trim()
    : "Resolved: Pineapples on pizza should be punished by community service.";
}

async function judgeDebate(topic, p1Name, p2Name, debateTranscript) {
  const formattedTranscript = debateTranscript
    .map(
      (entry) => `[Round ${entry.round}] ${entry.speaker}: "${entry.argument}"`,
    )
    .join("\n\n");

  const prompt = `
You are the Supreme Magistrate of the Court of Absurdity.
Topic / Motion: "${topic}"

Trial Transcript:
${formattedTranscript}

Prosecution: ${p1Name}
Defense: ${p2Name}

Tasks:
1. Deliver a sharp, witty legal critique of how the entire debate unfolded across the rounds.
2. Evaluate who had the more convincing rhetoric, better rebuttals, or funniest logic.
3. Declare an official winner (${p1Name} or ${p2Name}) with an official title/punishment for the losing party.
Keep the verdict between 4-6 sentences. Tone: Formal, funny, and dramatic.
`;

  return await queryAI(prompt);
}

// 5. Reverse 20 Questions Logic
async function askNextTwentyQuestion(history) {
  const prompt = `
You are playing Reverse 20 Questions. You are trying to guess a secret entity (person, character, object, or place).
Previous questions asked and user answers:
${history.map((h, i) => `${i + 1}. Q: "${h.q}" -> A: ${h.a}`).join("\n")}

Total Questions Asked So Far: ${history.length}/20

Tasks:
- If you are at least 85% certain, formulate your question as a definitive guess: "Is it [Your Guess]?"
- Otherwise, ask the next strategic yes/no question to narrow down category, origin, properties, or alive status.
- Return ONLY the question string, nothing else.
`;
  const res = await queryAI(prompt);
  return res ? res.trim() : "Is this entity fictional?";
}

module.exports = {
  getSpyfallSetup,
  getTwoTruths,
  resolveDungeonTurn,
  getDebateTopic,
  judgeDebate,
  askNextTwentyQuestion,
};
