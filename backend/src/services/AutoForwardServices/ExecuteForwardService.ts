/* eslint-disable no-await-in-loop, no-plusplus */
import AutoForward from "../../models/AutoForward";
import AutoForwardLog from "../../models/AutoForwardLog";
import { ScannedImage } from "./ScanGroupImagesService";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { ProviderMediaInput } from "../../providers/WhatsApp/types";
import { logger } from "../../utils/logger";

interface ExecuteForwardResult {
  success: boolean;
  count: number;
  totalTimeMs: number;
}

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const ExecuteForwardService = async (
  rule: AutoForward,
  images: ScannedImage[],
  adminNumber: string
): Promise<ExecuteForwardResult> => {
  const startTime = Date.now();
  let forwardedCount = 0;
  let lastError: string | null = null;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];

    try {
      // Download image under demand using messageId
      const downloaded = await whatsappProvider.downloadMedia(
        rule.whatsappId,
        image.id
      );

      const mediaPayload: ProviderMediaInput = {
        filename: downloaded.filename,
        mimetype: downloaded.mimetype,
        data: downloaded.data
      };

      // Send with or without caption
      const caption =
        i === 0 && rule.customCaption ? rule.customCaption : undefined;

      await whatsappProvider.sendMedia(
        rule.whatsappId,
        rule.targetGroupJid,
        mediaPayload,
        caption ? { caption } : undefined
      );

      forwardedCount++;

      logger.info({
        info: "ExecuteForward: image forwarded",
        ruleId: rule.id,
        imageIndex: i,
        messageId: image.messageId
      });

      // Delay between forwards (except after the last one)
      if (i < images.length - 1) {
        await delay(rule.delayBetweenMs);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      lastError = msg;
      logger.error({
        info: "ExecuteForward: image forward failed",
        ruleId: rule.id,
        imageIndex: i,
        messageId: image.messageId,
        error: msg
      });
    }
  }

  const totalTimeMs = Date.now() - startTime;

  // Create log entry
  if (forwardedCount > 0) {
    await AutoForwardLog.create({
      autoForwardId: rule.id,
      adminNumber,
      imageCount: forwardedCount,
      status: "success",
      errorMessage: lastError,
      executedAt: new Date()
    });
  } else {
    await AutoForwardLog.create({
      autoForwardId: rule.id,
      adminNumber,
      imageCount: 0,
      status: "error",
      errorMessage: lastError || "All forwards failed",
      executedAt: new Date()
    });
  }

  return {
    success: forwardedCount > 0,
    count: forwardedCount,
    totalTimeMs
  };
};

export default ExecuteForwardService;
