/* eslint-disable no-await-in-loop, no-restricted-syntax */
import FlowNode from "../../models/FlowNode";
import AppError from "../../errors/AppError";

interface ReorderData {
  nodeId: number;
  sortOrder: number;
}

const ReorderFlowNodeService = async (data: ReorderData[]): Promise<void> => {
  for (const item of data) {
    const node = await FlowNode.findByPk(item.nodeId);
    if (!node) throw new AppError(`FlowNode ${item.nodeId} not found`);
    await node.update({ sortOrder: item.sortOrder });
  }
};

export default ReorderFlowNodeService;
