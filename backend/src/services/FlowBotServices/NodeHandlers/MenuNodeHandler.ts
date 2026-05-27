import FlowNode from "../../../models/FlowNode";
import { logger } from "../../../utils/logger";

export type OutputFn = (text: string) => Promise<void>;

const MenuNodeHandler = async (
  node: FlowNode,
  output: OutputFn
): Promise<{ nextNodeId: number | null; invalidOption?: boolean }> => {
  const children = await FlowNode.findAll({
    where: { parentId: node.id },
    order: [["sortOrder", "ASC"]]
  });

  let menuText = node.content || node.title;
  menuText += "\n\n";

  children.forEach((child, index) => {
    menuText += `*${index + 1}* - ${child.title}\n`;
  });

  try {
    await output(menuText);
    logger.info({
      info: "FlowBot menu sent",
      nodeId: node.id,
      flowBotId: node.flowBotId
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({
      info: "FlowBot menu send failed",
      nodeId: node.id,
      error: message
    });
  }

  // Stay on this menu node, waiting for user choice
  return { nextNodeId: node.id };
};

export default MenuNodeHandler;
