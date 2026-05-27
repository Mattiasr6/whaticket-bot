import ScheduledMessage from "../../models/ScheduledMessage";
import AppError from "../../errors/AppError";

interface Request {
  id: number;
  whatsappId?: number;
  groupJid?: string;
  groupName?: string;
  messageText?: string;
  mediaPath?: string;
  mediaName?: string;
  intervalMinutes?: number;
  enabled?: boolean;
}

const UpdateScheduledMessageService = async (data: Request) => {
  const record = await ScheduledMessage.findByPk(data.id);
  if (!record) {
    throw new AppError("Scheduled message not found");
  }
  await record.update(data);
  return record;
};

export default UpdateScheduledMessageService;
