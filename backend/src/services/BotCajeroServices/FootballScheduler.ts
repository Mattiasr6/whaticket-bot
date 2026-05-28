/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { Op } from "sequelize";
import BotCajeroConfig from "../../models/BotCajeroConfig";
import BotCajeroPrediction from "../../models/BotCajeroPrediction";
import {
  getLiveFixtures,
  getFixtureById,
  getFixtureStats
} from "./FootballApiService";
import {
  closePredictionsByFixture,
  resolvePrediction,
  formatPredictionType
} from "./PredictionService";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";
import { getRedisClient } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

const ALERT_PREFIX = "botcajero:matchalert";
const alertKey = (fixtureId: number, event: string): string =>
  `${ALERT_PREFIX}:${fixtureId}:${event}`;

const getScore = (fixture: any): string => {
  const home = fixture.goals?.home ?? "?";
  const away = fixture.goals?.away ?? "?";
  return `${home}-${away}`;
};

const getRelevantStats = async (fixtureId: number): Promise<string> => {
  try {
    const stats = await getFixtureStats(fixtureId);
    if (!stats || stats.length === 0) return "";

    const lines: string[] = [];
    for (const teamStats of stats) {
      const team = teamStats.team?.name || "";
      const statistics = teamStats.statistics || [];

      for (const stat of statistics) {
        const type = stat.type || "";
        const value = stat.value ?? "0";

        if (
          [
            "Ball Possession",
            "Total Shots",
            "Shots on Goal",
            "Corner Kicks",
            "Shots insidebox",
            "Shots outsidebox",
            "Fouls",
            "Yellow Cards",
            "Red Cards",
            "Offsides"
          ].includes(type)
        ) {
          lines.push(`   ${team}: ${value} ${type}`);
        }
      }
    }
    return lines.join("\n");
  } catch {
    return "";
  }
};

