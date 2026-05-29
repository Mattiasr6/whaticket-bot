import Whatsapp from "../models/Whatsapp";
import { getRedisClient, setInRedis } from "../libs/redisStore";
import { logger } from "../utils/logger";
import { findLatestBackup, getBackupObject, listBackups } from "./SessionBackupService";

export class SessionRestoreService {
  async restoreLatest(): Promise<{
    sessionsRestored: number;
    redisKeysRestored: number;
    baileysVersion: string;
  }> {
    const latest = await findLatestBackup();

    if (!latest) {
      throw new Error("No backups found to restore");
    }

    return this.restoreFromPayload(latest.payload, latest.key);
  }

  async restoreFromKey(backupKey: string): Promise<{
    sessionsRestored: number;
    redisKeysRestored: number;
    baileysVersion: string;
  }> {
    const payload = await getBackupObject(backupKey);
    return this.restoreFromPayload(payload, backupKey);
  }

  private async restoreFromPayload(
    payload: any,
    backupKey: string
  ): Promise<{
    sessionsRestored: number;
    redisKeysRestored: number;
    baileysVersion: string;
  }> {
    const { metadata, sessions, redisKeys } = payload;

    logger.info(
      { backupKey, backedUpAt: metadata.backedUpAt },
      "Starting session restore"
    );

    const currentVersion = process.env.WA_SOCKET_VERSION || "unknown";
    if (
      metadata.baileysVersion !== "unknown" &&
      currentVersion !== "unknown" &&
      metadata.baileysVersion !== currentVersion
    ) {
      logger.warn(
        {
          backupVersion: metadata.baileysVersion,
          currentVersion
        },
        "Baileys version mismatch during restore"
      );
    }

    let sessionsRestored = 0;
    for (const sessionEntry of sessions) {
      try {
        await Whatsapp.update(
          { session: sessionEntry.session },
          { where: { id: sessionEntry.id } }
        );
        sessionsRestored++;
        logger.debug(
          { sessionId: sessionEntry.id, name: sessionEntry.name },
          "Session restored in DB"
        );
      } catch (err) {
        logger.error(
          {
            sessionId: sessionEntry.id,
            name: sessionEntry.name,
            err
          },
          "Failed to restore session in DB"
        );
      }
    }

    let redisKeysRestored = 0;
    const redisClient = getRedisClient();

    if (redisClient && redisKeys) {
      for (const [key, value] of Object.entries(redisKeys)) {
        try {
          await setInRedis(key, value as string);
          redisKeysRestored++;
        } catch (err) {
          logger.error({ key, err }, "Failed to restore Redis key");
        }
      }
    }

    logger.info(
      { sessionsRestored, redisKeysRestored },
      "Session restore completed"
    );

    return {
      sessionsRestored,
      redisKeysRestored,
      baileysVersion: metadata.baileysVersion
    };
  }

  async listBackups(): Promise<string[]> {
    return listBackups();
  }
}
