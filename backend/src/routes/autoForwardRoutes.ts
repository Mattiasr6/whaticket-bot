import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as AutoForwardController from "../controllers/AutoForwardController";

const autoForwardRoutes = Router();

autoForwardRoutes.get("/auto-forwards", isAuth, AutoForwardController.index);
autoForwardRoutes.post("/auto-forwards", isAuth, AutoForwardController.store);
autoForwardRoutes.put(
  "/auto-forwards/:id",
  isAuth,
  AutoForwardController.update
);
autoForwardRoutes.delete(
  "/auto-forwards/:id",
  isAuth,
  AutoForwardController.remove
);
autoForwardRoutes.put(
  "/auto-forwards/:id/toggle",
  isAuth,
  AutoForwardController.toggle
);
autoForwardRoutes.get(
  "/auto-forwards/:id/logs",
  isAuth,
  AutoForwardController.logs
);

export default autoForwardRoutes;
