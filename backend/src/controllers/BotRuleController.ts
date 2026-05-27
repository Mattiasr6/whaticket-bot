import { Request, Response } from "express";
import ListBotRuleService from "../services/BotRuleServices/ListBotRuleService";
import CreateBotRuleService from "../services/BotRuleServices/CreateBotRuleService";
import UpdateBotRuleService from "../services/BotRuleServices/UpdateBotRuleService";
import DeleteBotRuleService from "../services/BotRuleServices/DeleteBotRuleService";

export const index = async (req: Request, res: Response) => {
  const { whatsappId } = req.query;
  const rules = await ListBotRuleService(
    whatsappId ? Number(whatsappId) : undefined
  );
  return res.json(rules);
};

export const store = async (req: Request, res: Response) => {
  const {
    whatsappId,
    name,
    keywords,
    matchType,
    response,
    mediaPath,
    mediaName,
    scope,
    groupJid,
    enabled,
    priority
  } = req.body;
  const rule = await CreateBotRuleService({
    whatsappId,
    name,
    keywords,
    matchType,
    response,
    mediaPath,
    mediaName,
    scope,
    groupJid,
    enabled,
    priority
  });
  return res.status(201).json(rule);
};

export const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = await UpdateBotRuleService(Number(id), req.body);
  return res.json(rule);
};

export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  await DeleteBotRuleService(Number(id));
  return res.status(204).json();
};