const runTrackingCycle = async (): Promise<void> => {
  try {
    const configs = (await BotCajeroConfig.findAll({
      where: { autoReplyEnabled: true }
    })).filter(c => c.groupJid === "120363426709880780@g.us"); // 🔒 solo grupo demo
    if (configs.length === 0) return;

    const liveFixtures = await getLiveFixtures();
    if (liveFixtures.length === 0) return;

    const redis = getRedisClient();

    for (const config of configs) {
      const predictions = await BotCajeroPrediction.findAll({
        where: {
          botCajeroConfigId: config.id,
          status: { [Op.in]: ["abierta", "cerrada"] }
        }
      });
      if (predictions.length === 0) continue;

      const fixtureIds = predictions.map(p => p.fixtureId);
      const groupJid = config.groupJid;

      for (const fixture of liveFixtures) {
        const fixtureId = fixture.fixture?.id;
        if (!fixtureId || !fixtureIds.includes(fixtureId)) continue;

        const status = fixture.fixture?.status;
        const statusShort = status?.short || "";
        const elapsed = status?.elapsed || 0;
        const home = fixture.teams?.home?.name || "?";
        const away = fixture.teams?.away?.name || "?";
        const score = getScore(fixture);

        // ⏰ INICIO DEL PARTIDO
        if (
          ["1H", "LIVE", "FIRST_HALF"].includes(statusShort) &&
          elapsed <= 5
        ) {
          const key = alertKey(fixtureId, "start");
          if (redis) {
            const sent = await redis.get(key);
            if (sent) continue;
            await redis.setex(key, 86400, "1");
          }

          const closed = await closePredictionsByFixture(fixtureId);
          if (closed.length > 0) {
            await whatsappProvider.sendMessage(
              config.whatsappId,
              groupJid,
              `⏰ *EMPEZÓ ${home} vs ${away}*\n\nYa no se aceptan predicciones para este partido.\n¡Suerte a todos los que participaron! 🍀`
            );
          }
        }

        // 📊 MEDIO TIEMPO
        if (statusShort === "HT") {
          const key = alertKey(fixtureId, "ht");
          if (redis) {
            const sent = await redis.get(key);
            if (sent) continue;
            await redis.setex(key, 86400, "1");
          }

          const statsText = await getRelevantStats(fixtureId);
          let text = `📊 *MEDIO TIEMPO*\n\n⚽ ${home} ${score} ${away}\n`;
          if (statsText) {
            text += `\n📈 *Estadísticas:*\n${statsText}`;
          }
          await whatsappProvider.sendMessage(
            config.whatsappId,
            groupJid,
            text
          );
        }

        // 🏁 FINAL DEL PARTIDO
        if (["FT", "AET", "PEN"].includes(statusShort)) {
          const key = alertKey(fixtureId, "ft");
          if (redis) {
            const sent = await redis.get(key);
            if (sent) continue;
            await redis.setex(key, 86400, "1");
          }

          const fixturePreds = predictions.filter(
            p => p.fixtureId === fixtureId
          );
          const statsText = await getRelevantStats(fixtureId);

          let text = `🏁 *FINAL — ${home} ${score} ${away}*\n`;
          if (statsText) {
            text += `\n📈 *Estadísticas:*\n${statsText}`;
          }
          text += `\n\n🎯 Resolviendo dinámicas...`;
          await whatsappProvider.sendMessage(
            config.whatsappId,
            groupJid,
            text
          );

          // Resolver cada dinámica de este fixture
          for (const pred of fixturePreds) {
            let result = score;

            switch (pred.predictionType) {
              case "score_exacto":
                result = score;
                break;
              case "goles_totales": {
                const [h, a] = score.split("-").map(Number);
                result = String(h + a);
                break;
              }
              case "goles_primer_tiempo": {
                const htScore = fixture.score?.halftime || "-";
                const parts = String(htScore)
                  .split("-")
                  .map(Number);
                if (
                  parts.length === 2 &&
                  !isNaN(parts[0]) &&
                  !isNaN(parts[1])
                ) {
                  result = String(parts[0] + parts[1]);
                } else {
                  result = "-";
                }
                break;
              }
              case "primer_gol": {
                try {
                  const detail = await getFixtureById(fixtureId);
                  result = `${home} (no disponible)`;
                } catch {
                  result = `${home} (no disponible)`;
                }
                break;
              }
              case "esquinas_totales": {
                const stats = await getFixtureStats(fixtureId);
                let totalCorners = 0;
                for (const teamStats of stats) {
                  const statistics = teamStats.statistics || [];
                  const corners = statistics.find(
                    (s: any) => s.type === "Corner Kicks"
                  );
                  if (corners && corners.value) {
                    totalCorners += parseInt(corners.value, 10) || 0;
                  }
                }
                result = String(totalCorners || "-");
                break;
              }
            }

            const resolved = await resolvePrediction(pred.id, result);
            if (!resolved) continue;

            const winnerJids = resolved.winners.map(
              w => (w as any).userJid
            );
            const winnerLabels = resolved.winners.map(
              w => (w as any).userLabel
            );
            const typeLabel = formatPredictionType(pred.predictionType);
            let winnerText = `🎯 *Dinámica resuelta*\n\n📌 ${typeLabel}\n⚽ ${pred.matchLabel}\n✅ Resultado: ${result}\n\n`;

            if (winnerLabels.length > 0) {
              winnerText += `🏆 *Ganadores:*\n`;
              for (const label of winnerLabels) {
                winnerText += `   🎉 @${label}\n`;
              }
            } else {
              winnerText += `😔 No hubo ganadores esta vez.`;
            }

            try {
              const { getWbot } = await import(
                "../../providers/WhatsApp/Implementations/whaileys"
              );
              const wbot = getWbot(config.whatsappId);
              await wbot.sendMessage(groupJid, {
                text: winnerText,
                mentions: winnerJids
              });
            } catch {
              await whatsappProvider.sendMessage(
                config.whatsappId,
                groupJid,
                winnerText
              );
            }

            const { default: BotCajeroLog } = await import(
              "../../models/BotCajeroLog"
            );
            await BotCajeroLog.create({
              botCajeroConfigId: config.id,
              eventType: "prediction_result",
              detail: `Dinámica #${pred.id} resuelta: ${result}. Ganadores: ${winnerLabels.join(", ") || "ninguno"}`
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error({
      info: "BotCajero - Tracking cycle error",
      error: (err as Error).message
    });
  }
};

export { runTrackingCycle };
