/* eslint-disable no-await-in-loop, no-continue, consistent-return */
import FlowBot from "../../models/FlowBot";
import FlowNode from "../../models/FlowNode";
import FlowSession from "../../models/FlowSession";
import TriggerMatcher from "./TriggerMatcher";
import MenuNodeHandler, { OutputFn } from "./NodeHandlers/MenuNodeHandler";
import MessageNodeHandler from "./NodeHandlers/MessageNodeHandler";
import RedirectNodeHandler from "./NodeHandlers/RedirectNodeHandler";
import GetOrCreateFlowSessionService from "./GetOrCreateFlowSessionService";
import ExpireFlowSessionService from "./ExpireFlowSessionService";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { logger } from "../../utils/logger";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface ExecutionResult {
  nextNodeId: number | null;
  invalidOption?: boolean;
}

export interface PreviewResult {
  replies: string[];
  finalNodeId: number | null;
}

// ---- Core execution engine (no side effects on sessions) ----

const getRootMenuNode = async (flowBotId: number): Promise<FlowNode | null> => {
  return FlowNode.findOne({
    where: { flowBotId, parentId: null, type: "menu" }
  });
};

const getNodeChildren = async (parentId: number): Promise<FlowNode[]> => {
  return FlowNode.findAll({
    where: { parentId },
    order: [["sortOrder", "ASC"]]
  });
};

const executeNode = async (
  node: FlowNode,
  output: OutputFn
): Promise<ExecutionResult> => {
  switch (node.type) {
    case "menu":
      return MenuNodeHandler(node, output);
    case "message":
      return MessageNodeHandler(node, output);
    case "redirect":
      return RedirectNodeHandler(node);
    default:
      return { nextNodeId: null };
  }
};

const executeNodeChain = async (
  node: FlowNode,
  output: OutputFn
): Promise<number | null> => {
  let currentNode: FlowNode | null = node;
  let finalNodeId: number | null = node.id;

  while (currentNode) {
    const result: ExecutionResult = await executeNode(currentNode, output);

    if (result.invalidOption) {
      finalNodeId = currentNode.id;
      break;
    }

    if (result.nextNodeId === null || result.nextNodeId === currentNode.id) {
      finalNodeId = result.nextNodeId;
      break;
    }

    const nextNode: FlowNode | null = await FlowNode.findByPk(
      result.nextNodeId
    );
    if (!nextNode) {
      finalNodeId = null;
      break;
    }

    if (currentNode.type === "redirect") {
      currentNode = nextNode;
      finalNodeId = result.nextNodeId;
      continue;
    }

    if (nextNode.type === "menu") {
      await executeNode(nextNode, output);
      finalNodeId = nextNode.id;
      break;
    }

    currentNode = nextNode;
    finalNodeId = result.nextNodeId;
  }

  return finalNodeId;
};

const processMenuChoice = async (
  menuNode: FlowNode,
  choice: number,
  output: OutputFn
): Promise<number | null> => {
  const children = await getNodeChildren(menuNode.id);
  logger.info({info:"FlowBot DEBUG: processMenuChoice",menuNodeId:menuNode.id,childrenCount:children.length,choice});
  children.forEach((c,i) => logger.info({info:"FlowBot DEBUG: child",index:i,id:c.id,title:c.title,type:c.type}));

  if (choice < 1 || choice > children.length) {
    return null;
  }

  const targetNode = children[choice - 1];
  return executeNodeChain(targetNode, output);
};

const executeWithRootMenu = async (
  flowBotId: number,
  output: OutputFn
): Promise<number | null> => {
  const rootMenu = await getRootMenuNode(flowBotId);
  if (!rootMenu) return null;
  return executeNodeChain(rootMenu, output);
};

// ---- Real handler (with session persistence) ----

