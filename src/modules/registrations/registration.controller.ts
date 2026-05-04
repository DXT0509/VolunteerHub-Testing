import { Request, Response } from "express";
import * as RegistrationService from "./registration.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function registerEvent(req: AuthRequest, res: Response) {
  try {
    const result = await RegistrationService.registerEvent(
      req.user!.userId,
      parseInt(String(req.params.eventId))
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function cancelRegistration(req: AuthRequest, res: Response) {
  try {
    const result = await RegistrationService.cancelRegistration(
      req.user!.userId,
      parseInt(String(req.params.eventId))
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getUserRegistrations(req: AuthRequest, res: Response) {
  try {
    const result = await RegistrationService.getUserRegistrations(
      req.user!.userId
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getPendingRegistrations(req: AuthRequest, res: Response) {
  try {
    const result = await RegistrationService.getPendingRegistrations(
      req.user!.userId
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getApprovedRegistrations(req: AuthRequest, res: Response) {
  try {
    const result = await RegistrationService.getApprovedRegistrations(
      req.user!.userId
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateRegistrationStatus(
  req: AuthRequest,
  res: Response
) {
  try {
    const result = await RegistrationService.updateRegistrationStatus(
      req.user!.userId,
      parseInt(String(req.params.regId)),
      req.body.status
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function finalizeRegistration(req: AuthRequest, res: Response) {
  try {
    const result = await RegistrationService.finalizeRegistration(
      req.user!.userId,
      parseInt(String(req.params.regId)),
      req.body.status
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function checkIn(req: Request, res: Response) {
  try {
    const result = await RegistrationService.checkIn(
      parseInt(String(req.params.regId))
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function checkOut(req: Request, res: Response) {
  try {
    const result = await RegistrationService.checkOut(
      parseInt(String(req.params.regId))
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getEventRegistrations(req: AuthRequest, res: Response) {
  try {
    const result = await RegistrationService.getEventRegistrations(
      req.user!.userId,
      parseInt(String(req.params.eventId))
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
