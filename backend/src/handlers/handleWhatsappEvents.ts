import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";

import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import { debounce } from "../helpers/Debounce";
import formatBody from "../helpers/Mustache";

import Contact from "../models/Contact";

import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import { decideAndAct } from "../services/AiAgentServices/AiAgentService";
import { FlowBotHandler } from "../services/FlowBotServices/FlowBotHandler";
import MessageBuffer from "../services/AutoForwardServices/MessageBuffer";
import HandlePrivateCommand from "../services/AutoForwardServices/HandlePrivateCommand";

import { handlePrivateCommand } from "../services/BotCajeroServices/HandlePrivateCommand";
import { handleFAQAutoReply } from "../services/BotCajeroServices/FAQAutoReply";
import { handleAntiSpam } from "../services/BotCajeroServices/AntiSpamService";
import { getRedisClient } from "../libs/redisStore";
import { handleGroupCommand } from "../services/BotCajeroServices/GroupCommandHandler";
import { getWbot } from "../providers/WhatsApp/Implementations/whaileys";

import { whatsappProvider } from "../providers/WhatsApp/whatsappProvider";
import { MessageType, MessageAck } from "../providers/WhatsApp/types";

const writeFileAsync = promisify(writeFile);

export interface ContactPayload {
  name: string;
  number: string;
  lid?: string;
  profilePicUrl?: string;
  isGroup: boolean;
}

export interface MessagePayload {
  id: string;
  body: string;
  fromMe: boolean;
  hasMedia: boolean;
  type: MessageType;
  timestamp: number;
  from: string;
  to: string;
  hasQuotedMsg?: boolean;
  quotedMsgId?: string;
  mediaUrl?: string;
  mediaType?: string;
  ack?: MessageAck;
  mentionedJid?: string[];
}

export interface MediaPayload {
  filename: string;
  mimetype: string;
  data: string;
}

export interface WhatsappContextPayload {
  whatsappId: number;
  unreadMessages: number;
  groupContact?: ContactPayload;
}

const makeRandomId = (length: number): string => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
};

const processLocationMessage = (
  messagePayload: MessagePayload
): MessagePayload => {
  if (messagePayload.type !== "location") return messagePayload;

  return messagePayload;
};

const saveMediaFile = async (mediaPayload: MediaPayload): Promise<string> => {
  const randomId = makeRandomId(5);
  const { filename: originalFilename } = mediaPayload;

  let filename: string;
  if (!originalFilename) {
    const [extension] = mediaPayload.mimetype.split("/")[1].split(";");
    filename = `${randomId}-${new Date().getTime()}.${extension}`;
  } else {
    const baseName = originalFilename.split(".").slice(0, -1).join(".");
    const extension = originalFilename.split(".").slice(-1)[0];
    filename = `${baseName}.${randomId}.${extension}`;
  }

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "public", filename),
      mediaPayload.data,
      "base64"
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }

  return filename;
};

const processVcardMessage = async (
  messagePayload: MessagePayload
): Promise<void> => {
  if (messagePayload.type !== "vcard") return;

  try {
    const array = messagePayload.body.split("\n");
    const phoneNumbers: Array<{ number: string }> = [];
    let contactName = "";

    array.forEach(line => {
      const values = line.split(":");
      values.forEach((value, index) => {
        if (value.indexOf("+") !== -1) {
          phoneNumbers.push({ number: value });
        }
        if (value.indexOf("FN") !== -1 && values[index + 1]) {
          contactName = values[index + 1];
        }
      });
    });

    await Promise.all(
      phoneNumbers.map(({ number }) =>
        CreateContactService({
          name: contactName,
          number: number.replace(/\D/g, "")
        })
      )
    );
  } catch (error) {
    logger.error("Error processing vcard message:", error);
  }
};

