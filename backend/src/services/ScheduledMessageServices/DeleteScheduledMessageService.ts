import ScheduledMessage from "../../models/ScheduledMessage";
import AppError from "../../errors/AppError";

const DeleteScheduledMessageService = async (id: number) => {
  const record = await ScheduledMessage.findByPk(id);
  if (!record) {
    throw new AppError("Scheduled message not found");
  }
  await record.destroy();
};

export default DeleteScheduledMessageService;
