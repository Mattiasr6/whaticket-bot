import { readFileSync } from "fs";
import path from "path";
import { Op } from "sequelize";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { getWbot } from "../../providers/WhatsApp/Implementations/whaileys";
import { logger } from "../../utils/logger";
import CronJob from "../../models/CronJob";
import AgentInstruction from "../../models/AgentInstruction";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import CreateCronJobService from "../CronJobServices/CreateCronJobService";
import UpdateCronJobService from "../CronJobServices/UpdateCronJobService";
import DeleteCronJobService from "../CronJobServices/DeleteCronJobService";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

interface ToolHandler {
  name: string;
  description: string;
  execute(params: Record<string, unknown>, whatsappId: number): Promise<unknown>;
}

const handlers: ToolHandler[] = [
  // ─── COMMUNICATION ───
  {
    name: "send_text",
    description: "Send a text message to a WhatsApp chat or group. Params: toJid (string), body (string)",
    execute: async (params, whatsappId) => {
      const toJid = params.toJid as string;
      const body = params.body as string;
      if (!toJid || !body) throw new Error("send_text requires toJid and body");
      const result = await whatsappProvider.sendMessage(whatsappId, toJid, body);
      logger.info(`[Tool] send_text to ${toJid}: ${body.substring(0, 50)}`);
      return result;
    }
  },
  {
    name: "send_image",
    description: "Send an image to a WhatsApp chat or group. Params: toJid (string), mediaFile (string, filename in public/), caption (string, optional)",
    execute: async (params, whatsappId) => {
      const toJid = params.toJid as string;
      const mediaFile = params.mediaFile as string;
      const caption = (params.caption as string) || "";
      if (!toJid || !mediaFile) throw new Error("send_image requires toJid and mediaFile");
      const fullPath = path.resolve(publicFolder, mediaFile);
      readFileSync(fullPath);
      const result = await whatsappProvider.sendMedia(whatsappId, toJid, {
        path: fullPath,
        filename: mediaFile,
        mimetype: "image/png"
      }, { caption });
      logger.info(`[Tool] send_image to ${toJid}: ${mediaFile}`);
      return result;
    }
  },
  {
    name: "get_chat_history",
    description: "Get recent messages from a chat or group. Params: chatJid (string), limit (number, optional, default 20)",
    execute: async (params, whatsappId) => {
      const chatJid = params.chatJid as string;
      const limit = (params.limit as number) || 20;
      if (!chatJid) throw new Error("get_chat_history requires chatJid");
      const messages = await whatsappProvider.fetchChatMessages(whatsappId, chatJid, limit);
      return messages.map(m => ({ fromMe: m.fromMe, body: m.body, timestamp: m.timestamp }));
    }
  },
  {
    name: "mark_read",
    description: "Mark messages as read in a chat. Params: chatJid (string)",
    execute: async (params, whatsappId) => {
      const chatJid = params.chatJid as string;
      if (!chatJid) throw new Error("mark_read requires chatJid");
      await whatsappProvider.sendSeen(whatsappId, chatJid);
      logger.info(`[Tool] mark_read: ${chatJid}`);
    }
  },

  // ─── CONSULTATION ───
  {
    name: "list_groups",
    description: "List all WhatsApp groups this connection belongs to. No params needed.",
    execute: async (_params, whatsappId) => {
      const wbot = getWbot(whatsappId);
      const groups: { jid: string; name: string; participants: number }[] = [];
      if (wbot.store?.contacts) {
        Object.values(wbot.store.contacts).forEach(c => {
          if (c.id?.includes("@g.us")) {
            groups.push({ jid: c.id, name: c.name || c.verifiedName || c.id, participants: 0 });
          }
        });
      }
      return groups;
    }
  },
  {
    name: "list_contacts",
    description: "List all individual contacts. No params needed.",
    execute: async (_params, whatsappId) => {
      const contacts = await whatsappProvider.getContacts(whatsappId);
      return contacts.map(c => ({ number: c.number, name: c.name, pushname: c.pushname }));
    }
  },
  {
    name: "get_whatsapp_status",
    description: "Get the connection status of the WhatsApp number. No params needed.",
    execute: async (_params, whatsappId) => {
      const wa = await ShowWhatsAppService(whatsappId);
      return { id: wa.id, name: wa.name, status: wa.status, battery: wa.battery };
    }
  },
  {
    name: "get_group_metadata",
    description: "Get metadata from a WhatsApp group. Params: groupJid (string)",
    execute: async (params, whatsappId) => {
      const groupJid = params.groupJid as string;
      if (!groupJid) throw new Error("get_group_metadata requires groupJid");
      const wbot = getWbot(whatsappId);
      const meta = await wbot.groupMetadata(groupJid);
      return { subject: meta.subject, size: meta.participants?.length || 0, owner: meta.owner };
    }
  },

  // ─── CRON JOBS ───
  {
    name: "create_cron_job",
    description: "Create a scheduled cron job. Params: name (string), cronExpr (string, 5-field cron), actionType (send_message|agent_decide), config (JSON string), whatsappId (number)",
    execute: async (params) => {
      const job = await CreateCronJobService({
        name: params.name as string,
        cronExpr: params.cronExpr as string,
        actionType: (params.actionType as string) || "send_message",
        config: params.config as string,
        whatsappId: params.whatsappId as number
      });
      logger.info(`[Tool] create_cron_job: ${job.name} (${job.cronExpr})`);
      return { id: job.id, name: job.name, cronExpr: job.cronExpr };
    }
  },
  {
    name: "list_cron_jobs",
    description: "List all cron jobs. Optional param: whatsappId (number)",
    execute: async (params) => {
      const filter = params.whatsappId ? { where: { whatsappId: params.whatsappId as number } } : {};
      const jobs = await CronJob.findAll({ ...filter, order: [["createdAt", "DESC"]] });
      return jobs.map(j => ({ id: j.id, name: j.name, cronExpr: j.cronExpr, actionType: j.actionType, enabled: j.enabled, nextRunAt: j.nextRunAt }));
    }
  },
  {
    name: "update_cron_job",
    description: "Update a cron job. Params: jobId (number), name/cronExpr/actionType/config/enabled (all optional)",
    execute: async (params) => {
      const id = params.jobId as number;
      if (!id) throw new Error("update_cron_job requires jobId");
      const update: Record<string, unknown> = {};
      if (params.name) update.name = params.name;
      if (params.cronExpr) update.cronExpr = params.cronExpr;
      if (params.actionType) update.actionType = params.actionType;
      if (params.config) update.config = params.config;
      if (params.enabled !== undefined) update.enabled = params.enabled;
      const job = await UpdateCronJobService(id, update);
      logger.info(`[Tool] update_cron_job: ${id}`);
      return { id: job.id, name: job.name };
    }
  },
  {
    name: "delete_cron_job",
    description: "Delete a cron job. Params: jobId (number)",
    execute: async (params) => {
      const id = params.jobId as number;
      if (!id) throw new Error("delete_cron_job requires jobId");
      await DeleteCronJobService(id);
      logger.info(`[Tool] delete_cron_job: ${id}`);
    }
  },
  {
    name: "toggle_cron_job",
    description: "Enable or disable a cron job. Params: jobId (number), enabled (boolean)",
    execute: async (params) => {
      const id = params.jobId as number;
      const enabled = params.enabled as boolean;
      if (!id || enabled === undefined) throw new Error("toggle_cron_job requires jobId and enabled");
      const job = await UpdateCronJobService(id, { enabled } as any);
      logger.info(`[Tool] toggle_cron_job: ${id} → ${enabled ? "ON" : "OFF"}`);
      return { id: job.id, enabled: job.enabled };
    }
  },

  // ─── INSTRUCTIONS ───
  {
    name: "add_instruction",
    description: "Add an instruction for the AI agent. Params: instruction (string), priority (number, optional)",
    execute: async (params, whatsappId) => {
      const instruction = params.instruction as string;
      if (!instruction) throw new Error("add_instruction requires instruction");
      const inst = await AgentInstruction.create({
        whatsappId,
        instruction,
        priority: (params.priority as number) || 0,
        enabled: true
      });
      logger.info(`[Tool] add_instruction: ${inst.id}`);
      return { id: inst.id, instruction: inst.instruction };
    }
  },
  {
    name: "list_instructions",
    description: "List all active agent instructions. No params needed.",
    execute: async (_params, whatsappId) => {
      const instructions = await AgentInstruction.findAll({
        where: { whatsappId, enabled: true },
        order: [["priority", "DESC"]]
      });
      return instructions.map(i => ({ id: i.id, instruction: i.instruction, priority: i.priority }));
    }
  },
  {
    name: "remove_instruction",
    description: "Remove an agent instruction. Params: instructionId (number)",
    execute: async (params) => {
      const id = params.instructionId as number;
      if (!id) throw new Error("remove_instruction requires instructionId");
      await AgentInstruction.destroy({ where: { id } });
      logger.info(`[Tool] remove_instruction: ${id}`);
    }
  }
];

const executeTool = async (
  toolName: string,
  params: Record<string, unknown>,
  whatsappId: number
): Promise<unknown> => {
  const tool = handlers.find(h => h.name === toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);
  return tool.execute(params, whatsappId);
};

export { handlers, executeTool };
export default executeTool;
