import FlowBot from "../../models/FlowBot";
import AppError from "../../errors/AppError";

const UpdateFlowBotService = async (
  id: number,
  data: Partial<FlowBot>
): Promise<FlowBot> => {
  const flowBot = await FlowBot.findByPk(id);
  if (!flowBot) throw new AppError("FlowBot not found");
  await flowBot.update(data);
  return flowBot;
};

export default UpdateFlowBotService;
