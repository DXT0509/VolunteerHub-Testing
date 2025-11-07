import { Request, Response } from "express";
import * as AuthService from "./auth.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function register(req: Request, res: Response) {
  try {
    const { email, password, full_name, roleName } = req.body;
    const result = await AuthService.registerUser(
      email,
      password,
      full_name,
      roleName
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const result = await AuthService.loginUser(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    const user = await AuthService.getUserProfile(req.user!.userId);
    res.json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
