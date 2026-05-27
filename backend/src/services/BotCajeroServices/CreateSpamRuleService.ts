import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroSpamRule from "../../models/BotCajeroSpamRule";
import { getRedisClient } from "../../libs/redisStore";
import { cacheKey } from "./GetConfigService";

interface CreateSpamRuleData {
  type: string;
  pattern: string;
  action: string;
  enabled?: boolean;
}

const CreateSpamRuleService = async (
  botCajeroConfigId: number,
  data: CreateSpamRuleData
): Promise<BotCajeroSpamRule> => {
  const rule = await BotCajeroSpamRule.create({
    botCajeroConfigId,
    type: data.type,
    pattern: data.pattern,
    action: data.action,
    enabled: data.enabled !== undefined ? data.enabled : true
  });

  // Invalidate cache
  const config = await BotCajeroConfig.findByPk(botCajeroConfigId);
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

  return rule;
};

export default CreateSpamRuleService;
