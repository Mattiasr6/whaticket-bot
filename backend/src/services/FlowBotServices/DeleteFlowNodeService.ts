/* eslint-disable no-await-in-loop, no-restricted-syntax */
import FlowNode from "../../models/FlowNode";
import FlowSession from "../../models/FlowSession";
import AppError from "../../errors/AppError";

const DeleteFlowNodeService = async (id: number): Promise<void> => {
  const node = await FlowNode.findByPk(id);
  if (!node) throw new AppError("FlowNode not found");

  // Clear any sessions pointing to this node
  await FlowSession.update(
    { currentNodeId: null },
    { where: { currentNodeId: id } }
  );

  // Delete children recursively (cascade via findAll + destroy each)
  const deleteRecursive = async (nodeId: number) => {
    const children = await FlowNode.findAll({ where: { parentId: nodeId } });
    for (const child of children) {
      await deleteRecursive(child.id);
      await child.destroy();
    }
  };

  await deleteRecursive(id);
  await node.destroy();
};

export default DeleteFlowNodeService;
