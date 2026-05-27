import AppError from "../../errors/AppError";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroSticker from "../../models/BotCajeroSticker";
import { getRedisClient } from "../../libs/redisStore";
import { cacheKey } from "./GetConfigService";

const DeleteStickerService = async (stickerId: number): Promise<void> => {
  const sticker = await BotCajeroSticker.findByPk(stickerId);

  if (!sticker) {
    throw new AppError("Sticker not found");
  }

  const configId = sticker.botCajeroConfigId;

  await sticker.destroy();

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

export default DeleteStickerService;
