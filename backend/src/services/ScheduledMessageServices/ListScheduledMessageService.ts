import ScheduledMessage from "../../models/ScheduledMessage";

interface Request {
  whatsappId?: number;
}

const ListScheduledMessageService = async (params?: Request) => {
  const filter = params?.whatsappId
    ? { whatsappId: params.whatsappId }
    : undefined;
  const messages = await ScheduledMessage.findAll({
    where: filter,
    order: [["createdAt", "DESC"]]
  });
  return messages;
};

export default ListScheduledMessageService;
