import FlowBot from "../../models/FlowBot";

interface Request {
  name: string;
  whatsappId: number;
  enabled?: boolean;
  triggerKeywords?: string;
}

const CreateFlowBotService = async (data: Request): Promise<FlowBot> => {
  const flowBot = await FlowBot.create(data);
  return flowBot;
};

export default CreateFlowBotService;
