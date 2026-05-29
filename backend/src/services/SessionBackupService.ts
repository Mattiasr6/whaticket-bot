import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { format } from "date-fns";
import Whatsapp from "../models/Whatsapp";
import { getRedisClient } from "../libs/redisStore";
import { logger } from "../utils/logger";

interface BackupSessionEntry {
  id: number;
  name: string;
  session: string;
  status: string;
}

interface SessionBackupPayload {
  metadata: {
    version: number;
    baileysVersion: string;
    backedUpAt: string;
    tenantId: string;
  };
  sessions: BackupSessionEntry[];
  redisKeys: Record<string, string>;
}

function getS3Config() {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const region = process.env.BACKUP_S3_REGION || "us-east-1";
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_KEY;
  const bucket = process.env.BACKUP_S3_BUCKET;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Missing S3 backup configuration: BACKUP_S3_ENDPOINT, BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY, BACKUP_S3_BUCKET"
    );
  }

  return { endpoint, region, accessKeyId, secretAccessKey, bucket };
}

function getS3Client(): S3Client {
  const { endpoint, region, accessKeyId, secretAccessKey } = getS3Config();
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true
  });
}

function getTenantId(): string {
  return process.env.BACKUP_TENANT_ID || "default";
}

function getBaileysVersion(): string {
  return process.env.WA_SOCKET_VERSION || "unknown";
}

async function scanRedisKeys(pattern: string): Promise<Record<string, string>> {
  const client = getRedisClient();
  if (!client) {
    logger.warn("Redis client not available, skipping Redis key backup");
    return {};
  }

  const result: Record<string, string> = {};
  let cursor = "0";

  do {
    const scanResult = await client.scan(cursor, "MATCH", pattern, "COUNT", 200);
    cursor = scanResult[0];
    const keys = scanResult[1];

    if (keys.length > 0) {
      const values = await client.mget(...keys);
      for (let i = 0; i < keys.length; i++) {
        if (values[i] !== null) {
          result[keys[i]] = values[i] as string;
        }
      }
    }
  } while (cursor !== "0");

  return result;
}

export class SessionBackupService {
  async execute(): Promise<{ key: string; size: number }> {
    const { bucket } = getS3Config();
    const client = getS3Client();
    const tenantId = getTenantId();
    const now = new Date();

    logger.info({ tenantId }, "Starting session backup");

    const sessions = await Whatsapp.findAll({
      where: {
        status: "CONNECTED"
      },
      attributes: ["id", "name", "session", "status"]
    });

    const sessionsWithData = sessions.filter(s => s.session && s.session.trim().length > 0);

    const sessionEntries: BackupSessionEntry[] = sessionsWithData.map(s => ({
      id: s.id,
      name: s.name,
      session: s.session,
      status: s.status
    }));

    logger.info({ count: sessionEntries.length }, "Sessions loaded from DB");

    const redisKeys = await scanRedisKeys("wpp:*");
    logger.info({ count: Object.keys(redisKeys).length }, "Redis keys scanned");

    const payload: SessionBackupPayload = {
      metadata: {
        version: 1,
        baileysVersion: getBaileysVersion(),
        backedUpAt: now.toISOString(),
        tenantId
      },
      sessions: sessionEntries,
      redisKeys
    };

    const dateStr = format(now, "yyyy-MM-dd");
    const timeStr = format(now, "HH-mm");
    const key = `backups/sessions/${tenantId}/${dateStr}/${timeStr}-session.json`;

    const body = JSON.stringify(payload, null, 2);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        ServerSideEncryption: "AES256"
      })
    );

    const size = Buffer.byteLength(body, "utf8");
    logger.info({ key, sizeBytes: size }, "Session backup uploaded to S3");

    return { key, size };
  }
}

export async function listBackups(): Promise<string[]> {
  const { bucket } = getS3Config();
  const client = getS3Client();
  const tenantId = getTenantId();
  const prefix = `backups/sessions/${tenantId}/`;

  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    });

    const response = await client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) keys.push(obj.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys.sort().reverse();
}

export async function getBackupObject(
  key: string
): Promise<SessionBackupPayload> {
  const { bucket } = getS3Config();
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });

  const response = await client.send(command);
  const body = await response.Body?.transformToString();

  if (!body) {
    throw new Error(`Empty backup object: ${key}`);
  }

  return JSON.parse(body) as SessionBackupPayload;
}

export async function findLatestBackup(): Promise<{
  key: string;
  payload: SessionBackupPayload;
} | null> {
  const keys = await listBackups();

  if (keys.length === 0) {
    return null;
  }

  const latestKey = keys[0];
  const payload = await getBackupObject(latestKey);

  return { key: latestKey, payload };
}
