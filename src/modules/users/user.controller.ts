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
    const result = await UserService.updateProfile(req.user!.userId, req.body);
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
