import ScheduledMessage from "../../models/ScheduledMessage";
import AppError from "../../errors/AppError";

interface Request {
  whatsappId: number;
  groupJid: string;
  groupName: string;
  messageText?: string;
  mediaPath?: string;
  mediaName?: string;
  intervalMinutes: number;
  enabled?: boolean;
}

const CreateScheduledMessageService = async (data: Request) => {
  if (!data.messageText && !data.mediaPath) {
    throw new AppError("messageText or mediaPath is required");
  }
  if (data.intervalMinutes < 1) {
    throw new AppError("intervalMinutes must be >= 1");
  }
  const message = await ScheduledMessage.create(data);
  return message;
};

export default CreateScheduledMessageService;
