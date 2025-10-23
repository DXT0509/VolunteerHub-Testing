import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import {
  getMe,
  updateMe,
  changePassword,
  getAllUsers,
  updateStatus,
} from "./user.controller";

const router = Router();

//User
router.get("/me", authenticate, getMe);
router.patch("/me", authenticate, updateMe);
router.patch("/change-password", authenticate, changePassword);

//Admin
router.get("/", authenticate, authorize(["ADMIN"]), getAllUsers);
router.patch("/:id/status", authenticate, authorize(["ADMIN"]), updateStatus);

export default router;
