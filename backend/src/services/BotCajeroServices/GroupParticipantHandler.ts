/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { readFile } from "fs/promises";
import { getWbot } from "../../providers/WhatsApp/Implementations/whaileys";
import BotCajeroLog from "../../models/BotCajeroLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { logger } from "../../utils/logger";
import GetConfigService from "./GetConfigService";
import { humanDelay } from "./HumanDelay";

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const handleGroupParticipantUpdate = async (
  whatsappId: number,
  groupJid: string,
  participants: (string | { id: string })[],
  action: "add" | "remove" | "promote" | "demote"
): Promise<void> => {
  try {
    if (action !== "add" && action !== "remove") return;

    const config = await GetConfigService(whatsappId);

    // 🔒 HARDCODED LOCK
    const HARD_CODED_GROUP = "120363426709880780@g.us";
    if (config.groupJid !== HARD_CODED_GROUP) return;
    if (config.groupJid !== groupJid) return;

    const stickers: any[] = (config as any).stickers || [];

    for (let i = 0; i < participants.length; i++) {
      const raw = participants[i];
      // Extract JID correctly (string or {id: string})
      const participantJid =
        typeof raw === "string" ? raw : (raw as any).id || String(raw);
      const displayName = participantJid.split("@")[0] || "Usuario";

      if (action === "add") {
        if (!config.welcomeEnabled) continue;

        // Prepare welcome message with @mention
        const welcomeMsg = (
          config.welcomeMessage ||
          "🎉 ¡Bienvenido @{{name}} al grupo {{groupName}}!\n\nLee las reglas en tu privado 📩"
        )
          .replace("{{name}}", displayName)
          .replace("{{groupName}}", config.groupName || groupJid);

        // Simular demora humana antes de responder
        await humanDelay();

        // Execute all ops in parallel
        const wbotWelcome = getWbot(whatsappId);
        const ops: Promise<unknown>[] = [
          wbotWelcome
            .sendMessage(groupJid, {
              text: welcomeMsg,
              mentions: [participantJid]
            })
            .catch(err => {
              logger.error({
                info: "BotCajero - Welcome message failed",
                error: (err as Error).message
              });
            })
        ];

        // Send sticker if available (use first = most recently saved)
        if (stickers.length > 0) {
          const welcomeSticker = stickers[0];
          ops.push(
            (async () => {
              try {
                const stickerBuffer = await readFile(welcomeSticker.mediaPath);
                await wbotWelcome.sendMessage(groupJid, { sticker: stickerBuffer });
              } catch (stickerErr) {
                logger.error({
                  info: "BotCajero - Error sending welcome sticker",
                  error: (stickerErr as Error).message
                });
              }
            })()
          );
        }

        // Send rules in private to the new participant
        if (config.rules && config.rules.trim()) {
          const rulesMsg = `📜 Reglas de ${config.groupName || groupJid}:\n\n${config.rules}`;
          ops.push(
            whatsappProvider
              .sendMessage(whatsappId, participantJid, rulesMsg)
              .catch(err => {
                logger.error({
                  info: "BotCajero - Rules message failed",
                  error: (err as Error).message
                });
              })
          );
        }

        await Promise.all(ops);

        // Create log
        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "welcome",
          detail: `Bienvenida enviada a ${displayName} (${participantJid})`
        });
      }

      if (action === "remove") {
        if (!config.farewellEnabled) continue;

        // Simular demora humana antes de responder
        await humanDelay();

        const farewellMsg = (
          config.farewellMessage || "👋 {{name}} salió del grupo."
        ).replace("{{name}}", displayName);

        await whatsappProvider.sendMessage(whatsappId, groupJid, farewellMsg);

        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "farewell",
          detail: `Despedida enviada por salida de ${displayName} (${participantJid})`
        });
      }

      // 1s delay between participants
      if (i < participants.length - 1) {
        await delay(1000);
      }
    }
  } catch (err) {
    logger.error({
      info: "BotCajero - Group participant handler error",
      error: (err as Error).message
    });
  }
};

export { handleGroupParticipantUpdate };
