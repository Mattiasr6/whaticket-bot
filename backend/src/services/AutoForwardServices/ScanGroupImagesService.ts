/* eslint-disable no-plusplus */
import AutoForward from "../../models/AutoForward";
import MessageBuffer, { BufferMessage } from "./MessageBuffer";
import { logger } from "../../utils/logger";

export interface ScannedImage {
  id: string;
  filename: string;
  mimetype: string;
  messageId: string;
  timestamp: number;
  caption?: string;
}

const ScanGroupImagesService = async (
  rule: AutoForward
): Promise<ScannedImage[]> => {
  const bufferMessages = await MessageBuffer.getMessages(
    rule.whatsappId,
    rule.sourceGroupJid
  );

  if (bufferMessages.length === 0) {
    logger.info({
      info: "ScanGroupImages: empty buffer",
      ruleId: rule.id,
      name: rule.name
    });
    return [];
  }

  // Filter only images with media
  const images = bufferMessages.filter(
    (m: BufferMessage) => m.type === "image" && m.hasMedia && m.messageId
  );

  if (images.length === 0) {
    logger.info({
      info: "ScanGroupImages: no images in buffer",
      ruleId: rule.id,
      name: rule.name
    });
    return [];
  }

  // Sort by timestamp DESC (most recent first)
  images.sort(
    (a: BufferMessage, b: BufferMessage) => b.timestamp - a.timestamp
  );

  // Temporal clustering: start from the most recent image,
  // gather while gap <= timeWindowMinutes
  const cluster: BufferMessage[] = [images[0]];

  for (let i = 1; i < images.length; i++) {
    const gapMinutes = (images[0].timestamp - images[i].timestamp) / 60000;
    if (gapMinutes <= rule.timeWindowMinutes) {
      cluster.push(images[i]);
    } else {
      break;
    }
  }

  // Limit to maxForward
  const limited = cluster.slice(0, rule.maxForward);

  logger.info({
    info: "ScanGroupImages: cluster found",
    ruleId: rule.id,
    name: rule.name,
    totalInCluster: cluster.length,
    willForward: limited.length,
    timeWindowMinutes: rule.timeWindowMinutes
  });

  // Convert to ScannedImage[]
  return limited.map((m: BufferMessage) => {
    const filename = `image-${m.timestamp}.jpg`;
    return {
      id: m.id,
      filename,
      mimetype: "image/jpeg",
      messageId: m.messageId || m.id,
      timestamp: m.timestamp,
      caption: m.body
    };
  });
};

export default ScanGroupImagesService;
