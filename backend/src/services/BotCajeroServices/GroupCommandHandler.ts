import BotCajeroLog from "../../models/BotCajeroLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { logger } from "../../utils/logger";
import GetConfigService from "./GetConfigService";
import { isInQuietMode } from "./QuietModeService";
import {
  getTodayFixtures,
  formatFixturesByLeague
} from "./FootballApiService";

const BOT_MENTION_PATTERN = /@(botcajero|bot)\b/i;

function extractSenderName(senderJid: string): string {
  return senderJid.split("@")[0] || "Usuario";
}

const handleGroupCommand = async (
  whatsappId: number,
  groupJid: string,
  messageBody: string,
  senderJid: string
): Promise<void> => {
  try {
    // 1. Get config
    const config = await GetConfigService(whatsappId);

    // 2. Verify this config belongs to this group
    if (config.groupJid !== groupJid) return;

    // 3. Check quiet mode
    if (isInQuietMode(config)) return;

    // 4. Parse command: extract text after @bot mention
    const match = messageBody.match(BOT_MENTION_PATTERN);
    if (!match) return;

    const afterMention = messageBody
      .slice(match.index! + match[0].length)
      .trim();
    const command = afterMention.split(/\s+/)[0]?.toLowerCase() || "";

    const senderName = extractSenderName(senderJid);

    // 5. Router
    switch (command) {
      case "reglas": {
        if (config.rules && config.rules.trim()) {
          const text = `🤖 Reglas del grupo:\n📜 ${config.rules}`;
          await whatsappProvider.sendMessage(whatsappId, groupJid, text);
        } else {
          await whatsappProvider.sendMessage(
            whatsappId,
            groupJid,
            "📜 No hay reglas configuradas todavía."
          );
        }

        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "group_command",
          detail: `@${senderName} consultó reglas en el grupo`
        });
        break;
      }

      case "ayuda":
      case "help": {
        const text =
          `🤖 Comandos disponibles en este grupo:\n` +
          `• @bot reglas — Muestra las reglas del grupo\n` +
          `• @bot horarios — Muestra los horarios de atención\n` +
          `• @bot ayuda — Muestra esta ayuda`;
        await whatsappProvider.sendMessage(whatsappId, groupJid, text);

        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "group_command",
          detail: `@${senderName} consultó ayuda en el grupo`
        });
        break;
      }

      case "horarios": {
        if (!config.businessHoursEnabled) {
          await whatsappProvider.sendMessage(
            whatsappId,
            groupJid,
            "🤖 La consulta de horarios está desactivada."
          );
          break;
        }
        if (!config.businessHours || !config.businessHours.trim()) {
          await whatsappProvider.sendMessage(
            whatsappId,
            groupJid,
            "🤖 No hay horarios configurados todavía."
          );
          break;
        }

        try {
          const hours = JSON.parse(config.businessHours);
          const days: Record<string, string> = {
            lunes: "Lunes",
            martes: "Martes",
            miercoles: "Miércoles",
            jueves: "Jueves",
            viernes: "Viernes",
            sabado: "Sábado",
            domingo: "Domingo"
          };
          let text = "🤖 Horarios de atención:\n";
          for (const [key, label] of Object.entries(days)) {
            if (hours[key]) {
              text += `🗓️ ${label}: ${hours[key]}\n`;
            }
          }
          await whatsappProvider.sendMessage(whatsappId, groupJid, text.trim());

          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "business_hours",
            detail: "Horarios consultados vía @bot horarios"
          });
        } catch {
          await whatsappProvider.sendMessage(
            whatsappId,
            groupJid,
            "🤖 Error al cargar horarios. Contacta al administrador."
          );
        }
        break;
      }

      case "partidos": {
        try {
          const fixtures = await getTodayFixtures();
          if (fixtures.length === 0) {
            await whatsappProvider.sendMessage(
              whatsappId,
              groupJid,
              "📋 No hay partidos programados para hoy."
            );
            return;
          }
          const text = `📋 *PARTIDOS DE HOY*\n\n${formatFixturesByLeague(
            fixtures
          )}`;
          await whatsappProvider.sendMessage(whatsappId, groupJid, text);
        } catch (err) {
          logger.error({
            info: "BotCajero - Partidos error",
            error: (err as Error).message
          });
          await whatsappProvider.sendMessage(
            whatsappId,
            groupJid,
            "❌ Error al consultar partidos."
          );
        }
        break;
      }

      default: {
        await whatsappProvider.sendMessage(
          whatsappId,
          groupJid,
          "🤖 Comando no reconocido. Usa @bot ayuda para ver los disponibles."
        );
        break;
      }
    }
  } catch (err) {
    logger.error({
      info: "BotCajero - Group command error",
      error: (err as Error).message
    });
  }
};

export { handleGroupCommand };
