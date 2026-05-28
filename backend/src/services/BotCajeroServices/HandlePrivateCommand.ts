import { Op } from "sequelize";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroLog from "../../models/BotCajeroLog";
import BotCajeroReminder from "../../models/BotCajeroReminder";
import BotCajeroPrediction from "../../models/BotCajeroPrediction";
import BotCajeroSticker from "../../models/BotCajeroSticker";
import {
  getTodayFixtures,
  formatFixturesByLeague,
  searchFixtures
} from "./FootballApiService";
import {
  createPrediction,
  listActivePredictions,
  cancelPrediction,
  formatPredictionType
} from "./PredictionService";
import { getRedisClient } from "../../libs/redisStore";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { getWbot } from "../../providers/WhatsApp/Implementations/whaileys";
import { logger } from "../../utils/logger";
import { humanDelay } from "./HumanDelay";
import * as path from "path";
import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";

const normalizeNumber = (jid: string): string => {
  return jid.replace(/[^0-9]/g, "");
};

const handlePrivateCommand = async (
  whatsappId: number,
  fromNumber: string,
  messageBody: string,
  mediaPayload?: { filename: string; mimetype: string; data: string }
): Promise<void> => {
  try {
    const plainNumber = normalizeNumber(fromNumber);

    // 🔒 HARDCODED LOCK: solo responde a este admin
    const HARD_CODED_ADMIN = "59178170459";
    if (plainNumber !== HARD_CODED_ADMIN) return;

    const config = await BotCajeroConfig.findOne({ where: { whatsappId } });

    if (!config) return;

    // Verify sender is admin
    if (plainNumber !== config.adminNumber) return;

    // ─── Detectar sticker enviado por admin y guardar como sticker de bienvenida ───
    if (mediaPayload && mediaPayload.mimetype === "image/webp") {
      try {
        const stickerDir = path.resolve(__dirname, "..", "..", "..", "public", "stickers");
        if (!existsSync(stickerDir)) {
          mkdirSync(stickerDir, { recursive: true });
        }

        const fileName = `welcome_${whatsappId}_${Date.now()}.webp`;
        const filePath = path.join(stickerDir, fileName);
        const buffer = Buffer.from(mediaPayload.data, "base64");
        await writeFile(filePath, buffer);

        await BotCajeroSticker.create({
          botCajeroConfigId: config.id,
          mediaPath: filePath,
          mediaName: "Sticker de bienvenida"
        });

        await whatsappProvider.sendMessage(
          whatsappId,
          fromNumber,
          "✅ Sticker guardado como sticker de bienvenida. Ahora se usará en todas las bienvenidas."
        );

        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "sticker",
          detail: "Sticker de bienvenida actualizado por admin"
        });

        return; // Salir después de procesar el sticker
      } catch (stickerErr) {
        logger.error({
          info: "BotCajero - Error saving welcome sticker",
          error: (stickerErr as Error).message
        });
      }
    }

    const command = messageBody.split(" ")[0].toLowerCase();
    const args = messageBody.substring(command.length).trim();

    switch (command) {
      case "/promo": {
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Usa: /promo <texto de la promo>"
          );
          return;
        }

        // Send promo to group
        await humanDelay();
        await whatsappProvider.sendMessage(
          whatsappId,
          config.groupJid,
          `📢 PROMO DEL DÍA:\n\n${args}`
        );

        // Confirm to admin
        await humanDelay();
        await whatsappProvider.sendMessage(
          whatsappId,
          fromNumber,
          `✅ Promo enviada al grupo "${config.groupName || config.groupJid}".`
        );

        // Create log
        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "promo",
          detail: `Promo enviada al grupo: "${args.substring(0, 200)}"`
        });

        break;
      }

      case "/sticker": {
        if (!mediaPayload || !mediaPayload.mimetype.startsWith("image/")) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Responde a una imagen con /sticker para crearla."
          );
          return;
        }

        // Validate image size (5MB max)
        const imageBytes = Buffer.byteLength(mediaPayload.data, "base64");
        const maxBytes = 5 * 1024 * 1024; // 5MB
        if (imageBytes > maxBytes) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ La imagen es muy pesada. Máximo 5MB."
          );
          return;
        }

        try {
          const wbot = getWbot(whatsappId);
          const buffer = Buffer.from(mediaPayload.data, "base64");
          const jid = fromNumber.includes("@")
            ? fromNumber
            : `${fromNumber}@s.whatsapp.net`;

          await wbot.sendMessage(jid, {
            sticker: buffer,
            mimetype: mediaPayload.mimetype
          });
        } catch (stickerErr) {
          logger.error({
            info: "BotCajero - Sticker creation error",
            error: (stickerErr as Error).message
          });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Error al crear el sticker. Intenta con otra imagen."
          );
          return;
        }

        // Create log
        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "sticker",
          detail: "Sticker creado desde imagen enviada por admin"
        });

        break;
      }

      case "/say": {
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Debes incluir un mensaje. Ej: /say Recuerden que mañana cerramos."
          );
          return;
        }
        // Send clean text to group (no prefix)
        await humanDelay();
        await whatsappProvider.sendMessage(whatsappId, config.groupJid, args);
        // Confirm to admin
        await humanDelay();
        await whatsappProvider.sendMessage(
          whatsappId,
          fromNumber,
          "✅ Mensaje enviado al grupo."
        );
        // Create log
        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "say",
          detail: `Mensaje enviado al grupo: "${args.substring(0, 200)}"`
        });
        break;
      }

      case "/link": {
        try {
          const wbot = getWbot(whatsappId);
          const inviteCode = await wbot.groupInviteCode(config.groupJid);
          const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            `🔗 Link de invitación:\n${inviteLink}\n\n⚠️ Comparte solo con personas de confianza.`
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "link",
            detail: "Link de invitación solicitado por admin"
          });
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ El bot necesita ser administrador del grupo para obtener el link."
          );
        }
        break;
      }

      case "/ban": {
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Debes especificar el JID del usuario. Ej: /ban 59171234567@c.us"
          );
          return;
        }
        const targetJid = args.trim();
        // Auto-ban check
        if (normalizeNumber(targetJid) === plainNumber) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ No puedes expulsarte a ti mismo."
          );
          return;
        }
        // Bot-ban check
        try {
          const wbot = getWbot(whatsappId);
          const botJid = normalizeNumber(wbot.user?.id || "");
          const targetClean = normalizeNumber(targetJid);
          if (targetClean === botJid) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ No puedes expulsar al bot."
            );
            return;
          }
          await wbot.groupParticipantsUpdate(
            config.groupJid,
            [targetJid],
            "remove"
          );
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            `✅ Usuario ${targetJid} expulsado del grupo.`
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "ban",
            detail: `Usuario ${targetJid} expulsado del grupo por admin`
          });
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ No se pudo expulsar al usuario. El bot necesita ser administrador del grupo."
          );
        }
        break;
      }

      case "/warn": {
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Debes especificar el JID del usuario. Ej: /warn 59171234567@c.us"
          );
          return;
        }
        const targetJid = args.trim();
        const targetClean = normalizeNumber(targetJid);
        // Auto-warn check
        if (targetClean === plainNumber) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ No puedes advertirte a ti mismo."
          );
          return;
        }
        // Bot-warn check
        try {
          const wbot = getWbot(whatsappId);
          const botJid = normalizeNumber(wbot.user?.id || "");
          if (targetClean === botJid) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ No puedes advertir al bot."
            );
            return;
          }
        } catch {
          // If getting wbot fails, continue anyway
        }
        // Send public warning in the group
        try {
          const wbotWarn = getWbot(whatsappId);
          const warnJid = targetJid.includes("@")
            ? targetJid
            : `${targetJid}@s.whatsapp.net`;
          await wbotWarn.sendMessage(config.groupJid, {
            text: `⚠️ @${warnJid.split("@")[0]}, has recibido una advertencia. Por favor respeta las reglas del grupo.`,
            mentions: [warnJid]
          });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            `✅ Advertencia enviada a ${targetJid}.`
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "warn",
            detail: `Advertencia pública a ${targetJid} por admin`
          });
        } catch {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ No se pudo enviar la advertencia. Verifica que el JID sea válido."
          );
        }
        break;
      }

      case "/atencion": {
        if (args === "on") {
          await config.update({ autoReplyEnabled: true });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "✅ Respuestas automáticas activadas."
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "quiet_mode",
            detail: "Atención activada por admin"
          });
        } else if (args === "off") {
          await config.update({ autoReplyEnabled: false });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "⛔ Respuestas automáticas desactivadas."
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "quiet_mode",
            detail: "Atención desactivada por admin"
          });
        } else {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Usa: /atencion on | /atencion off"
          );
        }
        break;
      }

      case "/bienvenida": {
        if (args === "on") {
          await config.update({ welcomeEnabled: true });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "✅ Bienvenidas activadas."
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "welcome",
            detail: "Bienvenida activada por admin"
          });
        } else if (args === "off") {
          await config.update({ welcomeEnabled: false });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "⛔ Bienvenidas desactivadas."
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "welcome",
            detail: "Bienvenida desactivada por admin"
          });
        } else {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Usa: /bienvenida on | /bienvenida off"
          );
        }
        break;
      }

      case "/horario": {
        if (args === "on") {
          await config.update({ businessHoursEnabled: true });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "✅ Horarios activados. Los miembros pueden consultarlos con @bot horarios."
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "config_update",
            detail: "Horarios activados por admin"
          });
        } else if (args === "off") {
          await config.update({ businessHoursEnabled: false });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "⛔ Horarios desactivados."
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "config_update",
            detail: "Horarios desactivados por admin"
          });
        } else {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Usa: /horario on | /horario off"
          );
        }
        break;
      }

      case "/reglas": {
        if (config.rules && config.rules.trim()) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            `📜 Reglas de ${config.groupName || config.groupJid}:\n\n${
              config.rules
            }`
          );
        } else {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "📜 No hay reglas configuradas todavía."
          );
        }
        break;
      }

      case "/help": {
        const helpText = [
          "🤖 *Comandos del Bot Cajero*",
          "",
          "• `/promo <texto>` — Enviar promo al grupo",
          "• `/sticker` — Convertir imagen a sticker (responde a una imagen)",
          "• `/atencion on|off` — Activar/desactivar respuestas automáticas",
          "• `/bienvenida on|off` — Activar/desactivar bienvenidas",
          "• `/reglas` — Ver reglas del grupo",
          "• `/export` — Exportar configuración como JSON",
          "• `/help` — Mostrar esta ayuda"
        ].join("\n");

        await humanDelay();
        await whatsappProvider.sendMessage(whatsappId, fromNumber, helpText);
        break;
      }

      case "/export": {
        try {
          const ConfigModel = require("../../models/BotCajeroConfig").default;
          const FAQModel = require("../../models/BotCajeroFAQ").default;
          const SpamRuleModel = require("../../models/BotCajeroSpamRule").default;
          const StickerModel = require("../../models/BotCajeroSticker").default;
          const fullConfig = await ConfigModel.findByPk(config.id, {
            include: [
              { model: FAQModel },
              { model: SpamRuleModel },
              { model: StickerModel }
            ]
          });
          if (!fullConfig) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ Error al obtener la configuración."
            );
            return;
          }
          const jsonData = JSON.stringify(fullConfig.toJSON(), null, 2);
          const buffer = Buffer.from(jsonData, "utf-8");
          const wbot = getWbot(whatsappId);
          const jid = fromNumber.includes("@")
            ? fromNumber
            : `${fromNumber}@s.whatsapp.net`;
          await wbot.sendMessage(jid, {
            document: buffer,
            mimetype: "application/json",
            fileName: `botcajero-config-${whatsappId}.json`,
            caption: "📦 Exportación de configuración del BotCajero"
          });
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "export",
            detail: "Configuración exportada por admin"
          });
        } catch (err) {
          logger.error({
            info: "BotCajero - Export error",
            error: (err as Error).message
          });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Error al exportar la configuración."
          );
        }
        break;
      }

      case "/stats": {
        try {
          const wbot = getWbot(whatsappId);
          // 1. Total miembros del grupo
          const groupMeta = await wbot.groupMetadata(config.groupJid);
          const totalMembers = groupMeta.participants.length;

          // 2. Mensajes hoy (N/A - feature removed)
          const todayMessages = "N/A";
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          // 3. Nuevos miembros esta semana
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const newMembers = await BotCajeroLog.count({
            where: {
              botCajeroConfigId: config.id,
              eventType: "welcome",
              createdAt: { [Op.gte]: weekAgo }
            }
          });

          // 4. FAQs respondidas
          const faqTotal = await BotCajeroLog.count({
            where: {
              botCajeroConfigId: config.id,
              eventType: "faq"
            }
          });

          // 5. Spam bloqueado hoy
          const spamToday = await BotCajeroLog.count({
            where: {
              botCajeroConfigId: config.id,
              eventType: "spam",
              createdAt: { [Op.gte]: todayStart }
            }
          });

          // Armar respuesta
          let text = `📊 *Estadísticas del grupo*\n\n`;
          text += `👥 Miembros: ${totalMembers}\n`;
          text += `💬 Mensajes hoy: ${todayMessages}\n`;
          text += `🆕 Nuevos esta semana: ${newMembers}\n`;
          text += `❓ FAQs respondidas: ${faqTotal}\n`;
          text += `🛡️ Spam bloqueado hoy: ${spamToday}\n`;

          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, fromNumber, text);

          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "stats",
            detail: "Estadísticas solicitadas por admin"
          });
        } catch (err) {
          logger.error({
            info: "BotCajero - Stats error",
            error: (err as Error).message
          });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Error al obtener estadísticas."
          );
        }
        break;
      }

      case "/sorteo": {
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Debes especificar un premio. Ej: /sorteo Camiseta del club"
          );
          return;
        }
        try {
          const wbot = getWbot(whatsappId);
          const groupMeta = await wbot.groupMetadata(config.groupJid);
          const participants = groupMeta.participants || [];

          // Filtrar solo miembros (excluir al bot)
          const botJid = (wbot.user?.id || "").replace(/:[0-9]+/, "");
          const members = participants.filter(
            (p: { id: string }) => (p.id || "").replace(/:[0-9]+/, "") !== botJid
          );

          if (members.length === 0) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ No hay miembros en el grupo para participar en el sorteo."
            );
            return;
          }

          // Elegir ganador aleatorio
          const winner = members[Math.floor(Math.random() * members.length)];
          const winnerJid = winner.id;

          // Anunciar en el grupo con mención
          const wbotSend = getWbot(whatsappId);
          await wbotSend.sendMessage(config.groupJid, {
            text: `🎉 *SORTEO*\n\nPremio: ${args}\nGanador: @${winnerJid.split("@")[0]}\n\n¡Felicidades! 🎊`,
            mentions: [winnerJid]
          });

          // Confirmar al admin
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            `✅ Sorteo realizado. Ganador: ${winnerJid}`
          );

          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "sorteo",
            detail: `Sorteo: "${args.substring(0, 100)}" → Ganador: ${winnerJid}`
          });
        } catch (err) {
          logger.error({
            info: "BotCajero - Sorteo error",
            error: (err as Error).message
          });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Error al realizar el sorteo. El bot necesita ser administrador del grupo."
          );
        }
        break;
      }

      case "/encuesta": {
        if (!args) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Usa: /encuesta ¿Qué partido quieren? | River vs Boca | Nacional vs Peñarol"
          );
          return;
        }
        // Parse: first "|" separates question from options
        const pipeIndex = args.indexOf("|");
        if (pipeIndex === -1) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Debes incluir al menos 2 opciones separadas por |. Ej: /encuesta ¿Qué partido? | Op1 | Op2"
          );
          return;
        }
        const question = args.substring(0, pipeIndex).trim();
        const optionsPart = args.substring(pipeIndex + 1).trim();
        if (!question) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ La pregunta no puede estar vacía."
          );
          return;
        }
        const options = optionsPart
          .split("|")
          .map((o: string) => o.trim())
          .filter(Boolean);
        if (options.length < 2) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Debes incluir al menos 2 opciones. Ej: /encuesta ¿Qué partido? | Op1 | Op2"
          );
          return;
        }
        if (options.length > 5) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Máximo 5 opciones permitidas."
          );
          return;
        }
        try {
          const wbot = getWbot(whatsappId);
          const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
          let pollText = `📊 *${question}*\n\n`;
          options.forEach((opt: string, i: number) => {
            const idx = emojis[i] || String(i+1) + ".";
            pollText += `${idx}  ${opt}\n`;
          });
          pollText += "\n_Respondé con el número de tu opción_";
          await whatsappProvider.sendMessage(whatsappId, config.groupJid, pollText);
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            `✅ Encuesta creada en el grupo "${config.groupName || config.groupJid}".`
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "encuesta",
            detail: `Encuesta: "${question.substring(0, 100)}" con ${options.length} opciones`
          });
        } catch (err) {
          logger.error({
            info: "BotCajero - Encuesta error",
            error: (err as Error).message
          });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Error al crear la encuesta. El bot necesita ser administrador del grupo."
          );
        }
        break;
      }

      case "/mute": {
        const parts = args.split(/\s+/);
        const targetJid = parts[0] || "";
        const hours = parseInt(parts[1] || "0", 10);
        if (!targetJid || !hours) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Usa: /mute <jid> <horas>. Ej: /mute 59171234567@c.us 24"
          );
          return;
        }
        if (hours < 1 || hours > 720) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Las horas deben estar entre 1 y 720 (30 días)."
          );
          return;
        }
        const targetClean = normalizeNumber(targetJid);
        if (targetClean === plainNumber) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ No puedes silenciarte a ti mismo."
          );
          return;
        }
        try {
          const redis = getRedisClient();
          if (!redis) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ Redis no está disponible."
            );
            return;
          }
          const muteKey = `botcajero:muted:${whatsappId}:${targetClean}`;
          await redis.setex(muteKey, hours * 3600, "1");
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            `✅ Usuario ${targetJid} silenciado por ${hours} horas.`
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "mute",
            detail: `Usuario ${targetJid} silenciado por ${hours} horas`
          });
        } catch (err) {
          logger.error({
            info: "BotCajero - Mute error",
            error: (err as Error).message
          });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Error al silenciar usuario."
          );
        }
        break;
      }

      case "/recordar": {
        // Subcommands: list, cancel
        if (args === "list") {
          const reminders = await BotCajeroReminder.findAll({
            where: { botCajeroConfigId: config.id, status: "pending" },
            order: [["scheduledAt", "ASC"]]
          });
          if (reminders.length === 0) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "📅 No hay recordatorios programados."
            );
            return;
          }
          let text = "📅 *Recordatorios programados*\n\n";
          reminders.forEach((r, i) => {
            text += `${i + 1}. ID:${r.id} — ${r.scheduledAt.toLocaleDateString("es")} ${r.scheduledAt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}\n   "${r.message.substring(0, 50)}"\n`;
          });
          text += "\nPara cancelar: /recordar cancel <ID>";
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, fromNumber, text);
          return;
        }

        if (args.startsWith("cancel ")) {
          const id = parseInt(
            args.replace("cancel ", "").trim(),
            10
          );
          if (!id) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ Usa: /recordar cancel <ID>. Ej: /recordar cancel 3"
            );
            return;
          }
          const reminder = await BotCajeroReminder.findOne({
            where: {
              id,
              botCajeroConfigId: config.id,
              status: "pending"
            }
          });
          if (!reminder) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ Recordatorio no encontrado o ya fue enviado."
            );
            return;
          }
          await reminder.update({ status: "cancelled" });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            `✅ Recordatorio #${id} cancelado.`
          );
          return;
        }

        // Parse: /recordar <día> <HH:MM> <mensaje>
        const match = args.match(
          /^(mañana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(\d{1,2}:\d{2})\s+(.+)$/i
        );
        if (!match) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Formato: /recordar <día> <HH:MM> <mensaje>\nEj: /recordar mañana 10:00 Hoy hay clásico\nDías: hoy, mañana, lunes..domingo"
          );
          return;
        }

        const [, dayWord, timeStr, message] = match;
        const [hours, minutes] = timeStr.split(":").map(Number);

        const now = new Date();
        const scheduled = new Date(now);
        scheduled.setHours(hours, minutes, 0, 0);

        const dayMap: Record<string, number> = {
          domingo: 0,
          lunes: 1,
          martes: 2,
          miercoles: 3,
          jueves: 4,
          viernes: 5,
          sabado: 6
        };

        if (dayWord === "hoy") {
          if (scheduled <= now) {
            scheduled.setDate(scheduled.getDate() + 1);
          }
        } else if (dayWord === "mañana") {
          scheduled.setDate(scheduled.getDate() + 1);
        } else {
          const targetDay = dayMap[dayWord];
          const currentDay = now.getDay();
          let daysUntil = targetDay - currentDay;
          if (daysUntil <= 0 || (daysUntil === 0 && scheduled <= now)) {
            daysUntil += 7;
          }
          scheduled.setDate(scheduled.getDate() + daysUntil);
        }

        if (scheduled <= now) {
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ La fecha/hora debe ser en el futuro."
          );
          return;
        }

        const reminder = await BotCajeroReminder.create({
          botCajeroConfigId: config.id,
          whatsappId,
          groupJid: config.groupJid,
          message,
          scheduledAt: scheduled,
          status: "pending"
        });

        await humanDelay();
        await whatsappProvider.sendMessage(
          whatsappId,
          fromNumber,
          `✅ Recordatorio #${reminder.id} programado para ${scheduled.toLocaleDateString("es")} a las ${timeStr}.`
        );

        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "reminder",
          detail: `Recordatorio #${reminder.id} programado: "${message.substring(0, 100)}" para ${scheduled.toISOString()}`
        });
        break;
      }

      case "/partidos": {
        try {
          const { getAllSportsToday, formatAllSports } = await import("./SportsApiService");
          const tz = process.env.TZ || "America/La_Paz";
          const dateLabel = new Intl.DateTimeFormat("es", { timeZone: tz, weekday: "long", day: "numeric", month: "numeric", year: "numeric" }).format(new Date());
          const sportsData = await getAllSportsToday();
          const msg = formatAllSports(sportsData.football, sportsData.basketball, dateLabel, false);
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            msg
          );
          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "football",
            detail: "Partidos consultados por admin"
          });
        } catch (err) {
          logger.error({
            info: "BotCajero - /partidos error",
            error: (err as Error).message
          });
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            "❌ Error al consultar partidos. Verifica la API key."
          );
        }
        break;
      }

      case "/dinamica": {
        if (args === "list") {
          const predictions = await listActivePredictions(config.id);
          if (predictions.length === 0) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "📋 No hay dinámicas activas."
            );
            return;
          }
          let text = "📋 *DINÁMICAS ACTIVAS*\n\n";
          predictions.forEach((p, i) => {
            const time = new Date(p.matchTime).toLocaleString("es", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            });
            text += `${i + 1}. ID:${p.id} — ${p.matchLabel}\n`;
            text += `   📌 ${formatPredictionType(p.predictionType)}\n`;
            text += `   ⏰ ${time} — ${p.entries?.length || 0} participantes\n\n`;
          });
          text +=
            "Para participar en el grupo: @bot predecir <ID> <valor>\nPara cancelar: /dinamica cancel <ID>";
          await humanDelay();
          await whatsappProvider.sendMessage(whatsappId, fromNumber, text);
          return;
        }

        if (args.startsWith("cancel ")) {
          const id = parseInt(
            args.replace("cancel ", "").trim(),
            10
          );
          if (!id) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ Usa: /dinamica cancel <ID>"
            );
            return;
          }
          const ok = await cancelPrediction(id, config.id);
          await humanDelay();
          await whatsappProvider.sendMessage(
            whatsappId,
            fromNumber,
            ok
              ? `✅ Dinámica #${id} cancelada.`
              : "❌ Dinámica no encontrada o ya cerrada."
          );
          return;
        }

        if (args.startsWith("crear ")) {
          const rest = args.slice("crear ".length).trim();
          const spaceIndex = rest.lastIndexOf(" ");
          if (spaceIndex === -1) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ Formato: /dinamica crear <búsqueda> <tipo>\nTipos: score_exacto, goles_totales, primer_gol, esquinas_totales, goles_primer_tiempo"
            );
            return;
          }
          const searchQuery = rest.slice(0, spaceIndex).trim();
          const type = rest.slice(spaceIndex + 1).trim();
          const validTypes = [
            "score_exacto",
            "goles_totales",
            "primer_gol",
            "esquinas_totales",
            "goles_primer_tiempo"
          ];
          if (!validTypes.includes(type)) {
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              `❌ Tipo inválido. Tipos: ${validTypes.join(", ")}`
            );
            return;
          }
          try {
            const fixtures = await searchFixtures(searchQuery);
            if (fixtures.length === 0) {
              await humanDelay();
              await whatsappProvider.sendMessage(
                whatsappId,
                fromNumber,
                `❌ No se encontraron partidos para "${searchQuery}".`
              );
              return;
            }
            const fixture = fixtures[0];
            const fixtureId = fixture.fixture?.id;
            const home = fixture.teams?.home?.name || "?";
            const away = fixture.teams?.away?.name || "?";
            const matchLabel = `${home} vs ${away}`;
            const matchTime = new Date(fixture.fixture?.date || Date.now());
            const pred = await createPrediction(
              config.id,
              fixtureId,
              matchLabel,
              matchTime,
              type
            );
            const timeStr = matchTime.toLocaleString("es", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            });
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              `✅ *Dinámica creada #${pred.id}*\n\n📌 ${formatPredictionType(type)}\n⚽ ${matchLabel}\n⏰ ${timeStr}\n\nLos miembros pueden participar con @bot predecir ${pred.id} <valor>`
            );
            await BotCajeroLog.create({
              botCajeroConfigId: config.id,
              eventType: "prediction",
              detail: `Dinámica #${pred.id} creada: ${matchLabel} - ${type}`
            });
          } catch (err) {
            logger.error({
              info: "BotCajero - Dinamica crear error",
              error: (err as Error).message
            });
            await humanDelay();
            await whatsappProvider.sendMessage(
              whatsappId,
              fromNumber,
              "❌ Error al crear dinámica. Verifica la API key."
            );
          }
          return;
        }

        await humanDelay();
        await whatsappProvider.sendMessage(
          whatsappId,
          fromNumber,
          "❌ Usa: /dinamica crear <búsqueda> <tipo> | /dinamica list | /dinamica cancel <ID>"
        );
        break;
      }

      default:
        // Unknown command, ignore silently
        break;
    }
  } catch (err) {
    logger.error({
      info: "BotCajero - Private command error",
      error: (err as Error).message
    });
  }
};

export { handlePrivateCommand };
