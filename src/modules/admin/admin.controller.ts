import { Request, Response } from "express";
import * as AdminService from "./admin.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function approve(req: AuthRequest, res: Response) {
  try {
    const { action, note } = req.body;
    const result = await AdminService.approveEvent(
      Number(req.params.id),
      action,
      note
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getAllUsers(req: Request, res: Response) {
  try {
    const users = await AdminService.listUsers();
    res.json(users);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateStatus(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    const { is_active } = req.body;
    const user = await AdminService.updateUserStatus(
      req.user!.userId,
      id,
      is_active
    );
    res.json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function changeUserRole(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    const { new_role } = req.body;
    const result = await AdminService.changeUserRole(
      req.user!.userId,
      id,
      new_role
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function exportData(req: Request, res: Response) {
  try {
    const { type, format } = req.query as { type: any; format: any };
    const { content, contentType } = await AdminService.exportData(
      type,
      format
    );

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${type}-${
        new Date().toISOString().split("T")[0]
      }.${format}`
    );
    res.send(content);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
