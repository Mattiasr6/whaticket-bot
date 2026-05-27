import BotCajeroLog from "../../models/BotCajeroLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { getRedisClient } from "../../libs/redisStore";
import { logger } from "../../utils/logger";
import BotCajeroConfig from "../../models/BotCajeroConfig";

const ICEBREAKERS = [
  "🤔 ¿Alguien tiene dudas sobre las apuestas de hoy?",
  "⚡ Recuerden que pueden consultar horarios y cuotas con solo preguntar.",
  "💬 ¿Todo bien por aquí? Si necesitan algo, pregunten sin miedo.",
  "📢 Recuerden las reglas del grupo: respeto ante todo.",
  "🎯 No olviden que tenemos promociones especiales. Pregunten por privado."
];

const checkInactivity = async (
  whatsappId: number,
  groupJid: string
): Promise<void> => {
  try {
    const config = await BotCajeroConfig.findOne({
      where: { whatsappId, groupJid }
    });

    if (!config) return;
    if (!config.autoReplyEnabled) return;

    const redis = getRedisClient();
    if (!redis) return;

    const lastMsgKey = `botcajero:lastmsg:${whatsappId}:${groupJid}`;
    const lastIcebreakerKey = `botcajero:lasticebreaker:${whatsappId}:${groupJid}`;

    const lastMsgTimestamp = await redis.get(lastMsgKey);
    if (!lastMsgTimestamp) return; // No data yet

    const now = Date.now();
    const hoursSinceLastMsg = (now - parseInt(lastMsgTimestamp, 10)) / 3600000;

    if (hoursSinceLastMsg < config.inactivityHours) return;

    const lastIcebreakerTimestamp = await redis.get(lastIcebreakerKey);
    const hoursSinceIcebreaker = lastIcebreakerTimestamp
      ? (now - parseInt(lastIcebreakerTimestamp, 10)) / 3600000
      : Infinity;

    if (
      lastIcebreakerTimestamp &&
      hoursSinceIcebreaker < config.inactivityHours
    )
      return;

    // Send random icebreaker
    const randomMsg =
      ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];
    await whatsappProvider.sendMessage(whatsappId, groupJid, randomMsg);

    // Save icebreaker timestamp
    await redis.set(lastIcebreakerKey, now.toString());

    // Create log
    await BotCajeroLog.create({
      botCajeroConfigId: config.id,
      eventType: "inactivity_reminder",
      detail: `Rompehielo enviado tras ${Math.round(
        hoursSinceLastMsg
      )}h de inactividad`
    });
  } catch (err) {
    logger.error({
      info: "BotCajero - Inactivity reminder error",
      error: (err as Error).message
    });
  }
};

export { checkInactivity };
