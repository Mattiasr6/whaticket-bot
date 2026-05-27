import AgentInstruction from "../../models/AgentInstruction";

const ListAgentInstructionService = async (whatsappId?: number) => {
  const filter = whatsappId ? { whatsappId } : undefined;
  const instructions = await AgentInstruction.findAll({
    where: filter,
    order: [["priority", "DESC"]]
  });
  return instructions;
};

export default ListAgentInstructionService;
