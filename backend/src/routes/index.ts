import { Router } from "express";

import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import settingRoutes from "./settingRoutes";
import contactRoutes from "./contactRoutes";
import whatsappRoutes from "./whatsappRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";

import cronJobRoutes from "./cronJobRoutes";
import agentInstructionRoutes from "./agentInstructionRoutes";
import flowBotRoutes from "./flowBotRoutes";
import autoForwardRoutes from "./autoForwardRoutes";
import botCajeroRoutes from "./botCajeroRoutes";

const apiRouter = Router();

apiRouter.use(userRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use(settingRoutes);
apiRouter.use(contactRoutes);
apiRouter.use(whatsappRoutes);
apiRouter.use(whatsappSessionRoutes);

apiRouter.use(cronJobRoutes);
apiRouter.use(agentInstructionRoutes);
apiRouter.use(flowBotRoutes);
apiRouter.use(autoForwardRoutes);
apiRouter.use(botCajeroRoutes);

const routes = Router();
routes.use("/api", apiRouter);

export default routes;
