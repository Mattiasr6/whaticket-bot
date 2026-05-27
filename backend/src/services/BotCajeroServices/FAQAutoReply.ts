/* eslint-disable no-await-in-loop, no-restricted-syntax */
import BotCajeroLog from "../../models/BotCajeroLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { logger } from "../../utils/logger";
import { isInQuietMode } from "./QuietModeService";
import GetConfigService from "./GetConfigService";

const keywordsMatch = (
  body: string,
  keywordList: string[],
  matchType: string
): boolean => {
  const lowerBody = body.toLowerCase().trim();

  for (const kw of keywordList) {
    const lowerKw = kw.toLowerCase().trim();
    if (!lowerKw) continue;

    switch (matchType) {
      case "exact":
        if (lowerBody === lowerKw) return true;
        break;

      case "all":
        if (!lowerBody.includes(lowerKw)) return false;
        break;

      case "contains":
      default:
        if (lowerBody.includes(lowerKw)) return true;
        break;
    }
  }

  return matchType === "all" && keywordList.length > 0;
};

const handleFAQAutoReply = async (
  whatsappId: number,
  groupJid: string,
  messageBody: string
): Promise<boolean> => {
  try {
    const config = await GetConfigService(whatsappId);

    // Verify this config belongs to the right group
    if (config.groupJid !== groupJid) return false;

    // Check quiet mode
    if (isInQuietMode(config)) {
      await BotCajeroLog.create({
        botCajeroConfigId: config.id,
        eventType: "quiet_mode",
        detail: `FAQ suprimida por modo silencio: "${messageBody.substring(
          0,
          100
        )}"`
      });
      return false;
    }

    // Verify auto-reply is enabled
    if (!config.autoReplyEnabled) return false;

    // Load active FAQs from cached config
    const faqs = (config as any).faqs || [];

    if (faqs.length === 0) return false;

    for (const faq of faqs) {
      const keywordList = faq.keywords
        .split("\n")
        .map((k: string) => k.trim())
        .filter(Boolean);

      if (keywordList.length === 0) continue;

      if (!keywordsMatch(messageBody, keywordList, faq.matchType)) continue;

      // Send response to group
      await whatsappProvider.sendMessage(whatsappId, groupJid, faq.response);

      // Create log
      await BotCajeroLog.create({
        botCajeroConfigId: config.id,
        eventType: "faq",
        detail: `FAQ respondida: "${faq.response.substring(
          0,
          100
        )}" por mensaje: "${messageBody.substring(0, 100)}"`
      });

      return true;
    }

    return false;
  } catch (err) {
    logger.error({
      info: "BotCajero - FAQ auto-reply error",
      error: (err as Error).message
    });
    return false;
  }
};

export { handleFAQAutoReply };
