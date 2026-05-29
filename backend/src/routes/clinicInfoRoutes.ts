import { Router } from "express";
import * as ClinicInfoController from "../controllers/ClinicInfoController";
import isAuth from "../middleware/isAuth";

const clinicInfoRoutes = Router();

clinicInfoRoutes.get("/clinic-info", isAuth, ClinicInfoController.show);
clinicInfoRoutes.put("/clinic-info", isAuth, ClinicInfoController.update);

export default clinicInfoRoutes;
