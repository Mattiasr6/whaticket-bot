import { readFileSync } from "fs";
import path from "path";
import CronJob from "../../models/CronJob";
import { matchCron, getNextRun } from "../../utils/cronUtils";
import { getWbot } from "../../providers/WhatsApp/Implementations/whaileys";
import { logger } from "../../utils/logger";
import { decideCronAction } from "../AiAgentServices/AiAgentService";
import buildContext from "../AiAgentServices/AiAgentContextBuilder";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const getWbotSafe = (sessionId: number) => {
  try {
    const wbot = getWbot(sessionId);
    if (wbot?.user?.id) return wbot;
    return null;
  } catch {
    return null;
  }
};

const actions: Record<string, (job: CronJob) => Promise<boolean>> = {
  send_message: async (job) => {
    if (!job.whatsappId) return false;
    const wbot = getWbotSafe(job.whatsappId);
    if (!wbot) return false;

    const config = JSON.parse(job.config || "{}");
    const { toJid, text, mediaFile } = config;
    if (!toJid) return false;

    const videoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
    const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const mediaFiles: string[] = config.mediaFiles || (mediaFile ? [mediaFile] : []);

    if (mediaFiles.length > 0) {
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        const filePath = path.resolve(publicFolder, file);
        const buffer = readFileSync(filePath);
        const ext = path.extname(file).toLowerCase();
        const caption = i === 0 ? text || undefined : undefined;

        if (videoExts.includes(ext)) {
          await wbot.sendMessage(toJid, {
            video: buffer,
            caption,
            mimetype: "video/mp4"
          });
        } else if (imageExts.includes(ext)) {
          await wbot.sendMessage(toJid, {
            image: buffer,
            caption
          });
        } else {
          await wbot.sendMessage(toJid, {
            document: buffer,
            caption,
            fileName: file,
            mimetype: "application/octet-stream"
          });
        }
      }
    } else if (text) {
      await wbot.sendMessage(toJid, { text });
    }
    return true;
  },

  agent_decide: async (job) => {
    if (!job.whatsappId) return false;
    const config = JSON.parse(job.config || "{}");
    const context = await buildContext(job.whatsappId, {
      messageBody: "",
      fromJid: config.toJid || "",
      isGroup: Boolean(config.toJid?.includes("@g.us")),
      groupJid: config.toJid?.includes("@g.us") ? config.toJid : undefined
    });
    await decideCronAction(
      { jobName: job.name, actionType: job.actionType, config: job.config, whatsappId: job.whatsappId },
      context
    );
    return true;
  },
};

const RunCronJobsService = async () => {
  const now = new Date();
  now.setSeconds(0, 0);

  const jobs = await CronJob.findAll({ where: { enabled: true } });

  for (const job of jobs) {
    try {
      const lastRun = job.lastRunAt ? new Date(job.lastRunAt) : new Date(0);
      const minutesSinceLastRun = (now.getTime() - lastRun.getTime()) / 60000;

      if (minutesSinceLastRun < 1) continue;

      if (!matchCron(job.cronExpr, now)) continue;

      const handler = actions[job.actionType];
      if (!handler) {
        logger.warn({ info: "Unknown cron action", actionType: job.actionType, jobId: job.id });
        continue;
      }

      const ok = await handler(job);
      if (ok) {
        const next = getNextRun(job.cronExpr, now);
        await job.update({ lastRunAt: now, nextRunAt: next });
        logger.info({ info: "Cron job executed", jobId: job.id, name: job.name });
      }
    } catch (err: any) {
      logger.error({ info: "Cron job failed", jobId: job.id, name: job.name, error: err.message });
    }
  }
};

export default RunCronJobsService;
