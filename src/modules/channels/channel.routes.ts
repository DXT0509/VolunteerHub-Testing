import { Router } from "express";
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

router.get("/:eventId/posts", authenticate, getEventPosts);

router.post(
  "/:eventId/posts",
  authenticate,
  authorize(["VOLUNTEER", "EVENT_MANAGER"]),
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
  authorize(["VOLUNTEER", "EVENT_MANAGER"]),
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
  authorize(["VOLUNTEER", "EVENT_MANAGER"]),
  toggleLike
);

export default router;
