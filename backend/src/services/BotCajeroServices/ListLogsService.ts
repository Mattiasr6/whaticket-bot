import BotCajeroLog from "../../models/BotCajeroLog";

interface ListLogsParams {
  botCajeroConfigId: number;
  eventType?: string;
}

const ListLogsService = async (
  params: ListLogsParams
): Promise<BotCajeroLog[]> => {
  const where: { botCajeroConfigId: number; eventType?: string } = {
    botCajeroConfigId: params.botCajeroConfigId
  };

  if (params.eventType) {
    where.eventType = params.eventType;
  }

  const logs = await BotCajeroLog.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: 200
  });

  return logs;
};

export default ListLogsService;
