import { Router, Request } from "express";
import multer from "multer";
import path from "path";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import {
  create,
  list,
  detailById,
  detailBySlug,
  update,
  remove,
  finalize,
} from "./event.controller";

const router = Router();

// configure multer for event banner uploads
const uploadDir = path.join(__dirname, "..", "..", "uploads");
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const safeName = (file.originalname || "file").replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req: Request, file: any, cb: multer.FileFilterCallback) => {
    // accept only images for banner
    if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
    else cb(null, false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

//public
router.get("/", list);
router.get("/:id", detailById);
router.get("/slug/:slug", detailBySlug);

//event manager
router.post(
  "/",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  upload.single("banner"),
  create
);
router.put(
  "/:id",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  upload.single("banner"),
  update
);
router.delete("/:id", authenticate, authorize(["EVENT_MANAGER","ADMIN"]), remove);
router.patch(
  "/:id/finalize",
  authenticate,
  authorize(["EVENT_MANAGER"]),
  finalize
);

export default router;
