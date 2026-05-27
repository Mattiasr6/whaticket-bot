import AppError from "../../errors/AppError";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroSpamRule from "../../models/BotCajeroSpamRule";
import { getRedisClient } from "../../libs/redisStore";
import { cacheKey } from "./GetConfigService";

const DeleteSpamRuleService = async (ruleId: number): Promise<void> => {
  const rule = await BotCajeroSpamRule.findByPk(ruleId);

  if (!rule) {
    throw new AppError("Spam rule not found");
  }

  const configId = rule.botCajeroConfigId;

  await rule.destroy();

  // Invalidate cache
  const config = await BotCajeroConfig.findByPk(configId);
  if (config) {
    const client = getRedisClient();
    if (client) {
      try {
        await client.del(cacheKey(config.whatsappId));
      } catch {
        // Non-critical
      }
    }
  }
};

export default DeleteSpamRuleService;
