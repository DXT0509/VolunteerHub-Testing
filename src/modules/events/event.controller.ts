import { Request, Response } from "express";
import * as EventService from "./event.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function create(req: AuthRequest, res: Response) {
  try {
    // Support both JSON and multipart/form-data
    const body: any = req.body || {};
    // location may arrive as JSON string when using multipart
    if (typeof body.location === "string") {
      try { body.location = JSON.parse(body.location); } catch { /* keep as string if invalid */ }
    }
    // numeric conversions if provided as strings
    if (typeof body.category_id === "string" && body.category_id !== "") body.category_id = Number(body.category_id);
    if (typeof body.capacity === "string" && body.capacity !== "") body.capacity = Number(body.capacity);
    // attach banner_url if a file was uploaded
    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      body.banner_url = `${baseUrl}/uploads/${file.filename}`;
    }
    const result = await EventService.createEvent(req.user!.userId, body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const result = await EventService.listEvents(req.query);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function detailById(req: Request, res: Response) {
  try {
    const result = await EventService.getEventById(Number(req.params.id));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function detailBySlug(req: Request, res: Response) {
  try {
    const result = await EventService.getEventBySlug(req.params.slug);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const result = await EventService.updateEvent(
      Number(req.params.id),
      req.user!.userId,
      req.body
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const result = await EventService.deleteEvent(
      Number(req.params.id),
      req.user!.userId
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function finalize(req: AuthRequest, res: Response) {
  try {
    const { action, note } = req.body;
    const result = await EventService.finalizeevent(
      Number(req.params.id),
      req.user!.userId,
      action,
      note
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
