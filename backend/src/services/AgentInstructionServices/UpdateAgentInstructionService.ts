import AgentInstruction from "../../models/AgentInstruction";
import AppError from "../../errors/AppError";

const UpdateAgentInstructionService = async (id: number, data: Partial<AgentInstruction>) => {
  const instruction = await AgentInstruction.findByPk(id);
  if (!instruction) throw new AppError("Agent instruction not found");
  await instruction.update(data);
  return instruction;
};

export default UpdateAgentInstructionService;
