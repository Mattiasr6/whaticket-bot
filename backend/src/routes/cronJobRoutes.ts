import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as CronJobController from "../controllers/CronJobController";

const cronJobRoutes = Router();

cronJobRoutes.get("/cron-jobs", isAuth, CronJobController.index);
cronJobRoutes.post("/cron-jobs", isAuth, CronJobController.store);
cronJobRoutes.get("/cron-jobs/:id", isAuth, CronJobController.show);
cronJobRoutes.put("/cron-jobs/:id", isAuth, CronJobController.update);
cronJobRoutes.delete("/cron-jobs/:id", isAuth, CronJobController.remove);

export default cronJobRoutes;
