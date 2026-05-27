import { Request, Response } from "express";
import ListCronJobService from "../services/CronJobServices/ListCronJobService";
import CreateCronJobService from "../services/CronJobServices/CreateCronJobService";
import UpdateCronJobService from "../services/CronJobServices/UpdateCronJobService";
import DeleteCronJobService from "../services/CronJobServices/DeleteCronJobService";
import ShowCronJobService from "../services/CronJobServices/ShowCronJobService";

export const index = async (req: Request, res: Response) => {
  const jobs = await ListCronJobService();
  return res.json(jobs);
};

export const store = async (req: Request, res: Response) => {
  const { name, actionType, cronExpr, whatsappId, config, enabled } = req.body;
  const job = await CreateCronJobService({
    name, actionType, cronExpr, whatsappId, config, enabled
  });
  return res.status(201).json(job);
};

export const show = async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = await ShowCronJobService(Number(id));
  return res.json(job);
};

export const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = await UpdateCronJobService(Number(id), req.body);
  return res.json(job);
};

export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  await DeleteCronJobService(Number(id));
  return res.status(204).json();
};
