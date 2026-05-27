import FlowNode from "../../../models/FlowNode";
import { logger } from "../../../utils/logger";
import { OutputFn } from "./MenuNodeHandler";

const MessageNodeHandler = async (
  node: FlowNode,
  output: OutputFn
): Promise<{ nextNodeId: number | null; invalidOption?: boolean }> => {
  const text = node.content || node.title;
  const displayText = text + "\n\n# - Volver al menú principal";

  try {
    await output(displayText);
    logger.info({
      info: "FlowBot message sent",
      nodeId: node.id,
      flowBotId: node.flowBotId
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({
      info: "FlowBot message send failed",
      nodeId: node.id,
      error: message
    });
  }

  // Quedarse en el mismo nodo, el usuario decide con # cuándo volver
  return { nextNodeId: node.id };
};

export default MessageNodeHandler;
