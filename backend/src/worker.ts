import "./bootstrap";
import { backupQueue, provisioningQueue, monitoringQueue } from "./lib/queue";
import { logger } from "./utils/logger";
import { Job } from "bull";
import { SessionBackupService } from "./services/SessionBackupService";
import { HealthCheckService, HealthReport } from "./services/HealthCheckService";
import {
  dispatchAlert,
  wasAlertRecentlySent,
  markAlertSent
} from "./services/NotificationService";

logger.info("Bull worker started");

backupQueue.process(async (job: Job) => {
  const { type } = job.data;

  if (type === "backup-sessions") {
    logger.info({ jobId: job.id }, "Processing scheduled session backup");
    const service = new SessionBackupService();
    await service.execute();
    logger.info({ jobId: job.id }, "Scheduled session backup completed");
  } else {
    logger.info({ jobId: job.id, data: job.data }, "Processing backup job");
  }
});

provisioningQueue.process(async (job: Job) => {
  logger.info(
    { jobId: job.id, data: job.data },
    "Processing provisioning job"
  );
});

monitoringQueue.process(async (job: Job) => {
  const { type } = job.data;

  if (type === "health-check") {
    logger.info({ jobId: job.id }, "Running health check");

    const healthService = new HealthCheckService();
    const report: HealthReport = await healthService.run();

    logger.info(
      { status: report.status, checks: report.checks.map(c => `${c.name}=${c.status}`) },
      "Health check completed"
    );

    if (report.status === "unhealthy" || report.status === "degraded") {
      await evaluateAndAlert(report);
    }
  }
});

async function evaluateAndAlert(report: HealthReport): Promise<void> {
  const errorChecks = report.checks.filter(c => c.status === "error");
  const warningChecks = report.checks.filter(c => c.status === "warning");

  for (const check of errorChecks) {
    const alertKey = `health:${check.name}:error`;
    const alreadySent = await wasAlertRecentlySent(alertKey);
    if (alreadySent) continue;

    await dispatchAlert({
      tenantName: process.env.TENANT_NAME || "CardioSalud",
      severity: "critical",
      summary: `Bot caído - ${check.name} no responde`,
      details: check.detail || `${check.name} check failed with latency ${check.latency}`
    });

    await markAlertSent(alertKey);
  }

  for (const check of warningChecks) {
    const alertKey = `health:${check.name}:warning`;
    const alreadySent = await wasAlertRecentlySent(alertKey);
    if (alreadySent) continue;

    await dispatchAlert({
      tenantName: process.env.TENANT_NAME || "CardioSalud",
      severity: "warning",
      summary: `${check.name}: ${check.detail || "check degradado"}`,
      details: `Latencia: ${check.latency}`
    });

    await markAlertSent(alertKey);
  }
}

async function scheduleRecurringJobs(): Promise<void> {
  const backupInterval = parseInt(process.env.BACKUP_INTERVAL_MIN || "15", 10);
  const healthInterval = parseInt(
    process.env.HEALTH_CHECK_INTERVAL_MIN || "5",
    10
  );

  const existingBackupJobs = await backupQueue.getRepeatableJobs();
  if (!existingBackupJobs.some(j => j.id === "backup-sessions-recurring")) {
    await backupQueue.add(
      { type: "backup-sessions" },
      {
        repeat: { every: backupInterval * 60 * 1000 },
        jobId: "backup-sessions-recurring",
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    logger.info({ intervalMin: backupInterval }, "Recurring session backup scheduled");
  }

  const existingMonitoringJobs = await monitoringQueue.getRepeatableJobs();
  if (!existingMonitoringJobs.some(j => j.id === "health-check-recurring")) {
    await monitoringQueue.add(
      { type: "health-check" },
      {
        repeat: { every: healthInterval * 60 * 1000 },
        jobId: "health-check-recurring",
        attempts: 2,
        backoff: { type: "fixed", delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    logger.info({ intervalMin: healthInterval }, "Recurring health check scheduled");
  }
}

scheduleRecurringJobs().catch(err => {
  logger.error({ err }, "Failed to schedule recurring jobs");
});

process.on("SIGTERM", async () => {
  logger.info("Worker shutting down...");
  await backupQueue.close();
  await provisioningQueue.close();
  await monitoringQueue.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Worker shutting down...");
  await backupQueue.close();
  await provisioningQueue.close();
  await monitoringQueue.close();
  process.exit(0);
});
