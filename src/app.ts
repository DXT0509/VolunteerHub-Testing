import express from "express";
import cors from "cors";
import dotevn from "dotenv";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";
import eventRoutes from "./modules/events/event.routes";
import registratonRoutes from "./modules/registrations/registration.routes";
import channelRoutes from "./modules/channels/channel.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import adminRoutes from "./modules/admin/admin.routes";

dotevn.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("VolunteerHub API running"));
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/events", eventRoutes);
app.use("/registrations", registratonRoutes);
app.use("/channels", channelRoutes);
app.use("/notifications", notificationRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/admin", adminRoutes);

export default app;
