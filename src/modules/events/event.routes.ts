import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import {
  create,
  list,
  detailById,
  detailBySlug,
  update,
  remove,
  approve,
  finalize,
} from "./event.controller";

const router = Router();

//public
router.get("/", list);
router.get("/:id", detailById);
router.get("/slug/:slug", detailBySlug);

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
