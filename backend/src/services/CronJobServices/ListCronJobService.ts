import CronJob from "../../models/CronJob";

const ListCronJobService = async () => {
  return CronJob.findAll({ order: [["createdAt", "DESC"]] });
};

export default ListCronJobService;
