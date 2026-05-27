import { Request, Response } from "express";
import ListAgentInstructionService from "../services/AgentInstructionServices/ListAgentInstructionService";
import CreateAgentInstructionService from "../services/AgentInstructionServices/CreateAgentInstructionService";
import UpdateAgentInstructionService from "../services/AgentInstructionServices/UpdateAgentInstructionService";
import DeleteAgentInstructionService from "../services/AgentInstructionServices/DeleteAgentInstructionService";

export const index = async (req: Request, res: Response) => {
  const { whatsappId } = req.query;
  const instructions = await ListAgentInstructionService(
    whatsappId ? Number(whatsappId) : undefined
  );
  return res.json(instructions);
};

export const store = async (req: Request, res: Response) => {
  const { whatsappId, instruction, priority } = req.body;
  const agentInstruction = await CreateAgentInstructionService({
    whatsappId,
    instruction,
    priority
  });
  return res.status(201).json(agentInstruction);
};

export const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const agentInstruction = await UpdateAgentInstructionService(Number(id), req.body);
  return res.json(agentInstruction);
};

export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  await DeleteAgentInstructionService(Number(id));
  return res.status(204).json();
};
