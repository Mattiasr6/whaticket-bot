/* eslint-disable no-await-in-loop, no-restricted-syntax */
import BotCajeroLog from "../../models/BotCajeroLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { getWbot } from "../../providers/WhatsApp/Implementations/whaileys";
import { logger } from "../../utils/logger";
import GetConfigService from "./GetConfigService";
import { checkSpamAlert } from "./AdminAlertService";

const handleAntiSpam = async (
  whatsappId: number,
  groupJid: string,
  messageBody: string,
  messageId: string,
  senderJid: string,
  senderName: string
): Promise<boolean> => {
  try {
    const config = await GetConfigService(whatsappId);

    // Verify this config belongs to the right group
    if (config.groupJid !== groupJid) return false;
    if (!config.antiSpamEnabled) return false;

    // Load active spam rules from cached config
    const rules = (config as any).spamRules || [];

    if (rules.length === 0) return false;

    const lowerBody = messageBody.toLowerCase();

    for (const rule of rules) {
      if (!lowerBody.includes(rule.pattern.toLowerCase())) continue;

      if (rule.type === "link_block") {
        // Delete message from group
        try {
          const wbot = getWbot(whatsappId);
          await wbot.sendMessage(groupJid, {
            delete: {
              remoteJid: groupJid,
              id: messageId,
              fromMe: false,
              participant: senderJid
            }
          });
        } catch (deleteErr) {
          logger.error({
            info: "BotCajero - Error deleting spam message",
            error: (deleteErr as Error).message
          });
        }

        // Send private warning
        await whatsappProvider.sendMessage(
          whatsappId,
          senderJid,
          "⚠️ Tu mensaje fue eliminado. No compartas enlaces de otros sitios."
        );

        // Create log
        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "spam",
          detail: `Link bloqueado de ${senderName} (${senderJid}): "${messageBody.substring(
            0,
            100
          )}"`
        });

        await checkSpamAlert(whatsappId, config.id).catch(err => {
          logger.error({ info: "BotCajero - Spam alert check error", error: (err as Error).message });
        });

        return true;
      }

      if (rule.type === "profanity") {
        if (rule.action === "warn_public") {
          await whatsappProvider.sendMessage(
            whatsappId,
            groupJid,
            `⚠️ @${senderName}, por favor mantén un lenguaje respetuoso en el grupo.`
          );

          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "spam",
            detail: `Lenguaje inapropiado de ${senderName} (${senderJid}): "${messageBody.substring(
              0,
              100
            )}"`
          });

          await checkSpamAlert(whatsappId, config.id).catch(err => {
            logger.error({ info: "BotCajero - Spam alert check error", error: (err as Error).message });
          });

          return true;
        }

        if (rule.action === "warn_private") {
          await whatsappProvider.sendMessage(
            whatsappId,
            senderJid,
            "⚠️ Por favor mantén un lenguaje respetuoso en el grupo."
          );

          await BotCajeroLog.create({
            botCajeroConfigId: config.id,
            eventType: "spam",
            detail: `Advertencia privada a ${senderName} (${senderJid}) por lenguaje inapropiado`
          });

          await checkSpamAlert(whatsappId, config.id).catch(err => {
            logger.error({ info: "BotCajero - Spam alert check error", error: (err as Error).message });
          });

          return true;
        }
      }
    }

    return false;
  } catch (err) {
    logger.error({
      info: "BotCajero - Anti-spam error",
      error: (err as Error).message
    });
    return false;
  }
};

export { handleAntiSpam };
