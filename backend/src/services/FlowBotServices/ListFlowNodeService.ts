import FlowNode from "../../models/FlowNode";

interface Request {
  flowBotId: number;
  parentId?: number | null;
}

const ListFlowNodeService = async (data: Request): Promise<FlowNode[]> => {
  const filter: { flowBotId: number; parentId?: number | null } = {
    flowBotId: data.flowBotId
  };
  if (data.parentId !== undefined) {
    filter.parentId = data.parentId;
  }
  const nodes = await FlowNode.findAll({
    where: filter,
    order: [["sortOrder", "ASC"]]
  });
  return nodes;
};

export default ListFlowNodeService;
