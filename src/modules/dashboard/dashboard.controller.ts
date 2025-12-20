import { Response } from "express";
import * as DashboardService from "./dashboard.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export async function getDashboard(reqa: AuthRequest, res: Response) {
  try {
    let result;
    if (!reqa.user) {
      result = await DashboardService.getDefaultDashboard();
    } else {
      const role = reqa.user.role;
      if (role === "VOLUNTEER") {
        result = await DashboardService.getVolunteerDashboard(reqa.user.userId);
      } else if (role === "EVENT_MANAGER") {
        result = await DashboardService.getManagerDashboard(reqa.user.userId);
      } else if (role === "ADMIN") {
        result = await DashboardService.getAdminDashboard();
      } else {
        result = await DashboardService.getDefaultDashboard();
      }
    }

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
