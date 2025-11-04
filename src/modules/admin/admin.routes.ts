import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import {
  approve,
  getAllUsers,
  updateStatus,
  changeUserRole,
  exportData,
} from "./admin.controller";

const router = Router();

router.patch("/:id/approve", authenticate, authorize(["ADMIN"]), approve);
router.get("/", authenticate, authorize(["ADMIN"]), getAllUsers);
router.patch("/:id/status", authenticate, authorize(["ADMIN"]), updateStatus);
router.patch("/:id/role", authenticate, authorize(["ADMIN"]), changeUserRole);
router.get("/export", authenticate, authorize(["ADMIN"]), exportData);

export default router;
