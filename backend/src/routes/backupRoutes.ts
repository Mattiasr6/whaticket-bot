import { Router } from "express";
import isAuth from "../middleware/isAuth";
import {
  backupSessions,
  restoreSessions,
  listBackups
} from "../controllers/BackupController";

const backupRoutes = Router();

backupRoutes.post("/backup/sessions", isAuth, backupSessions);
backupRoutes.post("/backup/restore", isAuth, restoreSessions);
backupRoutes.get("/backup/list", isAuth, listBackups);

export default backupRoutes;
