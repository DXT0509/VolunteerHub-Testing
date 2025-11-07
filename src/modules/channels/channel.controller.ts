import { Request, Response } from "express";
import * as ChannelService from "./channel.service";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { changePassword } from "../users/user.service";

export async function getEventPosts(req: AuthRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId);
    const page = req.query.page ? parseInt(String(req.query.page)) : 1;
    const pageSize = req.query.pageSize
      ? parseInt(String(req.query.pageSize))
      : 10;
    const result = await ChannelService.getEventPosts(
      req.user!.userId,
      eventId,
      page,
      pageSize
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function createPost(req: AuthRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId);
    const { content, attachments } = req.body;
    const result = await ChannelService.createPost(
      req.user!.userId,
      eventId,
      content,
      attachments
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deletePost(req: AuthRequest, res: Response) {
  try {
    const postId = parseInt(req.params.postId);
    const resutl = await ChannelService.deletePost(req.user!.userId, postId);
    res.json(resutl);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function createComment(req: AuthRequest, res: Response) {
  try {
    const postId = parseInt(req.params.postId);
    const { content, attachments } = req.body;
    const result = await ChannelService.createComment(
      req.user!.userId,
      postId,
      content,
      attachments
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteComment(req: AuthRequest, res: Response) {
  try {
    const commentId = parseInt(req.params.commentId);
    const result = await ChannelService.deleteComment(
      req.user!.userId,
      commentId
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function toggleLike(req: AuthRequest, res: Response) {
  try {
    const { postId, commentId } = req.body as {
      postId?: number;
      commentId?: number;
    };
    const result = await ChannelService.toggleLike(
      req.user!.userId,
      postId,
      commentId
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
