import { getRedisClient } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

export interface BufferMessage {
  id: string;
  timestamp: number;
  type: string;
  hasMedia: boolean;
  messageId?: string;
  body?: string;
}

const BUFFER_TTL = 3600; // 1 hour
const MAX_ITEMS = 50;

const redisKey = (whatsappId: number, groupJid: string): string =>
  `autoforward:buffer:${whatsappId}:${groupJid}`;

class MessageBuffer {
  static async add(
    whatsappId: number,
    groupJid: string,
    message: BufferMessage
  ): Promise<void> {
    const client = getRedisClient();
    if (!client) return;

    const key = redisKey(whatsappId, groupJid);

    try {
      const multi = client.multi();
      multi.lpush(key, JSON.stringify(message));
      multi.ltrim(key, 0, MAX_ITEMS - 1);
      multi.expire(key, BUFFER_TTL);
      await multi.exec();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error({ info: "MessageBuffer.add failed", key, error: msg });
    }
  }

  static async getMessages(
    whatsappId: number,
    groupJid: string
  ): Promise<BufferMessage[]> {
    const client = getRedisClient();
    if (!client) return [];

    const key = redisKey(whatsappId, groupJid);

    try {
      const raw = await client.lrange(key, 0, MAX_ITEMS - 1);
      return raw
        .map(item => {
          try {
            return JSON.parse(item) as BufferMessage;
          } catch {
            return null;
          }
        })
        .filter((item): item is BufferMessage => item !== null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error({
        info: "MessageBuffer.getMessages failed",
        key,
        error: msg
      });
      return [];
    }
  }

  static async clear(whatsappId: number, groupJid: string): Promise<void> {
    const client = getRedisClient();
    if (!client) return;

    const key = redisKey(whatsappId, groupJid);

    try {
      await client.del(key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error({ info: "MessageBuffer.clear failed", key, error: msg });
    }
  }
}

export default MessageBuffer;
