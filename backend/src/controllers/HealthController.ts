import { Request, Response } from "express";
import { HealthCheckService } from "../services/HealthCheckService";

export const health = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const service = new HealthCheckService();
  const report = await service.run();

  const httpStatus =
    report.status === "healthy"
      ? 200
      : report.status === "degraded"
        ? 200
        : 503;

  return res.status(httpStatus).json(report);
};
