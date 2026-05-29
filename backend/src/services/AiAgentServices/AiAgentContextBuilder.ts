import { Op } from "sequelize";
import { readFile } from "fs/promises";
import { join } from "path";
import AgentInstruction from "../../models/AgentInstruction";
import BotRule from "../../models/BotRule";
import CronJob from "../../models/CronJob";
import ShowWhatsAppService from "../../services/WhatsappService/ShowWhatsAppService";

interface IncomingMessage {
  messageBody: string;
  fromJid: string;
  isGroup: boolean;
  groupJid?: string;
}

interface Context {
  activeInstructions: AgentInstruction[];
  activeBotRules: BotRule[];
  activeCronJobs: CronJob[];
  whatsappStatus: string;
  currentTime: string;
  incomingMessage: IncomingMessage;
  clinicInfo: string;
}

const CLINIC_INFO_PATH = join(__dirname, "..", "..", "..", "public", "clinic-info.md");

const buildContext = async (
  whatsappId: number,
  incomingMessage: IncomingMessage
): Promise<Context> => {
  const [whatsapp, activeInstructions, activeBotRules, activeCronJobs] = await Promise.all([
    ShowWhatsAppService(whatsappId),
    AgentInstruction.findAll({
      where: { whatsappId, enabled: true },
      order: [["priority", "DESC"]]
    }),
    BotRule.findAll({
      where: { whatsappId, enabled: true },
      order: [["priority", "DESC"]]
    }),
    CronJob.findAll({
      where: {
        [Op.or]: [{ whatsappId }, { whatsappId: null }],
        enabled: true
      }
    })
  ]);

  let clinicInfo = "";
  try {
    clinicInfo = await readFile(CLINIC_INFO_PATH, "utf-8");
  } catch { /* file not found */ }

  return {
    activeInstructions,
    activeBotRules,
    activeCronJobs,
    whatsappStatus: whatsapp.status,
    currentTime: new Date().toISOString(),
    incomingMessage,
    clinicInfo
  };
};

export default buildContext;
