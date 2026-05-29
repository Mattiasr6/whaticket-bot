import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { SessionBackupService } from "../services/SessionBackupService";
import { SessionRestoreService } from "../services/SessionRestoreService";

export const backupSessions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const service = new SessionBackupService();
  const result = await service.execute();

  return res.status(200).json({
    message: "Session backup completed",
    key: result.key,
    sizeBytes: result.size
  });
};

export const restoreSessions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("Only super-admins can restore backups", 403);
  }

  const service = new SessionRestoreService();
  const backupKey: string | undefined = req.body.backupKey;

  let result: {
    sessionsRestored: number;
    redisKeysRestored: number;
    baileysVersion: string;
  };

  if (backupKey) {
    result = await service.restoreFromKey(backupKey);
  } else {
    result = await service.restoreLatest();
  }

  return res.status(200).json({
    message: "Session restore completed",
    ...result
  });
};

export const listBackups = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const service = new SessionRestoreService();
  const backups = await service.listBackups();

  return res.status(200).json({
    backups
  });
};