export const FlowBotHandler = async (
  whatsappId: number,
  messageBody: string,
  contactJid: string,
  isPreview = false,
  currentNodeId?: number | null
): Promise<PreviewResult | void> => {
  try {
    if (!messageBody) {
      if (isPreview) return { replies: [], finalNodeId: null };
      return;
    }

    const flowBot: FlowBot | null = await FlowBot.findOne({
      where: { whatsappId, enabled: true }
    });

    if (!flowBot) {
      if (isPreview) return { replies: [], finalNodeId: null };
      return;
    }

    // ---- Preview mode (no session DB writes) ----
    if (isPreview) {
      const replies: string[] = [];
      const output: OutputFn = async (text: string) => {
        replies.push(text);
      };

      // Handle reset
      if (messageBody.trim() === "#") {
        const id = await executeWithRootMenu(flowBot.id, output);
        return { replies, finalNodeId: id };
      }

      // If there's an active node, process the choice
      if (currentNodeId) {
        const currentNode = await FlowNode.findByPk(currentNodeId);
        if (currentNode && currentNode.type === "menu") {
          const choice = parseInt(messageBody.trim(), 10);
          if (!Number.isNaN(choice)) {
            const finalId = await processMenuChoice(currentNode, choice, output);
            return { replies, finalNodeId: finalId ?? currentNode.id };
          }
        }
      }

      // Start fresh — send root menu
      const finalId = await executeWithRootMenu(flowBot.id, output);
      return { replies, finalNodeId: finalId };
    }

    // ---- Normal mode (with session persistence) ----

    let session: FlowSession | null = await FlowSession.findOne({
      where: { flowBotId: flowBot.id, contactJid }
    });

    // Bug 1: Check session timeout explicitly and expire if needed
    if (session && session.currentNodeId !== null) {
      const diff = Date.now() - session.updatedAt.getTime();
      if (diff > SESSION_TIMEOUT_MS) {
        await ExpireFlowSessionService(session.id);
        session = null;
      }
    }

    const hasActiveSession = session !== null && session.currentNodeId !== null;

    // Trigger matching only for new conversations (no active session)
    if (!hasActiveSession) {
      if (!TriggerMatcher(messageBody, flowBot.triggerKeywords)) return;
    }

    // Bug 3: Pass already-fetched session to avoid duplicate query
    session = await GetOrCreateFlowSessionService(
      { flowBotId: flowBot.id, contactJid },
      session
    );

    const output: OutputFn = async (text: string) => {
      await whatsappProvider.sendMessage(whatsappId, contactJid, text);
    };

    if (messageBody.trim() === "#") {
      session.currentNodeId = null;
      await session.save();

      const finalNodeId = await executeWithRootMenu(flowBot.id, output);
      if (finalNodeId !== null) {
        session.currentNodeId = finalNodeId;
        await session.save();
      }
      return;
    }

    if (session.currentNodeId) {
      const currentNode: FlowNode | null = await FlowNode.findByPk(
        session.currentNodeId
      );
      if (currentNode && currentNode.type === "menu") {
        const choice = parseInt(messageBody.trim(), 10);

        if (Number.isNaN(choice)) {
          await output(
            "❌ Opción inválida. Por favor, elige un número de la lista.\n"
          );
          await MenuNodeHandler(currentNode, output);
          return;
        }

        logger.info({info:"FlowBot DEBUG: processing choice",nodeId:currentNode.id,choice});
        const finalNodeId = await processMenuChoice(
          currentNode,
          choice,
          output
        );

        if (finalNodeId === null) {
          await output("❌ Opción inválida. Elige un número válido.\n");
          await MenuNodeHandler(currentNode, output);
          session.currentNodeId = currentNode.id;
          await session.save();
          return;
        }

        session.currentNodeId = finalNodeId;
        await session.save();
        return;
      }

      session.currentNodeId = null;
      await session.save();
    }

    const finalNodeId = await executeWithRootMenu(flowBot.id, output);
    if (finalNodeId !== null) {
      session.currentNodeId = finalNodeId;
      await session.save();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({
      info: "FlowBotHandler error",
      whatsappId,
      contactJid,
      isPreview,
      error: message
    });
    if (isPreview) return { replies: [], finalNodeId: null };
  }
};

// ---- Preview alias (keeps backward compat with controller) ----

export const FlowBotPreviewHandler = async (
  flowBotId: number,
  messageBody: string,
  currentNodeId?: number | null
): Promise<PreviewResult> => {
  const flowBot: FlowBot | null = await FlowBot.findByPk(flowBotId);
  if (!flowBot) throw new Error("FlowBot not found");

  const result = await FlowBotHandler(
    flowBot.whatsappId,
    messageBody,
    `preview-${flowBotId}@flow`,
    true,
    currentNodeId
  );

  return result as PreviewResult;
};
