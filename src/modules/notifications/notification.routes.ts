import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import {
  sendNotification,
  getUserNotifications,
  markAsRead,
  subscribePush,
  unsubscribePush,
} from "./notification.controller";

const router = Router();

router.post(
  "/send",
  authenticate,
  authorize(["ADMIN", "EVENT_MANAGER"]),
  sendNotification
);

router.get("/my", authenticate, getUserNotifications);

router.patch("/:id/read", authenticate, markAsRead);

router.post("/subscribe", authenticate, subscribePush);
router.delete("/unsubscribe", authenticate, unsubscribePush);

export default router;
