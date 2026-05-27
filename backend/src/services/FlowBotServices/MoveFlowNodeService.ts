/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import FlowNode from "../../models/FlowNode";
import AppError from "../../errors/AppError";

const MAX_DEPTH = 3;

const getNodeDepth = async (nodeId: number | null): Promise<number> => {
  if (!nodeId) return 0;
  let depth = 1;
  let currentId: number | null = nodeId;
  while (currentId) {
    const node: FlowNode | null = await FlowNode.findByPk(currentId);
    if (!node) break;
    if (node.parentId) {
      depth++;
      currentId = node.parentId;
    } else {
      break;
    }
  }
  return depth;
};

const getSubtreeDepth = async (nodeId: number): Promise<number> => {
  const children = await FlowNode.findAll({ where: { parentId: nodeId } });
  if (children.length === 0) return 1;
  let maxChildDepth = 0;
  for (const child of children) {
    const childDepth = await getSubtreeDepth(child.id);
    if (childDepth > maxChildDepth) maxChildDepth = childDepth;
  }
  return 1 + maxChildDepth;
};

interface Request {
  nodeId: number;
  newParentId: number | null;
  newSortOrder?: number;
}

const MoveFlowNodeService = async (data: Request): Promise<FlowNode> => {
  const node: FlowNode | null = await FlowNode.findByPk(data.nodeId);
  if (!node) throw new AppError("FlowNode not found");

  const newParentId = data.newParentId === undefined ? null : data.newParentId;

  // Moving to root? Must be menu type, and target must be root
  if (!newParentId && node.type !== "menu") {
    throw new AppError("Only menu nodes can be root");
  }

  if (newParentId) {
    // Check moving within the same flowBot
    const newParent = await FlowNode.findByPk(newParentId);
    if (!newParent) throw new AppError("Target parent node not found");
    if (newParent.flowBotId !== node.flowBotId) {
      throw new AppError("Cannot move node to a different FlowBot");
    }

    // Prevent circular reference: target parent cannot be a descendant of node
    const checkCircular = async (
      targetId: number,
      candidateId: number
    ): Promise<boolean> => {
      if (targetId === candidateId) return true;
      const children = await FlowNode.findAll({
        where: { parentId: candidateId }
      });
      for (const child of children) {
        if (await checkCircular(targetId, child.id)) return true;
      }
      return false;
    };

    if (await checkCircular(newParentId, node.id)) {
      throw new AppError("Cannot move node to its own descendant");
    }

    // Check depth constraint: node subtree depth + new parent depth must be <= 3
    const parentDepth = await getNodeDepth(newParentId);
    const subtreeDepth = await getSubtreeDepth(node.id);
    if (parentDepth + subtreeDepth > MAX_DEPTH) {
      throw new AppError("Max flow depth is 3 levels");
    }
  }

  // Set new sortOrder (append to end if not specified)
  if (data.newSortOrder === undefined) {
    const lastSibling = await FlowNode.findOne({
      where: { flowBotId: node.flowBotId, parentId: newParentId },
      order: [["sortOrder", "DESC"]]
    });
    const newSortOrder = lastSibling ? lastSibling.sortOrder + 1 : 0;
    await node.update({ parentId: newParentId, sortOrder: newSortOrder });
  } else {
    await node.update({
      parentId: newParentId,
      sortOrder: data.newSortOrder
    });
  }

  return node;
};

export default MoveFlowNodeService;
