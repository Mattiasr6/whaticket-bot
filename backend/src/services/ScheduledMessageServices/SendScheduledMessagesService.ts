import { Op } from "sequelize";
import { readFileSync } from "fs";
import path from "path";
import ScheduledMessage from "../../models/ScheduledMessage";
import { getWbot } from "../../providers/WhatsApp/Implementations/whaileys";
import { logger } from "../../utils/logger";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const getWbotSafe = (sessionId: number) => {
  try {
    const wbot = getWbot(sessionId);
    if (wbot?.user?.id) return wbot;
    return null;
  } catch {
    return null;
  }
};

const sendMediaMessage = async (
  sessionId: number,
  groupJid: string,
  mediaPath: string,
  caption?: string
) => {
  const wbot = getWbotSafe(sessionId);
  if (!wbot) return false;

  const fullPath = path.resolve(publicFolder, mediaPath);
  const buffer = readFileSync(fullPath);

  await wbot.sendMessage(groupJid, {
    image: buffer,
    caption: caption || ""
  });
  return true;
};

const sendTextMessage = async (
  sessionId: number,
  groupJid: string,
  text: string
) => {
  const wbot = getWbotSafe(sessionId);
  if (!wbot) return false;

  await wbot.sendMessage(groupJid, { text });
  return true;
};

const SendScheduledMessagesService = async () => {
  const now = new Date();

  const dueMessages = await ScheduledMessage.findAll({
    where: {
      enabled: true,
      [Op.or]: [
        { lastSentAt: null },
        {
          lastSentAt: {
            [Op.lte]: new Date(now.getTime() - 60000)
          }
        }
      ]
    }
  });

  for (const msg of dueMessages) {
    const nextSendAt = msg.lastSentAt
      ? new Date(msg.lastSentAt.getTime() + msg.intervalMinutes * 60000)
      : new Date(0);

    if (nextSendAt > now) continue;

    try {
      let sent = false;

      if (msg.mediaPath) {
        sent = await sendMediaMessage(
          msg.whatsappId,
          msg.groupJid,
          msg.mediaPath,
          msg.messageText
        );
      } else if (msg.messageText) {
        sent = await sendTextMessage(
          msg.whatsappId,
          msg.groupJid,
          msg.messageText
        );
      }

      if (sent) {
        await msg.update({ lastSentAt: now });
        logger.info({
          info: "Scheduled message sent",
          scheduledId: msg.id,
          groupName: msg.groupName,
          groupJid: msg.groupJid
        });
      }
    } catch (err: any) {
      logger.error({
        info: "Failed to send scheduled message",
        scheduledId: msg.id,
        groupName: msg.groupName,
        error: err.message
      });
    }
  }
};

export default SendScheduledMessagesService;
