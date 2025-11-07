import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "volunteerhub_secret";

export interface JwtPayload {
  userId: number;
  role: string;
}

export function signToken(payload: JwtPayload, expiresIn: "1h") {
  return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
