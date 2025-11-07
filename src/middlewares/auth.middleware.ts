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
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "Thiếu hoặc sai token" });

  const token = header.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded)
    return res
      .status(401)
      .json({ error: "Token không hợp lệ hoặc đã hết hạn" });

  req.user = decoded;
  next();
}
