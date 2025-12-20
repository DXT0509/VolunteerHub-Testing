import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { getMe, updateMe, changePassword, resetPassword } from "./user.controller";

const router = Router();

// Multer storage config: save to src/uploads
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, uploadDir),
	filename: (req, file, cb) => {
		const userId = (req as any)?.user?.userId || "anon";
		const ext = path.extname(file.originalname);
		const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
		const ts = Date.now();
		cb(null, `${userId}_${base}_${ts}${ext}`);
	},
});
const upload = multer({ storage });

//User
router.get("/me", authenticate, getMe);
// Accept multipart form-data with optional 'avatar' file
router.put("/me", authenticate, upload.single("avatar"), updateMe);
router.put("/change-password", authenticate, changePassword);
router.post("/reset-password", resetPassword);
export default router;
