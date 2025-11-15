import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { uploadImage as uploadImageMw } from "../middlewares/uploadMiddleware.js";
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

// Upload ảnh
router.post(
  "/image",
  protectedRoute,
  uploadImageMw.single("image"),
  uploadImage
);

export default router;
