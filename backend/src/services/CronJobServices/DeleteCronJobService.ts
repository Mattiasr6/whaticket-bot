import CronJob from "../../models/CronJob";
import AppError from "../../errors/AppError";

const DeleteCronJobService = async (id: number) => {
  const job = await CronJob.findByPk(id);
  if (!job) throw new AppError("Cron job not found");
  await job.destroy();
};

export default DeleteCronJobService;
