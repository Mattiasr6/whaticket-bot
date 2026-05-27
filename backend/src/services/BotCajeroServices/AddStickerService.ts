import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroSticker from "../../models/BotCajeroSticker";
import { getRedisClient } from "../../libs/redisStore";
import { cacheKey } from "./GetConfigService";

interface AddStickerData {
  mediaPath: string;
  mediaName?: string;
}

const AddStickerService = async (
  botCajeroConfigId: number,
  data: AddStickerData
): Promise<BotCajeroSticker> => {
  const sticker = await BotCajeroSticker.create({
    botCajeroConfigId,
    mediaPath: data.mediaPath,
    mediaName: data.mediaName || null
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

  return sticker;
};

export default AddStickerService;
