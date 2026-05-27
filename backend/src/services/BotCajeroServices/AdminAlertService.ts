import { Op } from "sequelize";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroLog from "../../models/BotCajeroLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { getRedisClient } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

const checkSpamAlert = async (
  whatsappId: number,
  configId: number
): Promise<void> => {
  try {
    const redis = getRedisClient();
    if (!redis) return;

    const spamAlertKey = `botcajero:alertaspam:${whatsappId}`;
    const alreadyAlerted = await redis.get(spamAlertKey);
    if (alreadyAlerted) return;

    const oneHourAgo = new Date(Date.now() - 3600000);
    const spamCount = await BotCajeroLog.count({
      where: {
        botCajeroConfigId: configId,
        eventType: "spam",
        createdAt: { [Op.gte]: oneHourAgo }
      }
    });

    if (spamCount >= 5) {
      const config = await BotCajeroConfig.findByPk(configId);
      if (!config || !config.adminNumber) return;

      const adminJid = `${config.adminNumber}@s.whatsapp.net`;
      await whatsappProvider.sendMessage(
        whatsappId,
        adminJid,
        `🚨 *ALERTA DE SPAM*\n\nSe detectaron ${spamCount} intentos de spam en la última hora.\n\nRecomendación: Revisa el grupo o activa /atencion off temporalmente.`
      );

      await redis.setex(spamAlertKey, 3600, "1");
      logger.info({
        info: "BotCajero - Spam alert sent",
        whatsappId,
        spamCount
      });
    }
  } catch (err) {
    logger.error({
      info: "BotCajero - Spam alert error",
      error: (err as Error).message
    });
  }
};

const sendDailySummary = async (
  config: BotCajeroConfig
): Promise<void> => {
  try {
    const redis = getRedisClient();
    if (!redis) return;

    const today = new Date().toISOString().split("T")[0];
    const summaryKey = `botcajero:dailysummary:${config.whatsappId}:${today}`;
    const alreadySent = await redis.get(summaryKey);
    if (alreadySent) return;

    const oneDayAgo = new Date(Date.now() - 86400000);
    const configId = config.id;

    const [nuevos, faqs, spam, sorteos, promos] = await Promise.all([
      BotCajeroLog.count({
        where: {
          botCajeroConfigId: configId,
          eventType: "welcome",
          createdAt: { [Op.gte]: oneDayAgo }
        }
      }),
      BotCajeroLog.count({
        where: {
          botCajeroConfigId: configId,
          eventType: "faq",
          createdAt: { [Op.gte]: oneDayAgo }
        }
      }),
      BotCajeroLog.count({
        where: {
          botCajeroConfigId: configId,
          eventType: "spam",
          createdAt: { [Op.gte]: oneDayAgo }
        }
      }),
      BotCajeroLog.count({
        where: {
          botCajeroConfigId: configId,
          eventType: "sorteo",
          createdAt: { [Op.gte]: oneDayAgo }
        }
      }),
      BotCajeroLog.count({
        where: {
          botCajeroConfigId: configId,
          eventType: "promo",
          createdAt: { [Op.gte]: oneDayAgo }
        }
      })
    ]);

    if (!config.adminNumber) return;

    const adminJid = `${config.adminNumber}@s.whatsapp.net`;
    let text = `📊 *RESUMEN DIARIO — ${today}*\n\n`;
    text += `🆕 Nuevos miembros: ${nuevos}\n`;
    text += `❓ FAQs respondidas: ${faqs}\n`;
    text += `🛡️ Spam bloqueado: ${spam}\n`;
    text += `🎉 Sorteos realizados: ${sorteos}\n`;
    text += `📢 Promos enviadas: ${promos}\n`;

    await whatsappProvider.sendMessage(config.whatsappId, adminJid, text);
    await redis.setex(summaryKey, 86400, "1");

    logger.info({
      info: "BotCajero - Daily summary sent",
      whatsappId: config.whatsappId
    });
  } catch (err) {
    logger.error({
      info: "BotCajero - Daily summary error",
      whatsappId: config.whatsappId,
      error: (err as Error).message
    });
  }
};

export { checkSpamAlert, sendDailySummary };
