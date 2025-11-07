import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import {
  registerEvent,
  cancelRegistration,
  getUserRegistrations,
  updateRegistrationStatus,
  finalizeRegistration,
  checkIn,
  checkOut,
  getEventRegistrations,
} from "./registration.controller";

const router = Router();

//Volunteer
router.post("/:eventId/register", authenticate, registerEvent);
router.patch("/:eventId/register", authenticate, cancelRegistration);
router.get("/my", authenticate, getUserRegistrations);

//Manager approve
router.patch(
  "/:regId/status",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  updateRegistrationStatus
);

//Manager final
router.patch(
  "/:regId/final",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  finalizeRegistration
);

//Roll Call
router.post(
  "/:regId/checkin",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  checkIn
);
router.post(
  "/:regId/checkout",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  checkOut
);

router.get(
  "/event/:eventId",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  getEventRegistrations
);

export default router;
