import ScheduledMessage from "../../models/ScheduledMessage";
import AppError from "../../errors/AppError";

const ShowScheduledMessageService = async (id: number) => {
  const record = await ScheduledMessage.findByPk(id);
  if (!record) {
    throw new AppError("Scheduled message not found");
  }
  return record;
};

export default ShowScheduledMessageService;
