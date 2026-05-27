import AppError from "../../errors/AppError";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroFAQ from "../../models/BotCajeroFAQ";
import { getRedisClient } from "../../libs/redisStore";
import { cacheKey } from "./GetConfigService";

const DeleteFAQService = async (faqId: number): Promise<void> => {
  const faq = await BotCajeroFAQ.findByPk(faqId);

  if (!faq) {
    throw new AppError("FAQ not found");
  }

  const configId = faq.botCajeroConfigId;

  await faq.destroy();

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

export default DeleteFAQService;
