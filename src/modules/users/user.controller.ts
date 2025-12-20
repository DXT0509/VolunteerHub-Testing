import { Request, Response } from "express";
import * as UserService from "./user.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const user = await UserService.getProfile(req.user!.userId);
    res.json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateMe(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { full_name, phone, username } = req.body as any;
    // If a file was uploaded, build the public URL path
    const avatarFile = (req as any).file as Express.Multer.File | undefined;
    const avatar_url = avatarFile ? `/uploads/${avatarFile.filename}` : undefined;

    const payload: any = { full_name, phone, username };
    if (avatar_url) payload.avatar_url = avatar_url;

    const result = await UserService.updateProfile(userId, payload);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = await UserService.changePassword(
      req.user!.userId,
      oldPassword,
      newPassword
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { userId, newPassword } = req.body;
    const result = await UserService.resetPassword(
      userId,
      newPassword
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}