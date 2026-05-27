import { Request, Response } from "express";
import ListFlowBotService from "../services/FlowBotServices/ListFlowBotService";
import ShowFlowBotService from "../services/FlowBotServices/ShowFlowBotService";
import CreateFlowBotService from "../services/FlowBotServices/CreateFlowBotService";
import UpdateFlowBotService from "../services/FlowBotServices/UpdateFlowBotService";
import DeleteFlowBotService from "../services/FlowBotServices/DeleteFlowBotService";
import DuplicateFlowBotService from "../services/FlowBotServices/DuplicateFlowBotService";
import ListFlowNodeService from "../services/FlowBotServices/ListFlowNodeService";
import CreateFlowNodeService from "../services/FlowBotServices/CreateFlowNodeService";
import UpdateFlowNodeService from "../services/FlowBotServices/UpdateFlowNodeService";
import DeleteFlowNodeService from "../services/FlowBotServices/DeleteFlowNodeService";
import ReorderFlowNodeService from "../services/FlowBotServices/ReorderFlowNodeService";
import MoveFlowNodeService from "../services/FlowBotServices/MoveFlowNodeService";
import FlowSession from "../models/FlowSession";
import { FlowBotPreviewHandler } from "../services/FlowBotServices/FlowBotHandler";

// ---- FlowBot CRUD ----

export const list = async (req: Request, res: Response) => {
  const { whatsappId } = req.query;
  const flowBots = await ListFlowBotService(
    whatsappId ? Number(whatsappId) : undefined
  );
  return res.json(flowBots);
};

export const show = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowBot = await ShowFlowBotService(Number(id));
  return res.json(flowBot);
};

export const store = async (req: Request, res: Response) => {
  const { name, whatsappId, enabled, triggerKeywords } = req.body;
  const flowBot = await CreateFlowBotService({
    name,
    whatsappId,
    enabled,
    triggerKeywords
  });
  return res.status(201).json(flowBot);
};

export const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowBot = await UpdateFlowBotService(Number(id), req.body);
  return res.json(flowBot);
};

export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  await DeleteFlowBotService(Number(id));
  return res.status(204).json();
};

export const duplicate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowBot = await DuplicateFlowBotService(Number(id));
  return res.status(201).json(flowBot);
};

// ---- FlowNode CRUD ----

export const nodeIndex = async (req: Request, res: Response) => {
  const { id: flowBotId } = req.params;
  const { parentId } = req.query;
  const nodes = await ListFlowNodeService({
    flowBotId: Number(flowBotId),
    parentId: parentId !== undefined ? Number(parentId) : undefined
  });
  return res.json(nodes);
};

export const nodeStore = async (req: Request, res: Response) => {
  const { id: flowBotId } = req.params;
  const { parentId, title, content, type, redirectToNodeId } = req.body;
  const node = await CreateFlowNodeService({
    flowBotId: Number(flowBotId),
    parentId: parentId ? Number(parentId) : undefined,
    title,
    content,
    type,
    redirectToNodeId: redirectToNodeId ? Number(redirectToNodeId) : undefined
  });
  return res.status(201).json(node);
};

export const nodeUpdate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const node = await UpdateFlowNodeService(Number(id), req.body);
  return res.json(node);
};

export const nodeRemove = async (req: Request, res: Response) => {
  const { id } = req.params;
  await DeleteFlowNodeService(Number(id));
  return res.status(204).json();
};

export const nodeReorder = async (req: Request, res: Response) => {
  const { ids, orders } = req.body;

  if (ids && orders) {
    // Frontend format: { ids: [1,2,3], orders: [1,0,2] }
    const nodes = ids.map((nodeId: number, index: number) => ({
      nodeId,
      sortOrder: orders[index]
    }));
    await ReorderFlowNodeService(nodes);
  } else if (req.body.nodes) {
    // Backend format: { nodes: [{ nodeId, sortOrder }] }
    await ReorderFlowNodeService(req.body.nodes);
  }

  return res.status(200).json();
};

export const nodeMove = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newParentId, newSortOrder } = req.body;
  const node = await MoveFlowNodeService({
    nodeId: Number(id),
    newParentId: newParentId !== undefined ? Number(newParentId) : null,
    newSortOrder: newSortOrder !== undefined ? Number(newSortOrder) : undefined
  });
  return res.json(node);
};

// ---- FlowSession ----

export const sessionShow = async (req: Request, res: Response) => {
  const { contactJid } = req.params;
  const sessions = await FlowSession.findAll({
    where: { contactJid },
    order: [["updatedAt", "DESC"]]
  });
  return res.json(sessions);
};

export const sessionDelete = async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = await FlowSession.findByPk(Number(id));
  if (!session) return res.status(404).json({ error: "Session not found" });
  await session.destroy();
  return res.status(204).json();
};

// ---- Preview (dry-run) ----

export const preview = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { messageBody, currentNodeId } = req.body;
  const result = await FlowBotPreviewHandler(Number(id), messageBody || "", currentNodeId);
  return res.json(result);
};
