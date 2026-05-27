import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as BotRuleController from "../controllers/BotRuleController";

const botRuleRoutes = Router();

botRuleRoutes.get("/bot-rules", isAuth, BotRuleController.index);
botRuleRoutes.post("/bot-rules", isAuth, BotRuleController.store);
botRuleRoutes.put("/bot-rules/:id", isAuth, BotRuleController.update);
botRuleRoutes.delete("/bot-rules/:id", isAuth, BotRuleController.remove);

export default botRuleRoutes;
