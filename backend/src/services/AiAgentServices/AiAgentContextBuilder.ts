import { Op } from "sequelize";
import AgentInstruction from "../../models/AgentInstruction";
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
  activeCronJobs: CronJob[];
  whatsappStatus: string;
  currentTime: string;
  incomingMessage: IncomingMessage;
}

const buildContext = async (
  whatsappId: number,
  incomingMessage: IncomingMessage
): Promise<Context> => {
  const [whatsapp, activeInstructions, activeCronJobs] = await Promise.all([
    ShowWhatsAppService(whatsappId),
    AgentInstruction.findAll({
      where: {
        whatsappId,
        enabled: true
      },
      order: [["priority", "DESC"]]
    }),
    CronJob.findAll({
      where: {
        [Op.or]: [{ whatsappId }, { whatsappId: null }],
        enabled: true
      }
    })
  ]);

  return {
    activeInstructions,
    activeCronJobs,
    whatsappStatus: whatsapp.status,
    currentTime: new Date().toISOString(),
    incomingMessage
  };
};

export default buildContext;
