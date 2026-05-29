import { Router } from "express";

import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import settingRoutes from "./settingRoutes";
import contactRoutes from "./contactRoutes";
import ticketRoutes from "./ticketRoutes";
import whatsappRoutes from "./whatsappRoutes";
import messageRoutes from "./messageRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";
import queueRoutes from "./queueRoutes";
import quickAnswerRoutes from "./quickAnswerRoutes";
import apiRoutes from "./apiRoutes";
import scheduledMessageRoutes from "./scheduledMessageRoutes";
import botRuleRoutes from "./botRuleRoutes";
import cronJobRoutes from "./cronJobRoutes";
import agentInstructionRoutes from "./agentInstructionRoutes";
import flowBotRoutes from "./flowBotRoutes";
import autoForwardRoutes from "./autoForwardRoutes";
import clinicInfoRoutes from "./clinicInfoRoutes";
import botCajeroRoutes from "./botCajeroRoutes";

const apiRouter = Router();

apiRouter.use(userRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use(settingRoutes);
apiRouter.use(contactRoutes);
apiRouter.use(ticketRoutes);
apiRouter.use(whatsappRoutes);
apiRouter.use(messageRoutes);
apiRouter.use(whatsappSessionRoutes);
apiRouter.use(queueRoutes);
apiRouter.use(quickAnswerRoutes);
apiRouter.use("/messages", apiRoutes);
apiRouter.use(scheduledMessageRoutes);
apiRouter.use(botRuleRoutes);
apiRouter.use(cronJobRoutes);
apiRouter.use(agentInstructionRoutes);
apiRouter.use(flowBotRoutes);
apiRouter.use(autoForwardRoutes);
apiRouter.use(botCajeroRoutes);
apiRouter.use(clinicInfoRoutes);

const routes = Router();
routes.use("/api", apiRouter);

export default routes;
