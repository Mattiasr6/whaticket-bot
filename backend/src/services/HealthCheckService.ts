import sequelize from "../database";
import { getRedisClient } from "../libs/redisStore";
import { backupQueue, provisioningQueue } from "../lib/queue";
import Whatsapp from "../models/Whatsapp";
import Message from "../models/Message";
import { logger } from "../utils/logger";

export interface HealthCheckResult {
  name: string;
  status: "ok" | "warning" | "error";
  latency?: string;
  detail?: string;
  connections?: { connected: number; disconnected: number; other: number };
}

export interface HealthReport {
  status: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheckResult[];
  uptime: number;
  version: string;
}

const startTime = Date.now();

async function checkMysql(): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    await sequelize.query("SELECT 1");
    const latency = Date.now() - t0;
    return { name: "mysql", status: "ok", latency: `${latency}ms` };
  } catch (err) {
    const latency = Date.now() - t0;
    logger.error({ err }, "MySQL health check failed");
    return {
      name: "mysql",
      status: "error",
      latency: `${latency}ms`,
      detail: (err as Error).message
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    const client = getRedisClient();
    if (!client) {
      return {
        name: "redis",
        status: "warning",
        detail: "Redis client not initialized"
      };
    }
    await client.ping();
    const latency = Date.now() - t0;
    return { name: "redis", status: "ok", latency: `${latency}ms` };
  } catch (err) {
    const latency = Date.now() - t0;
    logger.error({ err }, "Redis health check failed");
    return {
      name: "redis",
      status: "error",
      latency: `${latency}ms`,
      detail: (err as Error).message
    };
  }
}

async function checkBullQueues(): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    const [backupCounts, provisioningCounts] = await Promise.all([
      backupQueue.getJobCounts(),
      provisioningQueue.getJobCounts()
    ]);

    const totalWaiting =
      backupCounts.waiting + provisioningCounts.waiting;
    const totalActive =
      backupCounts.active + provisioningCounts.active;
    const totalFailed =
      backupCounts.failed + provisioningCounts.failed;

    const latency = Date.now() - t0;
    const detail = [
      `backups: ${backupCounts.waiting} waiting, ${backupCounts.active} active`,
      `provisioning: ${provisioningCounts.waiting} waiting, ${provisioningCounts.active} active`
    ].join(" | ");

    const status = totalFailed > 10 ? "warning" : "ok";

    return {
      name: "bull_queues",
      status,
      latency: `${latency}ms`,
      detail
    };
  } catch (err) {
    const latency = Date.now() - t0;
    return {
      name: "bull_queues",
      status: "error",
      latency: `${latency}ms`,
      detail: (err as Error).message
    };
  }
}

async function checkWhatsApp(): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    const all = await Whatsapp.findAll({
      attributes: ["id", "name", "status"]
    });

    const connected = all.filter(w => w.status === "CONNECTED").length;
    const disconnected = all.filter(
      w => w.status === "DISCONNECTED" || w.status === "OPENING"
    ).length;
    const other = all.length - connected - disconnected;

    const latency = Date.now() - t0;
    const status =
      connected > 0
        ? "ok"
        : all.length === 0
          ? "warning"
          : "error";

    return {
      name: "whatsapp",
      status,
      latency: `${latency}ms`,
      connections: { connected, disconnected, other }
    };
  } catch (err) {
    const latency = Date.now() - t0;
    return {
      name: "whatsapp",
      status: "error",
      latency: `${latency}ms`,
      detail: (err as Error).message
    };
  }
}

async function checkLastMessage(): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    const last = await Message.findOne({
      order: [["createdAt", "DESC"]],
      attributes: ["createdAt"]
    });

    const latency = Date.now() - t0;

    if (!last) {
      return {
        name: "last_message",
        status: "warning",
        latency: `${latency}ms`,
        detail: "No messages found in database"
      };
    }

    const minutesAgo = Math.floor(
      (Date.now() - last.createdAt.getTime()) / 60000
    );

    let status: "ok" | "warning" | "error" = "ok";
    let detail = `Last message ${minutesAgo} minutes ago`;

    if (minutesAgo > 30) {
      status = "error";
      detail = `No messages in ${minutesAgo} minutes`;
    } else if (minutesAgo > 10) {
      status = "warning";
      detail = `No messages in ${minutesAgo} minutes`;
    }

    return { name: "last_message", status, latency: `${latency}ms`, detail };
  } catch (err) {
    const latency = Date.now() - t0;
    return {
      name: "last_message",
      status: "error",
      latency: `${latency}ms`,
      detail: (err as Error).message
    };
  }
}

export class HealthCheckService {
  async run(): Promise<HealthReport> {
    const checks = await Promise.all([
      checkMysql(),
      checkRedis(),
      checkBullQueues(),
      checkWhatsApp(),
      checkLastMessage()
    ]);

    const hasError = checks.some(c => c.status === "error");
    const hasWarning = checks.some(c => c.status === "warning");

    let status: "healthy" | "degraded" | "unhealthy";
    if (hasError) {
      status = "unhealthy";
    } else if (hasWarning) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return {
      status,
      checks,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || "1.0.0"
    };
  }
}
