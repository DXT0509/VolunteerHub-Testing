import { Router } from "express";
import { list } from "./category.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";

const router = Router();

router.get("/", authenticate, authorize(["EVENT_MANAGER"]), list);

export default router;
