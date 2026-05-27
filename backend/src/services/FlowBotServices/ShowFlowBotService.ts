import FlowBot from "../../models/FlowBot";
import AppError from "../../errors/AppError";

const ShowFlowBotService = async (id: number): Promise<FlowBot> => {
  const flowBot = await FlowBot.findByPk(id);
  if (!flowBot) throw new AppError("FlowBot not found");
  return flowBot;
};

export default ShowFlowBotService;
