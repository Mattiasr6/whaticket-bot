import FlowNode from "../../models/FlowNode";
import AppError from "../../errors/AppError";

const UpdateFlowNodeService = async (
  id: number,
  data: Partial<FlowNode>
): Promise<FlowNode> => {
  const node = await FlowNode.findByPk(id);
  if (!node) throw new AppError("FlowNode not found");

  // Cannot change a root menu node's type
  if (node.parentId === null && data.type && data.type !== "menu") {
    throw new AppError("Root node must remain type menu");
  }

  await node.update(data);
  return node;
};

export default UpdateFlowNodeService;
