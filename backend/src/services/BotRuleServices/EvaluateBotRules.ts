import BotRule from "../../models/BotRule";
import { whatsappProvider } from "../../providers/WhatsApp";
import { logger } from "../../utils/logger";

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

      case "regex":
        try {
          const regex = new RegExp(lowerKw, "i");
          if (regex.test(lowerBody)) return true;
        } catch {
          continue;
        }
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

const EvaluateBotRules = async (
  whatsappId: number,
  messageBody: string,
  isGroup: boolean,
  groupJid?: string
): Promise<void> => {
  if (!messageBody) return;

  const rules = await BotRule.findAll({
    where: { whatsappId, enabled: true },
    order: [["priority", "ASC"]]
  });

  for (const rule of rules) {
    if (rule.scope === "group" && !isGroup) continue;
    if (rule.scope === "chat" && isGroup) continue;
    if (rule.groupJid && rule.groupJid !== groupJid) continue;

    const keywordList = rule.keywords
      .split("\n")
      .map(k => k.trim())
      .filter(Boolean);

    if (keywordList.length === 0) continue;

    if (!keywordsMatch(messageBody, keywordList, rule.matchType)) continue;

    const to = groupJid || "";

    try {
      if (rule.mediaPath) {
        const media = {
          path: rule.mediaPath,
          filename: rule.mediaName || "media",
          mimetype: "image/png"
        };
        await whatsappProvider.sendMedia(
          whatsappId,
          to,
          media,
          { caption: rule.response || "" }
        );
      } else if (rule.response) {
        await whatsappProvider.sendMessage(
          whatsappId,
          to,
          rule.response
        );
      }

      logger.info({
        info: "Bot rule matched and response sent",
        ruleId: rule.id,
        ruleName: rule.name,
        whatsappId,
        to
      });

      return;
    } catch (err: any) {
      logger.error({
        info: "Bot rule execution failed",
        ruleId: rule.id,
        ruleName: rule.name,
        error: err.message
      });
    }
  }
};

export default EvaluateBotRules;
