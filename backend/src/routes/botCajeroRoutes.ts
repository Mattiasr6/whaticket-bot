import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as BotCajeroController from "../controllers/BotCajeroController";

const botCajeroRoutes = Router();

botCajeroRoutes.get(
  "/bot-cajero/:whatsappId",
  isAuth,
  BotCajeroController.index
);
botCajeroRoutes.put(
  "/bot-cajero/:whatsappId",
  isAuth,
  BotCajeroController.update
);
botCajeroRoutes.delete(
  "/bot-cajero/:whatsappId",
  isAuth,
  BotCajeroController.del
);

botCajeroRoutes.post(
  "/bot-cajero/:whatsappId/faqs",
  isAuth,
  BotCajeroController.storeFAQ
);
botCajeroRoutes.put(
  "/bot-cajero/:whatsappId/faqs/:id",
  isAuth,
  BotCajeroController.updateFAQ
);
botCajeroRoutes.delete(
  "/bot-cajero/:whatsappId/faqs/:id",
  isAuth,
  BotCajeroController.deleteFAQ
);

botCajeroRoutes.post(
  "/bot-cajero/:whatsappId/spam-rules",
  isAuth,
  BotCajeroController.storeSpamRule
);
botCajeroRoutes.delete(
  "/bot-cajero/:whatsappId/spam-rules/:id",
  isAuth,
  BotCajeroController.deleteSpamRule
);

botCajeroRoutes.post(
  "/bot-cajero/:whatsappId/stickers",
  isAuth,
  BotCajeroController.addSticker
);
botCajeroRoutes.delete(
  "/bot-cajero/:whatsappId/stickers/:id",
  isAuth,
  BotCajeroController.deleteSticker
);

botCajeroRoutes.get(
  "/bot-cajero/:whatsappId/logs",
  isAuth,
  BotCajeroController.logs
);

export default botCajeroRoutes;
