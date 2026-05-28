import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { initRedis } from "./libs/redisStore";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import RunCronJobsService from "./services/CronJobServices/RunCronJobsService";
import BotCajeroConfig from "./models/BotCajeroConfig";
import { checkInactivity } from "./services/BotCajeroServices/InactivityReminderService";
import { processPendingReminders } from "./services/BotCajeroServices/ReminderService";
import { sendDailySummary } from "./services/BotCajeroServices/AdminAlertService";
import { runTrackingCycle } from "./services/BotCajeroServices/FootballScheduler";

const SCHEDULER_INTERVAL = 60_000;

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
});

initIO(server);
initRedis();
StartAllWhatsAppsSessions();

setInterval(() => {
  RunCronJobsService().catch(err => {
    logger.error({ info: "Cron job scheduler error", error: err });
  });
}, SCHEDULER_INTERVAL);

// BotCajero - Inactivity reminder every 30 minutes
setInterval(async () => {
  try {
    const configs = (await BotCajeroConfig.findAll({ where: { autoReplyEnabled: true } }))
      .filter(c => c.groupJid === "120363426709880780@g.us"); // 🔒 solo grupo demo
    for (const config of configs) {
      try {
        await checkInactivity(config.whatsappId, config.groupJid);
      } catch (err) {
        logger.error({ info: "BotCajero - Inactivity check error", error: (err as Error).message });
      }
    }
  } catch (err) {
    logger.error({ info: "BotCajero - Error loading configs for inactivity check", error: (err as Error).message });
  }
}, 30 * 60 * 1000);

// BotCajero - Check pending reminders every 30 seconds
setInterval(() => {
  processPendingReminders().catch(err => {
    logger.error({ info: "BotCajero - Reminder scheduler error", error: err });
  });
}, 30 * 1000);

// BotCajero - Daily summary at 20:00
const scheduleDailySummary = async () => {
  try {
    const configs = (await BotCajeroConfig.findAll({
      where: { autoReplyEnabled: true }
    })).filter(c => c.groupJid === "120363426709880780@g.us"); // 🔒 solo grupo demo
    for (const config of configs) {
      try {
        await sendDailySummary(config);
      } catch (err) {
        logger.error({
          info: "BotCajero - Daily summary error",
          error: (err as Error).message
        });
      }
    }
  } catch (err) {
    logger.error({
      info: "BotCajero - Error loading configs for daily summary",
      error: (err as Error).message
    });
  }
};

const now = new Date();
const target = new Date(now);
target.setHours(20, 0, 0, 0);
if (target <= now) target.setDate(target.getDate() + 1);
const initialDelay = target.getTime() - now.getTime();

setTimeout(() => {
  scheduleDailySummary();
  setInterval(scheduleDailySummary, 24 * 60 * 60 * 1000);
}, initialDelay);

// BotCajero - Daily fixture push at 21:00
const scheduleDailyFixtures = async () => {
  const { getTomorrowFixtures, formatFixturesByLeague } = await import(
    "./services/BotCajeroServices/FootballApiService"
  );
  const BotCajeroConfig = (await import("./models/BotCajeroConfig")).default;
  const { whatsappProvider } = await import(
    "./providers/WhatsApp/whatsappProvider"
  );
  try {
    const fixtures = await getTomorrowFixtures();
    if (fixtures.length === 0) return;
    const text = `📋 *PARTIDOS DE MAÑANA*\n\n${formatFixturesByLeague(fixtures)}`;
    const configs = (await BotCajeroConfig.findAll({
      where: { autoReplyEnabled: true }
    })).filter(c => c.groupJid === "120363426709880780@g.us"); // 🔒 solo grupo demo
    for (const config of configs) {
      try {
        const adminJid = config.adminNumber
          ? `${config.adminNumber}@s.whatsapp.net`
          : null;
        if (config.groupJid) {
          await whatsappProvider.sendMessage(config.whatsappId, config.groupJid, text);
        }
        if (adminJid) {
          await whatsappProvider.sendMessage(config.whatsappId, adminJid, text);
        }
      } catch (err) {
        logger.error({
          info: "BotCajero - Daily fixture push error",
          whatsappId: config.whatsappId,
          error: err
        });
      }
    }
  } catch (err) {
    logger.error({
      info: "BotCajero - Daily fixtures error",
      error: err
    });
  }
};

const fixtureNow = new Date();
const fixtureTarget = new Date(fixtureNow);
fixtureTarget.setHours(21, 0, 0, 0);
if (fixtureTarget <= fixtureNow) fixtureTarget.setDate(fixtureTarget.getDate() + 1);
const fixtureDelay = fixtureTarget.getTime() - fixtureNow.getTime();
setTimeout(() => {
  scheduleDailyFixtures();
  setInterval(scheduleDailyFixtures, 24 * 60 * 60 * 1000);
}, fixtureDelay);

// BotCajero - Live football tracking every 5 minutes
setInterval(() => {
  runTrackingCycle().catch(err => {
    logger.error({
      info: "BotCajero - Tracking cycle error",
      error: (err as Error).message
    });
  });
}, 5 * 60 * 1000);

gracefulShutdown(server);

process.on("uncaughtException", err => {
  logger.error({ info: "Global uncaught exception", err });
});

process.on("unhandledRejection", err => {
  if (err) logger.error({ info: "Global unhandled rejection", err });
});
