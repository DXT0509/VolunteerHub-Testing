import { Request, Response } from "express";
import * as EventService from "./event.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function create(req: AuthRequest, res: Response) {
  try {
    const result = await EventService.createEvent(req.user!.userId, req.body);
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
