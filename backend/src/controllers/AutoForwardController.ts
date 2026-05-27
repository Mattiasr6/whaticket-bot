import { Request, Response } from "express";
import ListAutoForwardService from "../services/AutoForwardServices/ListAutoForwardService";
import CreateAutoForwardService from "../services/AutoForwardServices/CreateAutoForwardService";
import UpdateAutoForwardService from "../services/AutoForwardServices/UpdateAutoForwardService";
import DeleteAutoForwardService from "../services/AutoForwardServices/DeleteAutoForwardService";
import ToggleAutoForwardService from "../services/AutoForwardServices/ToggleAutoForwardService";
import ListAutoForwardLogsService from "../services/AutoForwardServices/ListAutoForwardLogsService";

export const index = async (req: Request, res: Response) => {
  const { whatsappId } = req.query;
  const rules = await ListAutoForwardService(
    whatsappId ? Number(whatsappId) : undefined
  );
  return res.json(rules);
};

export const store = async (req: Request, res: Response) => {
  const {
    whatsappId,
    name,
    sourceGroupJid,
    targetGroupJid,
    adminNumbers,
    timeWindowMinutes,
    maxLookback,
    maxForward,
    customCaption,
    delayBetweenMs,
    enabled
  } = req.body;
  const rule = await CreateAutoForwardService({
    whatsappId,
    name,
    sourceGroupJid,
    targetGroupJid,
    adminNumbers,
    timeWindowMinutes,
    maxLookback,
    maxForward,
    customCaption,
    delayBetweenMs,
    enabled
  });
  return res.status(201).json(rule);
};

export const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = await UpdateAutoForwardService(Number(id), req.body);
  return res.json(rule);
};

export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  await DeleteAutoForwardService(Number(id));
  return res.status(204).json();
};

export const toggle = async (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = await ToggleAutoForwardService(Number(id));
  return res.json(rule);
};

export const logs = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit } = req.query;
  const result = await ListAutoForwardLogsService(
    Number(id),
    limit ? Number(limit) : undefined
  );
  return res.json(result);
};
