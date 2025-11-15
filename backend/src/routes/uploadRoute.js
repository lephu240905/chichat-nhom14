import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { uploadImage as uploadImageMw } from "../middlewares/uploadMiddleware.js";
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

// Upload ảnh
router.post(
  "/image",
  protectedRoute,
  (req, res, next) => {
    uploadImageMw.single("image")(req, res, (err) => {
      if (err) {
        console.error("❌ Lỗi multer:", err.message);
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  uploadImage
);

export default router;
