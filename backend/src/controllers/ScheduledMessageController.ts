import { Request, Response } from "express";
import ListScheduledMessageService from "../services/ScheduledMessageServices/ListScheduledMessageService";
import CreateScheduledMessageService from "../services/ScheduledMessageServices/CreateScheduledMessageService";
import UpdateScheduledMessageService from "../services/ScheduledMessageServices/UpdateScheduledMessageService";
import DeleteScheduledMessageService from "../services/ScheduledMessageServices/DeleteScheduledMessageService";
import ShowScheduledMessageService from "../services/ScheduledMessageServices/ShowScheduledMessageService";

export const index = async (req: Request, res: Response) => {
  const { whatsappId } = req.query;
  const messages = await ListScheduledMessageService(
    whatsappId ? { whatsappId: Number(whatsappId) } : undefined
  );
  return res.json(messages);
};

export const store = async (req: Request, res: Response) => {
  const { whatsappId, groupJid, groupName, messageText, mediaPath, mediaName, intervalMinutes, enabled } = req.body;
  const message = await CreateScheduledMessageService({
    whatsappId,
    groupJid,
    groupName,
    messageText,
    mediaPath,
    mediaName,
    intervalMinutes,
    enabled
  });
  return res.status(201).json(message);
};

export const show = async (req: Request, res: Response) => {
  const { id } = req.params;
  const message = await ShowScheduledMessageService(Number(id));
  return res.json(message);
};

export const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const message = await UpdateScheduledMessageService({
    id: Number(id),
    ...req.body
  });
  return res.json(message);
};

export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  await DeleteScheduledMessageService(Number(id));
  return res.status(204).json();
};
