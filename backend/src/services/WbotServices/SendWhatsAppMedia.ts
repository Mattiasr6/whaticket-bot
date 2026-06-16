import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";
import formatBody from "../../helpers/Mustache";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const MIME_MAP: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<ProviderMessage> => {
  try {
    if (!ticket.whatsappId) {
      throw new AppError("ERR_TICKET_NO_WHATSAPP");
    }

    const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

    const hasBody = body
      ? formatBody(body as string, ticket.contact)
      : undefined;

    // Fix mimetype by extension if multer misdetected it
    const ext = path.extname(media.filename).toLowerCase();
    const fixedMimetype = MIME_MAP[ext] || media.mimetype;

    const mediaInput = {
      filename: media.filename,
      mimetype: fixedMimetype,
      path: media.path
    };

    const mediaOptions = {
      caption: hasBody,
      sendAudioAsVoice: true,
      sendMediaAsDocument: false
    };

    const sentMessage = await whatsappProvider.sendMedia(
      ticket.whatsappId,
      chatId,
      mediaInput,
      mediaOptions
    );

    await ticket.update({ lastMessage: body || media.filename });

    fs.unlinkSync(media.path);

    return sentMessage;
  } catch (err) {
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
