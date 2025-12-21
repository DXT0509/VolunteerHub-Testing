import { Router, Request } from "express";
import multer from "multer";
import path from "path";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import {
  getEventPosts,
  createPost,
  deletePost,
  createComment,
  deleteComment,
  toggleLike,
} from "./channel.controller";

const router = Router();

// configure multer to save uploads into server/uploads and preserve extensions
const uploadDir = path.join(__dirname, "..", "..", "uploads");
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req: Request, file: any, cb: multer.FileFilterCallback) => {
    // accept only images for now
    if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
    else cb(null, false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/:eventId/posts", authenticate, getEventPosts);

router.post(
  "/:eventId/posts",
  authenticate,
  authorize(["VOLUNTEER", "EVENT_MANAGER", "ADMIN"]),
  upload.array("files", 10),
  createPost
);
router.delete(
  "/posts/:postId",
  authenticate,
  authorize(["VOLUNTEER", "EVENT_MANAGER"]),
  deletePost
);

router.post(
  "/posts/:postId/comments",
  authenticate,
  authorize(["VOLUNTEER", "EVENT_MANAGER", "ADMIN"]),
  upload.array("files", 10),
  createComment
);
router.delete(
  "/comments/:commentId",
  authenticate,
  authorize(["VOLUNTEER", "EVENT_MANAGER"]),
  deleteComment
);

router.post(
  "/like",
  authenticate,
  authorize(["VOLUNTEER", "EVENT_MANAGER", "ADMIN"]),
  toggleLike
);

export default router;
