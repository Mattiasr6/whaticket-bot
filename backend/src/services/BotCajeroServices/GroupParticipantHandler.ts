/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { readFile } from "fs/promises";
import { getWbot } from "../../providers/WhatsApp/Implementations/whaileys";
import BotCajeroLog from "../../models/BotCajeroLog";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { logger } from "../../utils/logger";
import GetConfigService from "./GetConfigService";

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const handleGroupParticipantUpdate = async (
  whatsappId: number,
  groupJid: string,
  participants: string[],
  action: "add" | "remove" | "promote" | "demote"
): Promise<void> => {
  try {
    // Only handle add and remove actions
    if (action !== "add" && action !== "remove") return;

    const config = await GetConfigService(whatsappId);

    // Verify this config belongs to the right group
    if (config.groupJid !== groupJid) return;

    const stickers: any[] = (config as any).stickers || [];

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const name = participant.split("@")[0] || "Usuario";

      if (action === "add") {
        if (!config.welcomeEnabled) continue;

        // Prepare welcome message
        const welcomeMsg = (
          config.welcomeMessage ||
          "🎉 ¡Bienvenido {{name}} al grupo {{groupName}}!\n\nLee las reglas en tu privado 📩"
        )
          .replace("{{name}}", name)
          .replace("{{groupName}}", config.groupName || groupJid);

        // Prepare sticker if available
        let stickerPromise: Promise<void> = Promise.resolve();
        if (stickers.length > 0) {
          const randomSticker =
            stickers[Math.floor(Math.random() * stickers.length)];
          stickerPromise = (async () => {
            try {
              const wbot = getWbot(whatsappId);
              const stickerBuffer = await readFile(randomSticker.mediaPath);
              await wbot.sendMessage(groupJid, { sticker: stickerBuffer });
            } catch (stickerErr) {
              logger.error({
                info: "BotCajero - Error sending welcome sticker",
                error: (stickerErr as Error).message
              });
            }
          })();
        }

        // Execute all 3 ops in parallel (fire-and-forget with individual error handling)
        const ops: Promise<unknown>[] = [
          whatsappProvider
            .sendMessage(whatsappId, groupJid, welcomeMsg)
            .catch(err => {
              logger.error({
                info: "BotCajero - Welcome message failed",
                error: (err as Error).message
              });
            })
        ];

        if (stickers.length > 0) {
          const randomSticker =
            stickers[Math.floor(Math.random() * stickers.length)];
          ops.push(
            (async () => {
              try {
                const wbot = getWbot(whatsappId);
                const stickerBuffer = await readFile(randomSticker.mediaPath);
                await wbot.sendMessage(groupJid, { sticker: stickerBuffer });
              } catch (stickerErr) {
                logger.error({
                  info: "BotCajero - Error sending welcome sticker",
                  error: (stickerErr as Error).message
                });
              }
            })()
          );
        }

        if (config.rules && config.rules.trim()) {
          const rulesMsg = `📜 Reglas de ${config.groupName || groupJid}:\n\n${
            config.rules
          }`;
          ops.push(
            whatsappProvider
              .sendMessage(whatsappId, participant, rulesMsg)
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
          detail: `Bienvenida enviada a ${name} (${participant})`
        });
      }

      if (action === "remove") {
        if (!config.farewellEnabled) continue;

        const farewellMsg = (
          config.farewellMessage || "👋 {{name}} salió del grupo."
        ).replace("{{name}}", name);

        await whatsappProvider.sendMessage(whatsappId, groupJid, farewellMsg);

        // Create log
        await BotCajeroLog.create({
          botCajeroConfigId: config.id,
          eventType: "farewell",
          detail: `Despedida enviada por salida de ${name} (${participant})`
        });
      }

      // 1s delay between participants (avoid 429)
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
