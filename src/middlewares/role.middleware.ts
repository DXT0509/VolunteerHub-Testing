import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export function authorize(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền truy cập tài nguyên này" });
    }
    next();
  };
}
