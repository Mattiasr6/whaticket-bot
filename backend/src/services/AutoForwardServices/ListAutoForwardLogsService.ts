import AutoForwardLog from "../../models/AutoForwardLog";

const ListAutoForwardLogsService = async (
  autoForwardId: number,
  limit = 50
): Promise<AutoForwardLog[]> => {
  const logs = await AutoForwardLog.findAll({
    where: { autoForwardId },
    order: [["executedAt", "DESC"]],
    limit
  });
  return logs;
};

export default ListAutoForwardLogsService;
