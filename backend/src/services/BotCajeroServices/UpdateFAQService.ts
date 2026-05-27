import AppError from "../../errors/AppError";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroFAQ from "../../models/BotCajeroFAQ";
import { getRedisClient } from "../../libs/redisStore";
import { cacheKey } from "./GetConfigService";

interface UpdateFAQData {
  keywords?: string;
  response?: string;
  matchType?: string;
  enabled?: boolean;
  priority?: number;
}

const UpdateFAQService = async (
  faqId: number,
  data: UpdateFAQData
): Promise<BotCajeroFAQ> => {
  const faq = await BotCajeroFAQ.findByPk(faqId);

  if (!faq) {
    throw new AppError("FAQ not found");
  }

  const configId = faq.botCajeroConfigId;

  await faq.update(data);

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

  return faq.reload();
};

export default UpdateFAQService;
