import FlowBot from "../../models/FlowBot";
import FlowNode from "../../models/FlowNode";
import AppError from "../../errors/AppError";

interface Request {
  flowBotId: number;
  parentId?: number;
  title: string;
  content?: string;
  type: "menu" | "message" | "redirect";
  redirectToNodeId?: number;
}

const MAX_DEPTH = 3;

const getNodeDepth = async (nodeId: number | null): Promise<number> => {
  if (!nodeId) return 0;
  let depth = 1;
  let currentId: number | null = nodeId;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!currentId) break;
    // eslint-disable-next-line no-await-in-loop
    const node: FlowNode | null = await FlowNode.findByPk(currentId);
    if (!node) break;
    if (node.parentId) {
      depth += 1;
      currentId = node.parentId;
    } else {
      break;
    }
  }
  return depth;
};

const CreateFlowNodeService = async (data: Request): Promise<FlowNode> => {
  const flowBot = await FlowBot.findByPk(data.flowBotId);
  if (!flowBot) throw new AppError("FlowBot not found");

  const parentId = data.parentId || null;

  if (!parentId && data.type !== "menu") {
    throw new AppError("Root node must be of type menu");
  }

  if (parentId) {
    const parentDepth = await getNodeDepth(parentId);
    if (parentDepth >= MAX_DEPTH) {
      throw new AppError("Max flow depth is 3 levels");
    }
  }

  const lastSibling = await FlowNode.findOne({
    where: { flowBotId: data.flowBotId, parentId },
    order: [["sortOrder", "DESC"]]
  });
  const sortOrder = lastSibling ? lastSibling.sortOrder + 1 : 0;

  const node = await FlowNode.create({
    flowBotId: data.flowBotId,
    parentId,
    title: data.title,
    content: data.content || null,
    type: data.type,
    redirectToNodeId: data.redirectToNodeId || null,
    sortOrder
  });

  return node;
};

export default CreateFlowNodeService;
