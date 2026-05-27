/* eslint-disable no-await-in-loop, no-restricted-syntax */
import FlowBot from "../../models/FlowBot";
import FlowNode from "../../models/FlowNode";
import AppError from "../../errors/AppError";

interface NodeMap {
  [oldId: number]: number;
}

const DuplicateFlowBotService = async (id: number): Promise<FlowBot> => {
  const original = await FlowBot.findByPk(id, {
    include: [{ model: FlowNode, as: "flowNodes" }]
  });

  if (!original) throw new AppError("FlowBot not found");

  const duplicate = await FlowBot.create({
    name: `${original.name} (copy)`,
    whatsappId: original.whatsappId,
    enabled: false,
    triggerKeywords: original.triggerKeywords
  });

  if (original.flowNodes && original.flowNodes.length > 0) {
    const nodeMap: NodeMap = {};

    // First pass: create all nodes without parentId/redirectToNodeId, recording mapping
    for (const node of original.flowNodes) {
      const newNode = await FlowNode.create({
        flowBotId: duplicate.id,
        title: node.title,
        content: node.content,
        type: node.type,
        sortOrder: node.sortOrder
      });
      nodeMap[node.id] = newNode.id;
    }

    // Second pass: update parentId and redirectToNodeId
    for (const node of original.flowNodes) {
      if (node.parentId || node.redirectToNodeId) {
        const newId = nodeMap[node.id];
        const updates: Partial<FlowNode> = {};
        if (node.parentId && nodeMap[node.parentId]) {
          updates.parentId = nodeMap[node.parentId];
        }
        if (node.redirectToNodeId && nodeMap[node.redirectToNodeId]) {
          updates.redirectToNodeId = nodeMap[node.redirectToNodeId];
        }
        if (Object.keys(updates).length > 0) {
          await FlowNode.update(updates, { where: { id: newId } });
        }
      }
    }
  }

  return duplicate;
};

export default DuplicateFlowBotService;
