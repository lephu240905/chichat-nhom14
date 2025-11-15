import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { authMe, getUserById, updateAvatar } from "../controllers/userController.js";
import { uploadAvatar } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.get("/me", protectedRoute, authMe);

router.put("/me/avatar", protectedRoute, (req, res, next) => {
  uploadAvatar.single("avatar")(req, res, (err) => {
    if (err) {
      console.error("❌ Lỗi multer avatar:", err.message);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, updateAvatar);

router.get("/:id", getUserById);

export default router;
