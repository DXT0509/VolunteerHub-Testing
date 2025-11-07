import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { getMe, updateMe, changePassword } from "./user.controller";

const router = Router();

//User
router.get("/me", authenticate, getMe);
router.put("/me", authenticate, updateMe);
router.put("/change-password", authenticate, changePassword);

export default router;
