/* eslint-disable no-restricted-syntax */
import AutoForward from "../../models/AutoForward";
import AutoForwardLog from "../../models/AutoForwardLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { logger } from "../../utils/logger";
import {
  getFromRedis,
  deleteFromRedis,
  getRedisClient
} from "../../libs/redisStore";
import ScanGroupImagesService, { ScannedImage } from "./ScanGroupImagesService";
import ExecuteForwardService from "./ExecuteForwardService";

const CONFIRM_WORDS = ["si", "sí", "s", "yes", "y"];

const CONFIRM_TTL = 120; // 120 seconds

function isConfirmation(text: string): boolean {
  return CONFIRM_WORDS.includes(text.trim().toLowerCase());
}

function normalizeNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

function formatTimestamp(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function sendMessage(
  whatsappId: number,
  toJid: string,
  text: string
): Promise<void> {
  try {
    await whatsappProvider.sendMessage(whatsappId, toJid, text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({
      info: "AutoForward sendMessage failed",
      whatsappId,
      to: toJid,
      error: msg
    });
  }
}

async function createLog(
  ruleId: number,
  adminNumber: string,
  imageCount: number,
  status: "success" | "no_images" | "cancelled" | "error",
  errorMessage?: string
): Promise<void> {
  try {
    await AutoForwardLog.create({
      autoForwardId: ruleId,
      adminNumber,
      imageCount,
      status,
      errorMessage: errorMessage || null,
      executedAt: new Date()
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ info: "AutoForward createLog failed", error: msg });
  }
}

async function handleHelp(
  whatsappId: number,
  fromNumber: string
): Promise<void> {
  const text =
    "📋 *Comandos disponibles*\n\n" +
    "• `/reenvio <nombre>` — Reenviar imágenes al grupo destino\n" +
    "• `/list` — Listar reglas disponibles\n" +
    "• `/help` — Mostrar esta ayuda";
  await sendMessage(whatsappId, fromNumber, text);
}

async function handleList(
  whatsappId: number,
  fromNumber: string
): Promise<void> {
  const adminDigits = normalizeNumber(
    fromNumber.replace(/@s\.whatsapp\.net$/, "")
  );

  const rules = await AutoForward.findAll({
    where: { whatsappId, enabled: true }
  });

  const accessible = rules.filter(r => {
    const admins = r.adminNumbers
      .split("\n")
      .map(a => a.trim())
      .filter(Boolean);
    return admins.includes(adminDigits);
  });

  if (accessible.length === 0) {
    await sendMessage(
      whatsappId,
      fromNumber,
      "No tienes reglas de reenvío disponibles."
    );
    return;
  }

  let text = "📋 *Reglas disponibles*\n\nEjecuta:\n`/reenvio <nombre>`\n\n";
  for (const rule of accessible) {
    text += `• *${rule.name}* → _${rule.targetGroupJid}_\n`;
  }
  await sendMessage(whatsappId, fromNumber, text);
}

async function handleReenvio(
  whatsappId: number,
  fromNumber: string,
  ruleName: string
): Promise<void> {
  const adminDigits = normalizeNumber(
    fromNumber.replace(/@s\.whatsapp\.net$/, "")
  );

  // Find rule
  const rule = await AutoForward.findOne({
    where: { name: ruleName, whatsappId, enabled: true }
  });

  if (!rule) {
    await sendMessage(
      whatsappId,
      fromNumber,
      "❌ Regla no encontrada. Usa /list para ver disponibles."
    );
    return;
  }

  // Check authorization
  const admins = rule.adminNumbers
    .split("\n")
    .map(a => a.trim())
    .filter(Boolean);

  if (!admins.includes(adminDigits)) {
    await sendMessage(
      whatsappId,
      fromNumber,
      "❌ No tienes permiso para ejecutar esta regla."
    );
    return;
  }

  // Scan group images
  const images = await ScanGroupImagesService(rule);

  if (images.length === 0) {
    await sendMessage(
      whatsappId,
      fromNumber,
      "📭 No se encontraron imágenes recientes en el grupo origen."
    );
    await createLog(rule.id, adminDigits, 0, "no_images");
    return;
  }

  // Build image list message
  let listText = `🔍 Buscando imágenes...\n\nSe encontraron *${images.length}* imágenes:\n`;
  images.forEach((img, idx) => {
    listText += `🖼️ ${idx + 1}. ${img.filename} — ${formatTimestamp(
      img.timestamp
    )}\n`;
  });

  const captionPreview = rule.customCaption
    ? `\n📝 Mensaje: "${rule.customCaption.substring(0, 50)}..."`
    : "";

  listText += `\n¿Reenviar estas *${images.length}* imágenes al grupo destino?\nEscribe 'si' para confirmar, o 'no' para cancelar.${captionPreview}`;

  await sendMessage(whatsappId, fromNumber, listText);

  // Save confirmation state in Redis (TTL 120s)
  const confirmKey = `autoforward:confirm:${adminDigits}`;
  const state = JSON.stringify({
    adminNumber: adminDigits,
    ruleId: rule.id,
    images
  });

  try {
    const client = getRedisClient();
    if (client) {
      await client.setex(confirmKey, CONFIRM_TTL, state);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({
      info: "AutoForward: failed to save confirmation state",
      error: msg
    });
  }
}

const HandlePrivateCommand = async (
  whatsappId: number,
  fromNumber: string,
  messageBody: string
): Promise<void> => {
  try {
    if (!messageBody) return;

    const adminDigits = normalizeNumber(
      fromNumber.replace(/@s\.whatsapp\.net$/, "")
    );

    // Check for active confirmation state
    const confirmKey = `autoforward:confirm:${adminDigits}`;
    const confirmRaw = await getFromRedis(confirmKey);

    if (confirmRaw) {
      await deleteFromRedis(confirmKey);

      if (isConfirmation(messageBody)) {
        // Execute forward
        let state: {
          ruleId: number;
          images: ScannedImage[];
          adminNumber: string;
        };
        try {
          state = JSON.parse(confirmRaw);
        } catch {
          await sendMessage(
            whatsappId,
            fromNumber,
            "❌ Error al procesar la confirmación. Intenta de nuevo con /reenvio."
          );
          return;
        }

        const rule = await AutoForward.findByPk(state.ruleId);
        if (!rule) {
          await sendMessage(
            whatsappId,
            fromNumber,
            "❌ La regla ya no existe. Usa /list para ver disponibles."
          );
          return;
        }

        const result = await ExecuteForwardService(
          rule,
          state.images,
          adminDigits
        );

        const timeSeconds = Math.round(result.totalTimeMs / 1000);
        await sendMessage(
          whatsappId,
          fromNumber,
          `✅ ¡Listo! ${result.count} imágenes reenviadas al grupo destino. ⏱️ Tiempo total: ${timeSeconds} segundos.`
        );
      } else {
        // Cancel
        await sendMessage(whatsappId, fromNumber, "❌ Reenvío cancelado.");

        let state: { ruleId: number } = { ruleId: 0 };
        try {
          state = JSON.parse(confirmRaw);
        } catch {
          // ignore
        }
        if (state.ruleId) {
          await createLog(state.ruleId, adminDigits, 0, "cancelled");
        }
      }
      return;
    }

    // No pending confirmation — process as new command
    if (messageBody === "/help") {
      await handleHelp(whatsappId, fromNumber);
      return;
    }

    if (messageBody === "/list") {
      await handleList(whatsappId, fromNumber);
      return;
    }

    if (messageBody.startsWith("/reenvio ")) {
      const ruleName = messageBody.slice("/reenvio ".length).trim();
      if (!ruleName) {
        await sendMessage(
          whatsappId,
          fromNumber,
          "❌ Usa: /reenvio <nombre>. Ejemplo: /reenvio artes-diarios"
        );
        return;
      }
      await handleReenvio(whatsappId, fromNumber, ruleName);
      return;
    }

    if (messageBody.startsWith("/")) {
      // Unknown command
      await handleHelp(whatsappId, fromNumber);
      return;
    }

    // If message looks like a confirmation but no state in Redis → expired
    if (
      isConfirmation(messageBody) ||
      ["no", "n", "cancelar"].includes(messageBody.trim().toLowerCase())
    ) {
      await sendMessage(
        whatsappId,
        fromNumber,
        "⏱️ La solicitud expiró. Enviá /reenvio <nombre> de nuevo."
      );
      return;
    }

    // Not a command — ignore
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({
      info: "HandlePrivateCommand error",
      whatsappId,
      fromNumber,
      error: msg
    });
  }
};

export default HandlePrivateCommand;
