import FlowNode from "../../../models/FlowNode";
import { logger } from "../../../utils/logger";

const RedirectNodeHandler = async (
  node: FlowNode
): Promise<{ nextNodeId: number | null; invalidOption?: boolean }> => {
  if (node.redirectToNodeId) {
    logger.info({
      info: "FlowBot redirect",
      fromNodeId: node.id,
      toNodeId: node.redirectToNodeId,
      flowBotId: node.flowBotId
    });
    return { nextNodeId: node.redirectToNodeId };
  }

  // No redirect target
  return { nextNodeId: null };
};

export default RedirectNodeHandler;
