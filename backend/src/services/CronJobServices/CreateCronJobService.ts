import CronJob from "../../models/CronJob";
import { getNextRun } from "../../utils/cronUtils";

interface Request {
  name: string;
  actionType: string;
  cronExpr: string;
  whatsappId?: number;
  config?: string;
  enabled?: boolean;
}

const CreateCronJobService = async (data: Request) => {
  const nextRunAt = getNextRun(data.cronExpr);
  const job = await CronJob.create({ ...data, nextRunAt });
  return job;
};

export default CreateCronJobService;
