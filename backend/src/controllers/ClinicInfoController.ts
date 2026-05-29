import { Request, Response } from "express";
import { getClinicInfo, updateClinicInfo } from "../services/ClinicInfo/ClinicInfoService";

export const show = async (_req: Request, res: Response): Promise<Response> => {
  const content = await getClinicInfo();
  return res.status(200).json({ content });
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { content } = req.body;
  if (content === undefined) {
    return res.status(400).json({ error: "content is required" });
  }
  await updateClinicInfo(content);
  return res.status(200).json({ content });
};
