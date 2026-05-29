import { Router } from "express";
import { health } from "../controllers/HealthController";

const healthRoutes = Router();

healthRoutes.get("/health", health);

export default healthRoutes;
