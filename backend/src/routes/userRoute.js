import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { authMe, getUserById, updateAvatar } from "../controllers/userController.js";
import { uploadAvatar } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.get("/me", protectedRoute, authMe);

router.put("/me/avatar", protectedRoute, uploadAvatar.single("avatar"), updateAvatar);

router.get("/:id", getUserById);

export default router;
