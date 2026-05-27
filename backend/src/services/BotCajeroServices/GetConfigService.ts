import { getRedisClient } from "../../libs/redisStore";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroFAQ from "../../models/BotCajeroFAQ";
import BotCajeroSpamRule from "../../models/BotCajeroSpamRule";
import BotCajeroSticker from "../../models/BotCajeroSticker";

const CACHE_TTL = 60; // 60 seconds
const CACHE_PREFIX = "botcajero:config";

const cacheKey = (whatsappId: number): string =>
  `${CACHE_PREFIX}:${whatsappId}`;

const GetConfigService = async (
  whatsappId: number
): Promise<BotCajeroConfig> => {
  // Try Redis cache first
  const client = getRedisClient();
  if (client) {
    try {
      const cached = await client.get(cacheKey(whatsappId));
      if (cached) {
        const parsed = JSON.parse(cached);
        // Rebuild BotCajeroConfig instances with includes
        const config = BotCajeroConfig.build(parsed, {
          include: [
            { model: BotCajeroFAQ },
            { model: BotCajeroSpamRule },
            { model: BotCajeroSticker }
          ]
        });
        config.id = parsed.id;
        return config;
      }
    } catch {
      // Cache miss or parse error, continue to DB
    }
  }

  // Cache miss — query DB with includes
  let config = await BotCajeroConfig.findOne({
    where: { whatsappId },
    include: [
      { model: BotCajeroFAQ },
      { model: BotCajeroSpamRule },
      { model: BotCajeroSticker }
    ]
  });

  if (!config) {
    // First-time creation (do NOT cache)
    config = await BotCajeroConfig.create({
      whatsappId,
      groupJid: "",
      groupName: null,
      adminNumber: "",
      welcomeEnabled: true,
      farewellEnabled: true,
      autoReplyEnabled: true,
      antiSpamEnabled: true,
      quietModeEnabled: false,
      quietModeStart: "23:00",
      quietModeEnd: "08:00",
      inactivityHours: 24,
      welcomeMessage: null,
      farewellMessage: null,
      rules: null
    });

    config = (await BotCajeroConfig.findByPk(config.id, {
      include: [
        { model: BotCajeroFAQ },
        { model: BotCajeroSpamRule },
        { model: BotCajeroSticker }
      ]
    })) as BotCajeroConfig;

    return config;
  }

  // Store in cache (only for existing configs, not first-time creates)
  if (client) {
    try {
      const plain = config.toJSON();
      await client.setex(
        cacheKey(whatsappId),
        CACHE_TTL,
        JSON.stringify(plain)
      );
    } catch {
      // Cache write failure is non-critical
    }
  }

  return config;
};

export { cacheKey, CACHE_PREFIX };
export default GetConfigService;
