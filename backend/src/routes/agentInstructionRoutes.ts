import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as AgentInstructionController from "../controllers/AgentInstructionController";

const agentInstructionRoutes = Router();

agentInstructionRoutes.get("/agent-instructions", isAuth, AgentInstructionController.index);
agentInstructionRoutes.post("/agent-instructions", isAuth, AgentInstructionController.store);
agentInstructionRoutes.put("/agent-instructions/:id", isAuth, AgentInstructionController.update);
agentInstructionRoutes.delete("/agent-instructions/:id", isAuth, AgentInstructionController.remove);

export default agentInstructionRoutes;
