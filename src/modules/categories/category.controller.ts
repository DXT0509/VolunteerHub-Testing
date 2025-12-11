import { Response } from "express";
import { listCategories } from "./category.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function list(req: AuthRequest, res: Response) {
  try {
    const categories = await listCategories();
    res.json(categories);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
