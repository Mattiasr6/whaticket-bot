import { whatsappProvider } from "../providers/WhatsApp/whatsappProvider";
import Whatsapp from "../models/Whatsapp";
import { getRedisClient } from "../libs/redisStore";
import { logger } from "../utils/logger";

interface AlertPayload {
  tenantName: string;
  severity: "critical" | "warning";
  summary: string;
  details: string;
}

const DEDUP_PREFIX = "alert:dedup:";

function getTenantName(): string {
  return process.env.TENANT_NAME || process.env.BACKUP_TENANT_ID || "CardioSalud";
}

function severityEmoji(severity: "critical" | "warning"): string {
  return severity === "critical" ? "🔴" : "🟡";
}

function formatAlertMessage(payload: AlertPayload): string {
  const emoji = severityEmoji(payload.severity);
  return (
    `${emoji} [${payload.tenantName}] ${payload.summary}\n${payload.details}`
  );
}

export async function wasAlertRecentlySent(
  alertType: string
): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  const dedupMinutes = parseInt(process.env.ALERT_DEDUP_MINUTES || "30", 10);
  const key = `${DEDUP_PREFIX}${alertType}`;
  const lastSent = await client.get(key);

  if (lastSent) {
    const elapsed = (Date.now() - parseInt(lastSent, 10)) / 60000;
    if (elapsed < dedupMinutes) {
      logger.debug({ alertType, elapsedMinutes: Math.round(elapsed) }, "Alert deduplicated");
      return true;
    }
  }

  return false;
}

export async function markAlertSent(alertType: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  const key = `${DEDUP_PREFIX}${alertType}`;
  const dedupMinutes = parseInt(process.env.ALERT_DEDUP_MINUTES || "30", 10);
  const ttlSeconds = dedupMinutes * 60;

  await client.setex(key, ttlSeconds, String(Date.now()));
}

export class WhatsAppNotificationService {
  async send(payload: AlertPayload): Promise<boolean> {
    const alertNumber = process.env.ALERT_WHATSAPP_NUMBER;
    if (!alertNumber) {
      logger.warn("ALERT_WHATSAPP_NUMBER not configured, skipping WhatsApp alert");
      return false;
    }

    const sessionId = process.env.ALERT_WHATSAPP_SESSION_ID
      ? parseInt(process.env.ALERT_WHATSAPP_SESSION_ID, 10)
      : null;

    try {
      let targetSessionId = sessionId;

      if (!targetSessionId) {
        const defaultSession = await Whatsapp.findOne({
          where: { status: "CONNECTED" },
          order: [["id", "ASC"]]
        });

        if (!defaultSession) {
          logger.warn("No CONNECTED WhatsApp session available for alerts");
          return false;
        }
        targetSessionId = defaultSession.id;
      }

      const text = formatAlertMessage(payload);
      const jid = alertNumber.includes("@")
        ? alertNumber
        : `${alertNumber}@s.whatsapp.net`;

      await whatsappProvider.sendMessage(targetSessionId, jid, text);
      logger.info({ alertType: payload.summary, target: jid }, "WhatsApp alert sent");
      return true;
    } catch (err) {
      logger.error({ err, payload }, "Failed to send WhatsApp alert");
      return false;
    }
  }
}

export class TelegramNotificationService {
  async send(payload: AlertPayload): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!token || !chatId) {
      logger.warn(
        "TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not configured, skipping Telegram alert"
      );
      return false;
    }

    try {
      const text = formatAlertMessage(payload);
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_notification: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error({ status: response.status, body: errText }, "Telegram API error");
        return false;
      }

      logger.info({ chatId }, "Telegram alert sent");
      return true;
    } catch (err) {
      logger.error({ err, payload }, "Failed to send Telegram alert");
      return false;
    }
  }
}

export async function dispatchAlert(payload: AlertPayload): Promise<void> {
  const whatsappService = new WhatsAppNotificationService();
  const telegramService = new TelegramNotificationService();

  await Promise.all([
    whatsappService.send(payload).catch(err =>
      logger.error({ err }, "WhatsApp notification failed")
    ),
    telegramService.send(payload).catch(err =>
      logger.error({ err }, "Telegram notification failed")
    )
  ]);
}
