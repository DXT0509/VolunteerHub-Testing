import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import {
  create,
  list,
  detal,
  update,
  remove,
  approve,
  finalize,
} from "./event.controller";

const router = Router();

//public
router.get("/", list);
router.get("/:id", detal);

//event manager
router.post("/", authenticate, authorize(["EVENT_MANAGER"]), create);
router.put("/:id", authenticate, authorize(["EVENT_MANAGER"]), update);
router.delete("/:id", authenticate, authorize(["EVENT_MANAGER"]), remove);
router.patch(
  "/:id/finalize",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  finalize
);

//admin
router.patch("/:id/approve", authenticate, authorize(["ADMIN"]), approve);

export default router;
