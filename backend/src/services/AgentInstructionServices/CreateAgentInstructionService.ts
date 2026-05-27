import AgentInstruction from "../../models/AgentInstruction";

interface Request {
  whatsappId: number;
  instruction: string;
  priority?: number;
}

const CreateAgentInstructionService = async (data: Request) => {
  const instruction = await AgentInstruction.create(data);
  return instruction;
};

export default CreateAgentInstructionService;
