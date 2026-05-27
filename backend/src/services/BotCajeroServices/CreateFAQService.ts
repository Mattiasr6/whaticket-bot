import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroFAQ from "../../models/BotCajeroFAQ";
import { getRedisClient } from "../../libs/redisStore";
import { cacheKey } from "./GetConfigService";

interface CreateFAQData {
  keywords: string;
  response: string;
  matchType?: string;
  enabled?: boolean;
  priority?: number;
}

const CreateFAQService = async (
  botCajeroConfigId: number,
  data: CreateFAQData
): Promise<BotCajeroFAQ> => {
  const faq = await BotCajeroFAQ.create({
    botCajeroConfigId,
    keywords: data.keywords,
    response: data.response,
    matchType: data.matchType || "contains",
    enabled: data.enabled !== undefined ? data.enabled : true,
    priority: data.priority || 0
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

  return faq;
};

export default CreateFAQService;
