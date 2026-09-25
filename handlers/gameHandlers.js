const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} = require("discord.js");
const {
  getSpyfallSetup,
  getTwoTruths,
  resolveDungeonTurn,
  getDebateTopic,
  judgeDebate,
  askNextTwentyQuestion,
} = require("../services/gameService");

// Global set shared with index.js to prevent AI chat replies during active games
const activeGameChannels = new Set();

async function handleGameInteractions(interaction) {
  const { commandName, channel, user } = interaction;

  // ==========================================
  // GAME 1: SPYFALL (EXTENDED 120s LOBBY)
  // ==========================================
  if (commandName === "spyfall") {
    activeGameChannels.add(channel.id);

    const joinBtn = new ButtonBuilder()
      .setCustomId("spy_join")
      .setLabel("Join Lobby")
      .setStyle(ButtonStyle.Success);

    const startBtn = new ButtonBuilder()
      .setCustomId("spy_start")
      .setLabel("Launch Mission")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinBtn, startBtn);
    const lobby = new Set([user.id]);

    const lobbyEmbed = new EmbedBuilder()
      .setColor(0xd62828)
      .setTitle("🕵️ Spyfall Mission Lobby")
      .setDescription(
        `**Host:** ${user}\n` +
          `**Operatives Enlisted:**\n- ${user.username}\n\n` +
          `⏱️ **Lobby Open:** 120 seconds to enlist operatives!`,
      )
      .setFooter({ text: "Requires 3 or more operatives to launch." });

    const lobbyMsg = await interaction.reply({
      embeds: [lobbyEmbed],
      components: [row],
      fetchReply: true,
    });

    const collector = lobbyMsg.createMessageComponentCollector({
      time: 120000,
    });

    collector.on("collect", async (btn) => {
      if (btn.customId === "spy_join") {
        lobby.add(btn.user.id);
        const membersList = Array.from(lobby)
          .map((id) => `<@${id}>`)
          .join("\n- ");
        await lobbyMsg.edit({
          embeds: [
            EmbedBuilder.from(lobbyEmbed).setDescription(
              `**Host:** ${user}\n` +
                `**Operatives Enlisted:**\n- ${membersList}\n\n` +
                `⏱️ **Lobby Open:** 120 seconds to enlist operatives!`,
            ),
          ],
        });
        return btn.reply({
          content: "You enlisted in the mission!",
          ephemeral: true,
        });
      }

      if (btn.customId === "spy_start") {
        if (btn.user.id !== user.id) {
          return btn.reply({
            content: "Only the mission host can launch!",
            ephemeral: true,
          });
        }
        if (lobby.size < 3) {
          return btn.reply({
            content: "At least 3 operatives are required!",
            ephemeral: true,
          });
        }
        collector.stop("started");
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason !== "started") {
        activeGameChannels.delete(channel.id);
        return interaction.followUp(
          "Mission aborted: Lobby recruitment timed out.",
        );
      }

      const players = Array.from(lobby);
      const spyIndex = Math.floor(Math.random() * players.length);
      const setup = await getSpyfallSetup();

      const revealBtn = new ButtonBuilder()
        .setCustomId("reveal_role")
        .setLabel("View Confidential Dossier")
        .setStyle(ButtonStyle.Secondary);

      const revealRow = new ActionRowBuilder().addComponents(revealBtn);

      const activeEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("🚨 Mission Active: Interrogation Phase")
        .setDescription(
          `Click below to view your classified assignment. The Spy **does NOT** know the location!\n\n` +
            `**Rules:** Interrogate each other in chat without giving away the exact place.\n` +
            `**Time limit:** 5 minutes.`,
        );

      const gameMsg = await channel.send({
        embeds: [activeEmbed],
        components: [revealRow],
      });
      const roleCollector = gameMsg.createMessageComponentCollector({
        time: 300000,
      });

      roleCollector.on("collect", async (btn) => {
        if (!lobby.has(btn.user.id)) {
          return btn.reply({
            content: "You are not an enlisted operative in this session!",
            ephemeral: true,
          });
        }

        const isSpy = btn.user.id === players[spyIndex];
        if (isSpy) {
          return btn.reply({
            content: `🕵️ **YOU ARE THE SPY!**\nYou do not know the location. Blend in, bluff, and deduce where the operatives are!`,
            ephemeral: true,
          });
        }

        const role =
          setup.roles[Math.floor(Math.random() * setup.roles.length)];
        return btn.reply({
          content: `📍 **LOCATION:** **${setup.location}**\n🎭 **YOUR ROLE:** **${role}**`,
          ephemeral: true,
        });
      });

      roleCollector.on("end", () => {
        activeGameChannels.delete(channel.id);
        channel.send(
          "⏱️ **Interrogation Over!** Call a vote in chat and expose the spy!",
        );
      });
    });
  }

  // ==========================================
  // GAME 2: TWO TRUTHS & AN AI LIE (ONE-CLICK STRICT)
  // ==========================================
  if (commandName === "twotruths") {
    await interaction.deferReply();
    const topic =
      interaction.options.getString("topic") ||
      "Weird World History & Bizarre Science";
    const data = await getTwoTruths(topic);

    if (!data)
      return interaction.editReply(
        "Could not synthesize facts at this moment.",
      );

    const buttons = data.statements.map((stmt, idx) =>
      new ButtonBuilder()
        .setCustomId(`lie_${idx}`)
        .setLabel(`Option ${idx + 1}`)
        .setStyle(ButtonStyle.Primary),
    );
    const row = new ActionRowBuilder().addComponents(buttons);

    const embed = new EmbedBuilder()
      .setColor(0xd62828)
      .setTitle("🧩 Spot The AI Hallucination")
      .setDescription(
        `Two of these statements are 100% verified facts. One is a fabrication generated by the AI.\n\n` +
          `**1.** ${data.statements[0]}\n` +
          `**2.** ${data.statements[1]}\n` +
          `**3.** ${data.statements[2]}\n\n` +
          `*Choose carefully! You only get ONE attempt.*`,
      );

    const msg = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 35000,
    });

    // Tracks users who already submitted an answer
    const lockedUsers = new Set();

    collector.on("collect", async (btn) => {
      if (lockedUsers.has(btn.user.id)) {
        return btn.reply({
          content: "❌ You have already locked in your answer for this round!",
          ephemeral: true,
        });
      }

      lockedUsers.add(btn.user.id);
      const choice = parseInt(btn.customId.replace("lie_", ""), 10);

      if (choice === data.lieIndex) {
        collector.stop("found");
        await btn.reply({
          content: "🎯 Correct! You caught the AI lie!",
          ephemeral: true,
        });

        const winEmbed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle("🏆 Hallucination Exposed!")
          .setDescription(
            `👑 **Victor:** ${btn.user}\n\n` +
              `❌ **The Lie:** Option ${data.lieIndex + 1} (*"${data.statements[data.lieIndex]}"*)\n\n` +
              `📖 **The Reality:** ${data.explanation}`,
          );

        return interaction.editReply({ embeds: [winEmbed], components: [] });
      } else {
        await btn.reply({
          content:
            "❌ Incorrect! That one is actually true. You are locked out!",
          ephemeral: true,
        });
      }
    });

    collector.on("end", (_, reason) => {
      if (reason !== "found") {
        interaction.editReply({
          content: `⏱️ Time up! Nobody caught the AI. The fake statement was **Option ${data.lieIndex + 1}**.\n*${data.explanation}*`,
          components: [],
        });
      }
    });
  }

  // ==========================================
  // GAME 3: CO-OP DUNGEON (BUTTON ACTIONS + 60s LOBBY)
  // ==========================================
  if (commandName === "dungeon") {
    activeGameChannels.add(channel.id);

    const joinBtn = new ButtonBuilder()
      .setCustomId("dungeon_join")
      .setLabel("Enlist in Raid")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(joinBtn);

    const party = new Map();
    party.set(user.id, { username: user.username, hp: 100 });

    const lobbyEmbed = new EmbedBuilder()
      .setColor(0xd62828)
      .setTitle("⚔️ Dungeon Raid Gathering")
      .setDescription(
        `**Raid Leader:** ${user}\n` +
          `**Party Members:**\n- ${user.username} (100 HP)\n\n` +
          `⏱️ **Raid starts in 60 seconds.** Click below to assemble!`,
      );

    const lobbyMsg = await interaction.reply({
      embeds: [lobbyEmbed],
      components: [row],
      fetchReply: true,
    });

    const lobbyCollector = lobbyMsg.createMessageComponentCollector({
      time: 60000,
    });

    lobbyCollector.on("collect", async (btn) => {
      if (party.has(btn.user.id)) {
        return btn.reply({
          content: "You are already in the party!",
          ephemeral: true,
        });
      }

      party.set(btn.user.id, { username: btn.user.username, hp: 100 });
      const roster = Array.from(party.values())
        .map((p) => `- ${p.username} (100 HP)`)
        .join("\n");

      await lobbyMsg.edit({
        embeds: [
          EmbedBuilder.from(lobbyEmbed).setDescription(
            `**Raid Leader:** ${user}\n` +
              `**Party Members:**\n${roster}\n\n` +
              `⏱️ **Raid starts in 60 seconds.** Click below to assemble!`,
          ),
        ],
      });

      return btn.reply({
        content: "Equipped and ready for battle!",
        ephemeral: true,
      });
    });

    lobbyCollector.on("end", async () => {
      let state = {
        threatName: "Ironclad Abyssal Colossus",
        threatHp: 100,
        round: 1,
        players: Array.from(party.values()),
      };

      const combatRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("act_attack")
          .setLabel("⚔️ Attack")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("act_defend")
          .setLabel("🛡️ Shield / Defend")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("act_heal")
          .setLabel("🧪 Heal Party")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("act_special")
          .setLabel("⚡ Special Ability")
          .setStyle(ButtonStyle.Secondary),
      );

      // 3 Combat Encounter Rounds
      for (let r = 1; r <= 3; r++) {
        state.round = r;

        const roundMsg = await channel.send({
          content:
            `🚨 **ROUND ${r}/3 ENGAGED!**\n` +
            `Boss: **${state.threatName}** (HP: ${state.threatHp}/100)\n` +
            `*Each party member: select your combat action within 25 seconds!*`,
          components: [combatRow],
        });

        const turnActions = [];
        const actedUsers = new Set();

        const turnCollector = roundMsg.createMessageComponentCollector({
          time: 25000,
        });

        await new Promise((resolve) => {
          turnCollector.on("collect", async (btn) => {
            if (!party.has(btn.user.id)) {
              return btn.reply({
                content: "You are not in the raid group!",
                ephemeral: true,
              });
            }
            if (actedUsers.has(btn.user.id)) {
              return btn.reply({
                content: "You have already acted this turn!",
                ephemeral: true,
              });
            }

            actedUsers.add(btn.user.id);
            const actionType = {
              act_attack: "Strikes hard with a heavy weapon assault",
              act_defend: "Raises an energy shield to deflect oncoming blows",
              act_heal: "Channels rejuvenating vitality to the party",
              act_special: "Executes an overcharged supernatural ultimate",
            }[btn.customId];

            turnActions.push({ user: btn.user.username, action: actionType });
            await btn.reply({
              content: `Action locked in: **${btn.component.label}**`,
              ephemeral: true,
            });

            if (actedUsers.size === party.size) {
              turnCollector.stop("all_acted");
            }
          });

          turnCollector.on("end", () => resolve());
        });

        if (turnActions.length === 0) {
          await channel.send(
            "💀 The party hesitated! The boss pulverized the line.",
          );
          activeGameChannels.delete(channel.id);
          return;
        }

        const turnResult = await resolveDungeonTurn(state, turnActions);
        state.threatHp = Math.max(
          0,
          state.threatHp - (turnResult.bossDamage || 30),
        );

        const turnEmbed = new EmbedBuilder()
          .setColor(0xd62828)
          .setTitle(`⚔️ Turn ${r} Outcome`)
          .setDescription(
            `${turnResult.narration}\n\n` +
              `💥 **Boss HP Remaining:** ${state.threatHp}/100`,
          );

        await channel.send({ embeds: [turnEmbed] });

        if (state.threatHp <= 0) {
          await channel.send(
            "🎉 **VICTORY!** The Abyssal Colossus has been defeated! The raid cleared!",
          );
          activeGameChannels.delete(channel.id);
          return;
        }
      }

      await channel.send(
        "🛡️ The monster withdrew into the darkness! Mission complete!",
      );
      activeGameChannels.delete(channel.id);
    });
  }

  // ==========================================
  // GAME 4: DEVIL'S ADVOCATE (EXTENDED 75s TYPING)
  // ==========================================
  if (commandName === "court") {
    activeGameChannels.add(channel.id);
    const p1 = user;
    const p2 = interaction.options.getUser("opponent");
    const customTopic = interaction.options.getString("topic");
    const motion = customTopic || (await getDebateTopic());

    if (p2.bot || p2.id === p1.id) {
      activeGameChannels.delete(channel.id);
      return interaction.reply({
        content: "You must challenge another real member!",
        ephemeral: true,
      });
    }

    await interaction.reply({
      content:
        `⚖️ **THE COURT OF ABSURDITY IS NOW IN SESSION!**\n` +
        `**Motion:** *"${motion}"*\n\n` +
        `🏛️ **Prosecution:** ${p1}\n` +
        `🛡️ **Defense:** ${p2}\n\n` +
        `Prosecution (${p1}), present your opening argument! You have **75 seconds**.`,
    });

    try {
      const p1Collected = await channel.awaitMessages({
        filter: (m) => m.author.id === p1.id,
        max: 1,
        time: 75000,
        errors: ["time"],
      });
      const p1Arg = p1Collected.first().content;

      await channel.send(
        `⚖️ **Defense's Turn!** ${p2}, present your counter-rebuttal! You have **75 seconds**.`,
      );

      const p2Collected = await channel.awaitMessages({
        filter: (m) => m.author.id === p2.id,
        max: 1,
        time: 75000,
        errors: ["time"],
      });
      const p2Arg = p2Collected.first().content;

      await channel.send(
        "👨‍⚖️ *The Magistrate is analyzing rhetorical eloquence and drafting the verdict...*",
      );
      const verdict = await judgeDebate(
        motion,
        p1.username,
        p1Arg,
        p2.username,
        p2Arg,
      );

      const verdictEmbed = new EmbedBuilder()
        .setColor(0xd62828)
        .setTitle("🏛️ Official Court Ruling")
        .setDescription(`**Case:** *${motion}*\n\n${verdict}`);

      await channel.send({ embeds: [verdictEmbed] });
    } catch {
      await channel.send(
        "⚖️ Case dismissed! One of the advocates failed to appear before the court.",
      );
    } finally {
      activeGameChannels.delete(channel.id);
    }
  }

  // ==========================================
  // GAME 5: REVERSE 20 QUESTIONS (CLARIFIED FLOW)
  // ==========================================
  if (commandName === "twentyq") {
    activeGameChannels.add(channel.id);

    await interaction.reply({
      content:
        `🧠 **REVERSE 20 QUESTIONS ACTIVATED!**\n` +
        `1. Think of any character, real person, landmark, or object.\n` +
        `2. I will ask up to 20 strategic questions to deduce it.\n` +
        `3. Answer truthfully using the buttons below. I only win if I make an official guess and you hit **Yes**!\n` +
        `*If you reach 20 questions without me guessing it, YOU WIN!*`,
    });

    const history = [];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ans_yes")
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ans_no")
        .setLabel("No")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ans_sometimes")
        .setLabel("Sometimes / Partly")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("ans_idk")
        .setLabel("Irrelevant / Unknown")
        .setStyle(ButtonStyle.Secondary),
    );

    for (let round = 1; round <= 20; round++) {
      const question = await askNextTwentyQuestion(history);

      const isOfficialGuess =
        question.toLowerCase().startsWith("is it ") ||
        question.toLowerCase().startsWith("are you thinking of");

      const qMsg = await channel.send({
        content: `**Question ${round}/20:** ${question}`,
        components: [row],
      });

      try {
        const btn = await qMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 45000,
        });

        const choiceLabel = {
          ans_yes: "Yes",
          ans_no: "No",
          ans_sometimes: "Sometimes",
          ans_idk: "Unknown",
        }[btn.customId];

        history.push({ q: question, a: choiceLabel });
        await btn.reply({
          content: `Answer locked: **${choiceLabel}**`,
          ephemeral: true,
        });

        // AI only wins if it made an official final guess and the user pressed Yes
        if (isOfficialGuess && choiceLabel === "Yes") {
          await channel.send(
            `🎉 **I WIN!** I cracked your secret entity in ${round} questions!`,
          );
          activeGameChannels.delete(channel.id);
          return;
        }
      } catch {
        await channel.send("⏱️ Time expired! The round was forfeited.");
        activeGameChannels.delete(channel.id);
        return;
      }
    }

    await channel.send(
      "👑 **YOU DEFEATED THE AI!** You stumped me for all 20 questions! Reveal what it was in chat!",
    );
    activeGameChannels.delete(channel.id);
  }
}

module.exports = {
  handleGameInteractions,
  activeGameChannels,
};
