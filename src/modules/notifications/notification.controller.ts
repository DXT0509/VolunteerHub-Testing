import { Request, Response } from "express";
import * as NotificationService from "./notification.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function sendNotification(req: Request, res: Response) {
  try {
    const { userId, type, title, body, data } = req.body;
    const result = await NotificationService.sendNotification(
      userId,
      type,
      title,
      body,
      data
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getUserNotifications(req: AuthRequest, res: Response) {
  try {
    const result = await NotificationService.getUserNotifications(
      req.user!.userId
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function markAsRead(req: AuthRequest, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const result = await NotificationService.markAsRead(req.user!.userId, id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function subscribePush(req: AuthRequest, res: Response) {
  try {
    const { endpoint, keys } = req.body;
    const result = await NotificationService.subscribePush(
      req.user!.userId,
      endpoint,
      keys.p256dh,
      keys.auth
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function unsubscribePush(req: AuthRequest, res: Response) {
  try {
    const { endpoint } = req.body;
    const result = await NotificationService.unsubscribePush(
      req.user!.userId,
      endpoint
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
