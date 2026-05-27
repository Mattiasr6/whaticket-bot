import CronJob from "../../models/CronJob";
import AppError from "../../errors/AppError";
import { getNextRun } from "../../utils/cronUtils";

const UpdateCronJobService = async (id: number, data: Partial<CronJob>) => {
  const job = await CronJob.findByPk(id);
  if (!job) throw new AppError("Cron job not found");

  const updateData: any = { ...data };
  if (data.cronExpr) {
    updateData.nextRunAt = getNextRun(data.cronExpr);
  }

  await job.update(updateData);
  return job;
};

export default UpdateCronJobService;
