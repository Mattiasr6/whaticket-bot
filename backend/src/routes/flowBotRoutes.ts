import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as FlowBotController from "../controllers/FlowBotController";

const flowBotRoutes = Router();

// FlowBot CRUD
flowBotRoutes.get("/flow-bots", isAuth, FlowBotController.list);
flowBotRoutes.get("/flow-bots/:id", isAuth, FlowBotController.show);
flowBotRoutes.post("/flow-bots", isAuth, FlowBotController.store);
flowBotRoutes.put("/flow-bots/:id", isAuth, FlowBotController.update);
flowBotRoutes.delete("/flow-bots/:id", isAuth, FlowBotController.remove);
flowBotRoutes.post(
  "/flow-bots/:id/duplicate",
  isAuth,
  FlowBotController.duplicate
);

// FlowNode CRUD
flowBotRoutes.get("/flow-bots/:id/nodes", isAuth, FlowBotController.nodeIndex);
flowBotRoutes.post("/flow-bots/:id/nodes", isAuth, FlowBotController.nodeStore);
flowBotRoutes.put("/flow-nodes/:id", isAuth, FlowBotController.nodeUpdate);
flowBotRoutes.delete("/flow-nodes/:id", isAuth, FlowBotController.nodeRemove);
flowBotRoutes.put(
  "/flow-nodes/:id/order",
  isAuth,
  FlowBotController.nodeReorder
);
flowBotRoutes.put("/flow-nodes/:id/move", isAuth, FlowBotController.nodeMove);

// FlowSession
flowBotRoutes.get(
  "/flow-sessions/:contactJid",
  isAuth,
  FlowBotController.sessionShow
);
flowBotRoutes.delete(
  "/flow-sessions/:id",
  isAuth,
  FlowBotController.sessionDelete
);

// Preview (dry-run)
flowBotRoutes.post("/flow-bots/:id/preview", isAuth, FlowBotController.preview);

export default flowBotRoutes;
