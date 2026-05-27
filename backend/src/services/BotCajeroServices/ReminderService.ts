import { Op } from "sequelize";
import BotCajeroReminder from "../../models/BotCajeroReminder";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { logger } from "../../utils/logger";

const processPendingReminders = async (): Promise<void> => {
  try {
    const now = new Date();
    const pending = await BotCajeroReminder.findAll({
      where: {
        status: "pending",
        scheduledAt: { [Op.lte]: now }
      }
    });

    for (const reminder of pending) {
      try {
        await whatsappProvider.sendMessage(
          reminder.whatsappId,
          reminder.groupJid,
          `⏰ *Recordatorio:*\n\n${reminder.message}`
        );

        await reminder.update({
          status: "sent",
          sentAt: now
        });

        logger.info({
          info: "BotCajero - Reminder sent",
          reminderId: reminder.id,
          whatsappId: reminder.whatsappId
        });
      } catch (err) {
        logger.error({
          info: "BotCajero - Reminder send error",
          reminderId: reminder.id,
          error: (err as Error).message
        });
      }
    }
  } catch (err) {
    logger.error({
      info: "BotCajero - Reminder processing error",
      error: (err as Error).message
    });
  }
};

export { processPendingReminders };
