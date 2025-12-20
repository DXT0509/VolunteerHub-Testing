import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  req.user = undefined; // reset trước

  if (header?.startsWith("Bearer ")) {
    const token = header.split(" ")[1];
    const decoded = verifyToken(token);

    if (decoded) {
      req.user = decoded; // CHỈ gán khi hợp lệ
    }
  }

  next();
}
