import FlowBot from "../../models/FlowBot";
import AppError from "../../errors/AppError";

const DeleteFlowBotService = async (id: number): Promise<void> => {
  const flowBot = await FlowBot.findByPk(id);
  if (!flowBot) throw new AppError("FlowBot not found");
  await flowBot.destroy();
};

export default DeleteFlowBotService;
