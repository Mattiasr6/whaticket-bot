import AppError from "../../errors/AppError";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import { getRedisClient } from "../../libs/redisStore";
import { cacheKey } from "./GetConfigService";

interface UpdateConfigData {
  groupJid?: string;
  groupName?: string;
  adminNumber?: string;
  welcomeEnabled?: boolean;
  farewellEnabled?: boolean;
  autoReplyEnabled?: boolean;
  antiSpamEnabled?: boolean;
  quietModeEnabled?: boolean;
  quietModeStart?: string;
  quietModeEnd?: string;
  inactivityHours?: number;
  welcomeMessage?: string;
  farewellMessage?: string;
  rules?: string;
  businessHours?: string;
  businessHoursEnabled?: boolean;
}

const UpdateConfigService = async (
  whatsappId: number,
  data: UpdateConfigData
): Promise<BotCajeroConfig> => {
  const config = await BotCajeroConfig.findOne({ where: { whatsappId } });

  if (!config) {
    throw new AppError(
      "BotCajero config not found for this WhatsApp connection"
    );
  }

  await config.update(data);

  // Invalidate cache
  const client = getRedisClient();
  if (client) {
    try {
      await client.del(cacheKey(whatsappId));
    } catch {
      // Non-critical
    }
  }

  return config.reload();
};

export default UpdateConfigService;
