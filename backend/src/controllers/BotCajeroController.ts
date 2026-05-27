import { Request, Response } from "express";
import GetConfigService from "../services/BotCajeroServices/GetConfigService";
import UpdateConfigService from "../services/BotCajeroServices/UpdateConfigService";
import DeleteConfigService from "../services/BotCajeroServices/DeleteConfigService";
import CreateFAQService from "../services/BotCajeroServices/CreateFAQService";
import UpdateFAQService from "../services/BotCajeroServices/UpdateFAQService";
import DeleteFAQService from "../services/BotCajeroServices/DeleteFAQService";
import CreateSpamRuleService from "../services/BotCajeroServices/CreateSpamRuleService";
import DeleteSpamRuleService from "../services/BotCajeroServices/DeleteSpamRuleService";
import AddStickerService from "../services/BotCajeroServices/AddStickerService";
import DeleteStickerService from "../services/BotCajeroServices/DeleteStickerService";
import ListLogsService from "../services/BotCajeroServices/ListLogsService";

export const index = async (req: Request, res: Response): Promise<void> => {
  const { whatsappId } = req.params;
  const config = await GetConfigService(Number(whatsappId));
  res.json(config);
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const { whatsappId } = req.params;
  const config = await UpdateConfigService(Number(whatsappId), req.body);
  res.json(config);
};

export const del = async (req: Request, res: Response): Promise<void> => {
  const { whatsappId } = req.params;
  await DeleteConfigService(Number(whatsappId));
  res.status(204).send();
};

export const storeFAQ = async (req: Request, res: Response): Promise<void> => {
  const { whatsappId } = req.params;
  const faq = await CreateFAQService(Number(whatsappId), req.body);
  res.status(201).json(faq);
};

export const updateFAQ = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const faq = await UpdateFAQService(Number(id), req.body);
  res.json(faq);
};

export const deleteFAQ = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await DeleteFAQService(Number(id));
  res.status(204).send();
};

export const storeSpamRule = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { whatsappId } = req.params;
  const rule = await CreateSpamRuleService(Number(whatsappId), req.body);
  res.status(201).json(rule);
};

export const deleteSpamRule = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  await DeleteSpamRuleService(Number(id));
  res.status(204).send();
};

export const addSticker = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { whatsappId } = req.params;
  const sticker = await AddStickerService(Number(whatsappId), req.body);
  res.status(201).json(sticker);
};

export const deleteSticker = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  await DeleteStickerService(Number(id));
  res.status(204).send();
};

export const logs = async (req: Request, res: Response): Promise<void> => {
  const { whatsappId } = req.params;
  const { eventType } = req.query;
  const logList = await ListLogsService({
    botCajeroConfigId: Number(whatsappId),
    eventType: eventType as string | undefined
  });
  res.json(logList);
};
