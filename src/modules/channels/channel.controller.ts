import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import * as ChannelService from "./channel.service";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { changePassword } from "../users/user.service";

export async function getEventPosts(req: AuthRequest, res: Response) {
  try {
    const eventId = parseInt(String(req.params.eventId));
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
    const eventId = parseInt(String(req.params.eventId));
    const { content, attachments: rawAttachments } = req.body as { content?: string; attachments?: any };
    // allow attachments to be sent as JSON string when using multipart/form-data
    let attachments: string[] = [];
    if (rawAttachments) {
      if (Array.isArray(rawAttachments)) attachments = rawAttachments;
      else if (typeof rawAttachments === "string") {
        try { attachments = JSON.parse(rawAttachments); } catch { attachments = []; }
      }
    }
    // files uploaded via multer are available on req.files
  const files = ((req as any).files as any[] | undefined) || [];
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const uploadedUrls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);
    const allAttachments = [ ...attachments, ...uploadedUrls ];

    
    try {
      const result = await ChannelService.createPost(
        req.user!.userId,
        eventId,
        content || '',
        allAttachments
      );
      res.json(result);
    } catch (e: any) {
      // cleanup uploaded files on error to avoid orphan files
      for (const f of files) {
        const fp = path.join(__dirname, '..', '..', 'uploads', f.filename);
        fs.promises.unlink(fp).catch(() => {});
      }
      throw e;
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deletePost(req: AuthRequest, res: Response) {
  try {
    const postId = parseInt(String(req.params.postId));
    const resutl = await ChannelService.deletePost(req.user!.userId, postId);
    res.json(resutl);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function createComment(req: AuthRequest, res: Response) {
  try {
    const postId = parseInt(String(req.params.postId));
    const { content, attachments: rawAttachments } = req.body as { content?: string; attachments?: any };
    let attachments: string[] = [];
    if (rawAttachments) {
      if (Array.isArray(rawAttachments)) attachments = rawAttachments;
      else if (typeof rawAttachments === "string") {
        try { attachments = JSON.parse(rawAttachments); } catch { attachments = []; }
      }
    }
  const files = ((req as any).files as any[] | undefined) || [];
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const uploadedUrls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);
    const allAttachments = [ ...attachments, ...uploadedUrls ];
    
    try {
      const result = await ChannelService.createComment(
        req.user!.userId,
        postId,
        content || '',
        allAttachments
      );
      res.json(result);
    } catch (e: any) {
      for (const f of files) {
        const fp = path.join(__dirname, '..', '..', 'uploads', f.filename);
        fs.promises.unlink(fp).catch(() => {});
      }
      throw e;
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteComment(req: AuthRequest, res: Response) {
  try {
    const commentId = parseInt(String(req.params.commentId));
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
