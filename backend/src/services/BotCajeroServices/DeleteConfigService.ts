import AppError from "../../errors/AppError";
import BotCajeroConfig from "../../models/BotCajeroConfig";

const DeleteConfigService = async (whatsappId: number): Promise<void> => {
  const config = await BotCajeroConfig.findOne({ where: { whatsappId } });

  if (!config) {
    throw new AppError(
      "BotCajero config not found for this WhatsApp connection"
    );
  }

  await config.destroy();
};

export default DeleteConfigService;