export const handleMessage = async (
  messagePayload: MessagePayload,
  contactPayload: ContactPayload,
  contextPayload: WhatsappContextPayload,
  mediaPayload?: MediaPayload
): Promise<void> => {
  try {
    const processedMessage = processLocationMessage(messagePayload);

    const contact = await CreateOrUpdateContactService({
      name: contactPayload.name,
      number: contactPayload.number,
      lid: contactPayload.lid,
      profilePicUrl: contactPayload.profilePicUrl,
      isGroup: contactPayload.isGroup
    });

    let groupContact: Contact | undefined;
    if (contextPayload.groupContact) {
      groupContact = await CreateOrUpdateContactService({
        name: contextPayload.groupContact.name,
        number: contextPayload.groupContact.number,
        lid: contextPayload.groupContact.lid,
        profilePicUrl: contextPayload.groupContact.profilePicUrl,
        isGroup: contextPayload.groupContact.isGroup
      });
    }

    const whatsapp = await ShowWhatsAppService(contextPayload.whatsappId);
    if (
      contextPayload.unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact) === processedMessage.body
    ) {
      return;
    }

    if (
      !processedMessage.fromMe &&
      processedMessage.body &&
      // Skip AI Agent processing for BotCajero commands
      !processedMessage.body.trim().startsWith("/") &&
      !processedMessage.body.toLowerCase().includes("@botcajero") &&
      !processedMessage.body.toLowerCase().includes("@bot")
    ) {
      decideAndAct({
        whatsappId: contextPayload.whatsappId,
        messageBody: processedMessage.body,
        fromJid: contactPayload.number,
        isGroup: Boolean(contextPayload.groupContact),
        groupJid: contextPayload.groupContact?.number
      }).catch(err => {
        logger.error({ info: "AI Agent error", error: err.message });
      });

      // FlowBot
      FlowBotHandler(
        contextPayload.whatsappId,
        processedMessage.body,
        contactPayload.number
      ).catch(err => {
        logger.error({ info: "FlowBot error", error: err.message });
      });
    }

    // ===== Reenvío Automático =====
    // 1. Buffer: store group messages for later scanning
    //    Only metadata (messageId), no base64 images
    if (contactPayload.isGroup && !processedMessage.fromMe) {
      MessageBuffer.add(contextPayload.whatsappId, contactPayload.number, {
        id: processedMessage.id,
        timestamp: processedMessage.timestamp,
        type: processedMessage.type,
        hasMedia: processedMessage.hasMedia,
        messageId: processedMessage.hasMedia ? processedMessage.id : undefined,
        body: processedMessage.body
      }).catch(err => {
        logger.error({ info: "AutoForward buffer error", error: err.message });
      });
    }

    // 2. Detect private commands (individual chat only, not groups)
    if (
      !processedMessage.fromMe &&
      !contactPayload.isGroup &&
      processedMessage.body.trim().startsWith("/")
    ) {
      HandlePrivateCommand(
        contextPayload.whatsappId,
        contactPayload.number,
        processedMessage.body.trim()
      ).catch(err => {
        logger.error({
          info: "AutoForward - Private command error",
          error: err.message
        });
      });
    }

    // ===== BotCajero =====

    // 🔒 Hardcoded group check
    const isDemoGroup = contextPayload.groupContact?.number === "120363426709880780";

    // 0. BotCajero private commands (individual chat only, not groups)
    if (
      !processedMessage.fromMe &&
      !contactPayload.isGroup &&
      processedMessage.body.trim().startsWith("/")
    ) {
      // 🔒 Hardcoded admin check
      const senderClean = contactPayload.number.replace(/[^0-9]/g, "");
      if (senderClean === "59178170459") {
        handlePrivateCommand(
          contextPayload.whatsappId,
          contactPayload.number,
          processedMessage.body.trim(),
          mediaPayload
        ).catch(err => {
          logger.error({
            info: "BotCajero - Private command error",
            error: err.message
          });
        });
      }
    }

    // 1. Update Redis lastmsg timestamp for inactivity tracking
    if (isDemoGroup && contactPayload.isGroup && !processedMessage.fromMe) {
      const redis = getRedisClient();
      if (redis) {
        const lastMsgKey = `botcajero:lastmsg:${contextPayload.whatsappId}:${contactPayload.number}`;
        redis.set(lastMsgKey, Date.now().toString()).catch(() => {});
      }
    }

    // 1.5. Mute check — skip processing for muted users
    if (isDemoGroup && contactPayload.isGroup && !processedMessage.fromMe) {
      const redis = getRedisClient();
      if (redis) {
        const muteKey = `botcajero:muted:${contextPayload.whatsappId}:${contactPayload.number.replace(/[^0-9]/g, "")}`;
        const isMuted = await redis.get(muteKey);
        if (isMuted) return; // Skip anti-spam, FAQ, etc.
      }
    }

    // 2. Anti-spam (group only, incoming messages, demo group only)
    if (
      isDemoGroup &&
      contactPayload.isGroup &&
      !processedMessage.fromMe &&
      processedMessage.body
    ) {
      const spamDetected = await handleAntiSpam(
        contextPayload.whatsappId,
        contactPayload.number,
        processedMessage.body,
        processedMessage.id,
        contactPayload.number,
        contactPayload.name
      );
      if (spamDetected) return;
    }

    // 3. FAQ auto-reply (group only, incoming messages, demo group only)
    if (
      isDemoGroup &&
      contactPayload.isGroup &&
      !processedMessage.fromMe &&
      processedMessage.body
    ) {
      await handleFAQAutoReply(
        contextPayload.whatsappId,
        contactPayload.number,
        processedMessage.body
      );
    }

    // 3.4 Group "/" commands — detect slash commands in group
    if (
      contactPayload.isGroup &&
      !processedMessage.fromMe &&
      processedMessage.body.trim().startsWith("/")
    ) {
      handleGroupCommand(
        contextPayload.whatsappId,
        contextPayload.groupContact?.number || contactPayload.number,
        processedMessage.body.trim(),
        contactPayload.number
      ).catch(err => {
        logger.error({ info: "BotCajero - Group / command error", error: (err as Error).message });
      });
    }

    // 3.5 Group commands — detect @bot mentions
    if (
      contactPayload.isGroup &&
      !processedMessage.fromMe &&
      processedMessage.mentionedJid &&
      processedMessage.mentionedJid.length > 0
    ) {
      try {
        const wbot = getWbot(contextPayload.whatsappId);
        const botJid = (wbot.user?.id || "").replace(/:[0-9]+/, "");
        const isBotMentioned = processedMessage.mentionedJid.some(
          jid => jid.replace(/:[0-9]+/, "") === botJid
        );
        if (isBotMentioned && processedMessage.body) {
          const grpJid2 = contextPayload.groupContact?.number
            ? contextPayload.groupContact.number + "@g.us"
            : contactPayload.number;
          await handleGroupCommand(
            contextPayload.whatsappId,
            grpJid2,
            processedMessage.body,
            contactPayload.number
          );
        }
      } catch (err) {
        logger.error({
          info: "BotCajero - Group command error",
          error: (err as Error).message
        });
      }
    }

    await processVcardMessage(processedMessage);
  } catch (err) {
    Sentry.captureException(err);
    logger.error({
      info: "Error handling message",
      err,
      messagePayload,
      contactPayload,
      contextPayload,
      mediaPayload
    });
  }
};

export const handleMessageAck = async (
  messageId: string,
  ack: MessageAck
): Promise<void> => {
  // Message ack tracking removed — feature not needed for FlowBot
  logger.debug(`Message ack received: ${messageId} ack=${ack}`);
};
