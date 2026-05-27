import { Sequelize } from "sequelize";
import FlowBot from "../../models/FlowBot";

const ListFlowBotService = async (whatsappId?: number): Promise<FlowBot[]> => {
  const filter = whatsappId ? { whatsappId } : undefined;
  const flowBots = await FlowBot.findAll({
    where: filter,
    attributes: {
      include: [
        [
          Sequelize.literal(
            "(SELECT COUNT(*) FROM FlowNodes WHERE FlowNodes.flowBotId = FlowBot.id)"
          ),
          "nodesCount"
        ]
      ]
    },
    order: [["name", "ASC"]]
  });
  return flowBots;
};

export default ListFlowBotService;
