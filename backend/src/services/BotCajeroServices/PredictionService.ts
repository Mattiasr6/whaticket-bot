import { Op } from "sequelize";
import BotCajeroPrediction from "../../models/BotCajeroPrediction";
import BotCajeroPredictionEntry from "../../models/BotCajeroPredictionEntry";
import { logger } from "../../utils/logger";

const createPrediction = async (
  botCajeroConfigId: number,
  fixtureId: number,
  matchLabel: string,
  matchTime: Date,
  predictionType: string
): Promise<BotCajeroPrediction> => {
  return BotCajeroPrediction.create({
    botCajeroConfigId,
    fixtureId,
    matchLabel,
    matchTime,
    predictionType,
    status: "abierta"
  });
};

const listActivePredictions = async (
  botCajeroConfigId: number
): Promise<BotCajeroPrediction[]> => {
  return BotCajeroPrediction.findAll({
    where: { botCajeroConfigId, status: "abierta" },
    order: [["matchTime", "ASC"]],
    include: [{ model: BotCajeroPredictionEntry }]
  });
};

const getPredictionById = async (
  id: number,
  botCajeroConfigId: number
): Promise<BotCajeroPrediction | null> => {
  return BotCajeroPrediction.findOne({
    where: { id, botCajeroConfigId },
    include: [{ model: BotCajeroPredictionEntry }]
  });
};

const cancelPrediction = async (
  id: number,
  botCajeroConfigId: number
): Promise<boolean> => {
  const pred = await BotCajeroPrediction.findOne({
    where: { id, botCajeroConfigId, status: "abierta" }
  });
  if (!pred) return false;
  await pred.update({ status: "cerrada", result: "cancelada" });
  return true;
};

const closePredictionsByFixture = async (
  fixtureId: number
): Promise<BotCajeroPrediction[]> => {
  const predictions = await BotCajeroPrediction.findAll({
    where: { fixtureId, status: "abierta" }
  });
  for (const p of predictions) {
    await p.update({ status: "cerrada" });
  }
  return predictions;
};

const addPredictionEntry = async (
  predictionId: number,
  userJid: string,
  userLabel: string,
  prediction: string
): Promise<BotCajeroPredictionEntry | null> => {
  const pred = await BotCajeroPrediction.findByPk(predictionId);
  if (!pred || pred.status !== "abierta") return null;

  const existing = await BotCajeroPredictionEntry.findOne({
    where: { predictionId, userJid }
  });
  if (existing) return null;

  return BotCajeroPredictionEntry.create({
    predictionId,
    userJid,
    userLabel,
    prediction
  });
};

const resolvePrediction = async (
  id: number,
  result: string
): Promise<{
  prediction: BotCajeroPrediction;
  winners: BotCajeroPredictionEntry[];
} | null> => {
  const pred = await BotCajeroPrediction.findOne({
    where: { id, status: { [Op.ne]: "resuelta" } },
    include: [{ model: BotCajeroPredictionEntry }]
  });
  if (!pred) return null;

  await pred.update({ status: "resuelta", result });

  const updated = await BotCajeroPrediction.findOne({
    where: { id },
    include: [{ model: BotCajeroPredictionEntry }]
  });

  const entries = updated?.entries || [];
  const winners = entries.filter(
    e => e.prediction.toLowerCase() === result.toLowerCase()
  );

  return { prediction: updated!, winners };
};

const PREDICTION_TYPE_LABELS: Record<string, string> = {
  score_exacto: "Resultado exacto",
  goles_totales: "Goles totales del partido",
  primer_gol: "Primer gol del partido",
  esquinas_totales: "Esquinas totales",
  goles_primer_tiempo: "Goles del primer tiempo"
};

const formatPredictionType = (type: string): string => {
  return PREDICTION_TYPE_LABELS[type] || type;
};

export {
  createPrediction,
  listActivePredictions,
  getPredictionById,
  cancelPrediction,
  closePredictionsByFixture,
  addPredictionEntry,
  resolvePrediction,
  formatPredictionType
};
