import express from "express";
import cors from "cors";
import dotevn from "dotenv";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";

dotevn.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("VolunteerHub API running"));
app.use("/auth", authRoutes);
app.use("/users", userRoutes);

export default app;
