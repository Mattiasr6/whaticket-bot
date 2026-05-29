import Queue from "bull";
import { logger } from "../utils/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const backupQueue = new Queue("backups", REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    priority: 1,
    removeOnComplete: true,
    removeOnFail: false
  }
});

export const provisioningQueue = new Queue("provisioning", REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    priority: 2,
    removeOnComplete: true,
    removeOnFail: false
  }
});

export const monitoringQueue = new Queue("monitoring", REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    priority: 3,
    removeOnComplete: true,
    removeOnFail: false
  }
});

backupQueue.on("error", (err: Error) => {
  logger.error({ info: "Backup queue error", err });
});

provisioningQueue.on("error", (err: Error) => {
  logger.error({ info: "Provisioning queue error", err });
});

monitoringQueue.on("error", (err: Error) => {
  logger.error({ info: "Monitoring queue error", err });
});
