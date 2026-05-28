import { Op } from "sequelize";
import BotCajeroLog from "../../models/BotCajeroLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { getWbot } from "../../providers/WhatsApp/Implementations/whaileys";
import { logger } from "../../utils/logger";
import GetConfigService from "./GetConfigService";
import { isInQuietMode } from "./QuietModeService";
import {
  getTodayFixtures,
  formatFixturesByLeague
} from "./FootballApiService";
import { addPredictionEntry, getPredictionById } from "./PredictionService";
import { humanDelay, variaRespuesta } from "./HumanDelay";

const BOT_MENTION_PATTERN = /@(botcajero|bot)\b/i;

const handleGroupCommand = async (
  whatsappId: number,
  groupJid: string,
  messageBody: string,
  senderJid: string
): Promise<void> => {
  try {
    const config = await GetConfigService(whatsappId);

    // 🔒 HARDCODED LOCK
    const HARD_CODED_GROUP = "120363426709880780@g.us";
    if (config.groupJid !== HARD_CODED_GROUP) return;
    if (config.groupJid !== groupJid) return;
    if (isInQuietMode(config)) return;

    const senderName = senderJid.split("@")[0] || "Usuario";
    const senderClean = senderJid.replace(/[^0-9]/g, "");

    // Parse command from "/" or "@bot" syntax
    let command = "";
    let args = "";

    if (messageBody.startsWith("/")) {
      // "/stats args" → command="stats", args="args"
      const spaceIdx = messageBody.indexOf(" ");
      command = spaceIdx > 0 ? messageBody.substring(1, spaceIdx).toLowerCase() : messageBody.substring(1).toLowerCase();
      args = spaceIdx > 0 ? messageBody.substring(spaceIdx + 1).trim() : "";
      // If only "/" with no command, treat as help
      if (!command) command = "help";
    } else {
      const mentionMatch = messageBody.match(BOT_MENTION_PATTERN);
      if (!mentionMatch) return;
      const afterMention = messageBody.slice(mentionMatch.index! + mentionMatch[0].length).trim();
      command = afterMention.split(/\s+/)[0]?.toLowerCase() || "";
      args = afterMention.substring(command.length).trim();
    }

    if (!command) return;

    // ─── Router ───
    switch (command) {
      case "reglas": {
        if (config.rules && config.rules.trim()) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, `🤖 Reglas del grupo:\n📜 ${config.rules}`);
        } else {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "📜 No hay reglas configuradas todavía.");
        }
        await BotCajeroLog.create({ botCajeroConfigId: config.id, eventType: "group_command", detail: `@${senderName} consultó reglas` });
        break;
      }

      case "ayuda":
      case "help": {
        const intro = variaRespuesta([
          "🤖 *Comandos disponibles en este grupo:*",
          "📋 *Comandos que puedo entender:*",
          "🤖 *Esto es lo que sé hacer:*"
        ]);
        const text =
          `${intro}\n\n` +
          `• \`/reglas\` o @bot reglas — Muestra reglas\n` +
          `• \`/horarios\` o @bot horarios — Horarios\n` +
          `• \`/partidos\` o @bot partidos — Partidos hoy\n` +
          `• \`/stats\` o @bot stats — Estadísticas\n` +
          `• \`/predecir <ID> <valor>\` — Predecir dinámica\n` +
          `*(Admin)* \`/promo\`, \`/sorteo\`, \`/encuesta\`, \`/warn\``;
        await humanDelay();
        await whatsappProvider.sendMessage(whatsappId, groupJid, text);
        await BotCajeroLog.create({ botCajeroConfigId: config.id, eventType: "group_command", detail: `@${senderName} consultó ayuda` });
        break;
      }

      case "horarios": {
        if (!config.businessHoursEnabled) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "🤖 La consulta de horarios está desactivada.");
          break;
        }
        if (!config.businessHours?.trim()) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "🤖 No hay horarios configurados todavía.");
          break;
        }
        try {
          const hours = JSON.parse(config.businessHours);
          const days: Record<string, string> = { lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves", viernes: "Viernes", sabado: "Sábado", domingo: "Domingo" };
          let text = "🤖 Horarios de atención:\n";
          for (const [key, label] of Object.entries(days)) {
            if (hours[key]) text += `🗓️ ${label}: ${hours[key]}\n`;
          }
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, text.trim());
          await BotCajeroLog.create({ botCajeroConfigId: config.id, eventType: "business_hours", detail: "Horarios consultados en grupo" });
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "🤖 Error al cargar horarios.");
        }
        break;
      }

      case "partidos": {
        try {
          const { getAllSportsToday, formatAllSports } = await import("./SportsApiService");
          const tz = process.env.TZ || "America/La_Paz";
          const dateLabel = new Intl.DateTimeFormat("es", { timeZone: tz, weekday: "long", day: "numeric", month: "numeric", year: "numeric" }).format(new Date());
          const sportsData = await getAllSportsToday();
          const msg = formatAllSports(sportsData.football, sportsData.basketball, dateLabel, false);
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, msg);
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Error al consultar partidos.");
        }
        break;
      }

      case "stats": {
        try {
          const wbot = getWbot(whatsappId);
          const groupMeta = await wbot.groupMetadata(config.groupJid);
          const totalMembers = groupMeta.participants.length;
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayLogs = await BotCajeroLog.count({
            where: { botCajeroConfigId: config.id, createdAt: { [Op.gte]: todayStart } }
          });
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, `📊 *Estadísticas del grupo*\n\n👥 Miembros: ${totalMembers}\n📊 Eventos hoy: ${todayLogs}`);
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Error al obtener estadísticas.");
        }
        break;
      }

      case "predecir": {
        const predId = parseInt(args.split(/\s+/)[0], 10);
        const value = args.split(/\s+/).slice(1).join(" ").trim();
        if (!predId || !value) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Usa: /predecir <ID> <valor>\nEj: /predecir 3 2-1");
          return;
        }
        const entry = await addPredictionEntry(predId, senderJid, senderName, value);
        if (!entry) {
          const pred = await getPredictionById(predId, config.id);
          if (!pred) {
            await humanDelay();
            await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Dinámica no encontrada.");
          } else if (pred.status !== "abierta") {
            await humanDelay();
            await whatsappProvider.sendMessage(whatsappId, groupJid, `❌ La dinámica #${predId} ya está cerrada.`);
          } else {
            await humanDelay();
            await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Ya registraste una predicción.");
          }
          return;
        }
        await humanDelay();
        await whatsappProvider.sendMessage(whatsappId, groupJid, `✅ @${senderName}, tu predicción "${value}" fue registrada para la dinámica #${predId}.`);
        break;
      }

      // ─── Admin-only commands ───
      case "promo": {
        if (senderClean !== config.adminNumber) return;
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Usa: /promo <texto>");
          return;
        }
        await humanDelay();
        await whatsappProvider.sendMessage(whatsappId, groupJid, `📢 PROMO DEL DÍA:\n\n${args}`);
        break;
      }

      case "sorteo": {
        if (senderClean !== config.adminNumber) return;
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Usa: /sorteo <premio>");
          return;
        }
        try {
          const wbot = getWbot(whatsappId);
          const groupMeta = await wbot.groupMetadata(config.groupJid);
          const participants = groupMeta.participants || [];
          const botJid = (wbot.user?.id || "").replace(/:[0-9]+/, "");
          const members = participants.filter((p: { id: string }) => (p.id || "").replace(/:[0-9]+/, "") !== botJid);
          if (members.length === 0) {
            await humanDelay();
            await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ No hay miembros.");
            return;
          }
          const winner = members[Math.floor(Math.random() * members.length)];
          const winnerJid = winner.id;
          await humanDelay();
          await wbot.sendMessage(config.groupJid, {
            text: `🎉 *SORTEO*\n\nPremio: ${args}\nGanador: @${winnerJid.split("@")[0]}\n\n¡Felicidades! 🎊`,
            mentions: [winnerJid]
          });
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Error al realizar sorteo.");
        }
        break;
      }

      case "encuesta": {
        if (senderClean !== config.adminNumber) return;
        const pipeIndex = args.indexOf("|");
        if (pipeIndex === -1) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Usa: /encuesta <pregunta> | op1 | op2");
          return;
        }
        const question = args.substring(0, pipeIndex).trim();
        const options = args.substring(pipeIndex + 1).split("|").map((o: string) => o.trim()).filter(Boolean);
        if (options.length < 2 || options.length > 5) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ 2 a 5 opciones.");
          return;
        }
        try {
          await humanDelay();
          const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
          let pollText = `📊 *${question}*\n\n`;
          options.forEach((opt: string, i: number) => {
            const idx = emojis[i] || String(i+1) + ".";
            pollText += `${idx}  ${opt}\n`;
          });
          pollText += "\n_Respondé con el número de tu opción_";
          await whatsappProvider.sendMessage(whatsappId, groupJid, pollText);
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Error al crear encuesta.");
        }
        break;
      }

      case "warn": {
        if (senderClean !== config.adminNumber) return;
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Usa: /warn <jid>");
          return;
        }
        try {
          const wbot = getWbot(whatsappId);
          await humanDelay();
          await wbot.sendMessage(config.groupJid, {
            text: `⚠️ @${args.split("@")[0]}, has recibido una advertencia. Por favor respeta las reglas del grupo.`,
            mentions: [args]
          });
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, groupJid, "❌ Error al enviar advertencia.");
        }
        break;
      }

      default: {
        const noReconocido = variaRespuesta([
          "🤖 No entendí ese comando. Usa @bot ayuda para ver los disponibles.",
          "🤖 Ese comando no existe. Intentá con @bot ayuda.",
          "🤖 No reconozco ese comando. Escribí @bot ayuda para la lista."
        ]);
        await humanDelay();
        await whatsappProvider.sendMessage(whatsappId, groupJid, noReconocido);
        break;
      }
    }
  } catch (err) {
    logger.error({ info: "BotCajero - Group command error", error: (err as Error).message });
  }
};

export { handleGroupCommand };
