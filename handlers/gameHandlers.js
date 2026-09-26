const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

// Global registry preventing conversational AI interference during active games
const activeGameChannels = new Set();

async function handleGameInteractions(interaction) {
  const { commandName, channel, user } = interaction;

  // ==========================================
  // GAME 1: SPYFALL (120s LOBBY + EPHEMERAL DOSSIERS)
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

    await interaction.reply({ embeds: [lobbyEmbed], components: [row] });
    const lobbyMsg = await interaction.fetchReply();

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
  // GAME 2: TWO TRUTHS & AN AI LIE (STRICT SINGLE-CLICK)
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
        `Two of these statements are 100% verified facts. One is a fabrication manufactured by the AI.\n\n` +
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

    await interaction.reply({ embeds: [lobbyEmbed], components: [row] });
    const lobbyMsg = await interaction.fetchReply();

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
  // GAME 4: DEVIL'S ADVOCATE (SINGLETON DASHBOARD & MODALS)
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

    const transcript = [];
    let currentSpeaker = p1; // Prosecution starts
    let currentRound = 1;

    const buildCourtEmbed = () =>
      new EmbedBuilder()
        .setColor(0xd62828)
        .setTitle("🏛️ The Court of Absurdity")
        .setDescription(
          `**Motion on the Floor:**\n> *"${motion}"*\n\n` +
            `⚖️ **Prosecution:** ${p1}\n` +
            `🛡️ **Defense:** ${p2}\n\n` +
            `**Round ${currentRound}:** It is now ${currentSpeaker}'s turn to speak!\n` +
            `Click **"Speak"** below to submit your argument, or request a ruling.`,
        )
        .setFooter({ text: "Trial in Progress • Open Court" });

    const makeCourtButtons = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("court_submit_arg")
          .setLabel(`Speak (${currentSpeaker.username}'s Turn)`)
          .setEmoji("🎙️")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("court_call_verdict")
          .setLabel("Call for Final Verdict")
          .setEmoji("⚖️")
          .setStyle(ButtonStyle.Danger),
      );

    await interaction.reply({
      embeds: [buildCourtEmbed()],
      components: [makeCourtButtons()],
    });
    let currentControlMessage = await interaction.fetchReply();

    // Channel-level listener captures button clicks across regenerated messages
    const collector = channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (btn) =>
        btn.customId === "court_submit_arg" ||
        btn.customId === "court_call_verdict",
      time: 600000, // 10 minute court limit
    });

    collector.on("collect", async (btn) => {
      // --- ACTION A: SUBMIT ARGUMENT VIA MODAL ---
      if (btn.customId === "court_submit_arg") {
        if (btn.user.id !== currentSpeaker.id) {
          return btn.reply({
            content: `🛑 Objection! It is currently **${currentSpeaker.username}'s** turn to address the bench.`,
            ephemeral: true,
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(`court_modal_${currentRound}`)
          .setTitle(`Round ${currentRound}: Legal Statement`);

        const argInput = new TextInputBuilder()
          .setCustomId("arg_text")
          .setLabel("Present your argument to the Magistrate:")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(5)
          .setMaxLength(1500)
          .setPlaceholder(
            "Enter your argument, cross-examination, or evidence here...",
          )
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(argInput));
        await btn.showModal(modal);

        try {
          const modalSubmit = await btn.awaitModalSubmit({
            filter: (m) =>
              m.customId === `court_modal_${currentRound}` &&
              m.user.id === currentSpeaker.id,
            time: 180000,
          });

          const argument = modalSubmit.fields.getTextInputValue("arg_text");

          transcript.push({
            round: currentRound,
            speaker: currentSpeaker.username,
            argument,
          });

          await modalSubmit.reply({
            content: `📑 Argument entered into the record.`,
            ephemeral: true,
          });

          // 1. Delete previous control panel so only ONE exists in the channel
          if (currentControlMessage) {
            await currentControlMessage.delete().catch(() => {});
          }

          // 2. Post argument card in recent chat
          const argEmbed = new EmbedBuilder()
            .setColor(currentSpeaker.id === p1.id ? 0xe63946 : 0x457b9d)
            .setAuthor({
              name: `Round ${currentRound} • ${currentSpeaker.username} (${
                currentSpeaker.id === p1.id ? "Prosecution" : "Defense"
              })`,
              iconURL: currentSpeaker.displayAvatarURL(),
            })
            .setDescription(`"${argument}"`);

          await channel.send({ embeds: [argEmbed] });

          // 3. Advance turn & round
          if (currentSpeaker.id === p2.id) {
            currentRound++;
          }
          currentSpeaker = currentSpeaker.id === p1.id ? p2 : p1;

          // 4. Send brand NEW status dashboard at bottom of chat
          currentControlMessage = await channel.send({
            embeds: [buildCourtEmbed()],
            components: [makeCourtButtons()],
          });
        } catch {
          // Modal draft timed out
        }
      }

      // --- ACTION B: CALL FOR FINAL VERDICT ---
      if (btn.customId === "court_call_verdict") {
        if (btn.user.id !== p1.id && btn.user.id !== p2.id) {
          return btn.reply({
            content:
              "Only counsel (Prosecution or Defense) can call for a verdict.",
            ephemeral: true,
          });
        }

        if (transcript.length < 2) {
          return btn.reply({
            content:
              "⚠️ Both parties must submit at least one argument before calling for judgment!",
            ephemeral: true,
          });
        }

        collector.stop("verdict_requested");
        await btn.reply(
          `⚖️ ${btn.user} has rested their case! Court is now in recess for deliberation...`,
        );
      }
    });

    collector.on("end", async (_, reason) => {
      activeGameChannels.delete(channel.id);

      // Clean up the singleton dashboard
      if (currentControlMessage) {
        await currentControlMessage.delete().catch(() => {});
      }

      if (reason !== "verdict_requested" || transcript.length < 2) {
        return channel.send(
          "⚖️ Case dismissed without ruling due to courtroom recess / inactivity.",
        );
      }

      await channel.send(
        "👨‍⚖️ *The Supreme Magistrate is examining all rounds of arguments and formulating the official decree...*",
      );

      const verdict = await judgeDebate(
        motion,
        p1.username,
        p2.username,
        transcript,
      );

      const verdictEmbed = new EmbedBuilder()
        .setColor(0xd62828)
        .setTitle("🏛️ Final Courtroom Decree & Judgment")
        .setDescription(
          `**Motion:** *"${motion}"*\n` +
            `**Total Arguments Heard:** ${transcript.length} submissions across ${currentRound} rounds.\n\n` +
            `${verdict}`,
        )
        .setFooter({ text: "Court Adjourned • The Ruling is Final" })
        .setTimestamp();

      await channel.send({ embeds: [verdictEmbed] });
    });
  }

  // ==========================================
  // GAME 5: REVERSE 20 QUESTIONS
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
