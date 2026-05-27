import AgentInstruction from "../../models/AgentInstruction";
import AppError from "../../errors/AppError";

const DeleteAgentInstructionService = async (id: number) => {
  const instruction = await AgentInstruction.findByPk(id);
  if (!instruction) throw new AppError("Agent instruction not found");
  await instruction.destroy();
};

export default DeleteAgentInstructionService;
