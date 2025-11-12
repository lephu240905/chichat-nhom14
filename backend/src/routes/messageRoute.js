import express from "express";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import {
  getMessages,
  sendMessage,
  getGroupMessages,
  markMessagesAsSeen,
  getLatestMessages,
} from "../controllers/messageController.js";

const router = express.Router();

// lấy tin nhắn mới nhất cho tất cả conversations
router.get("/latest/all", protectedRoute, getLatestMessages);

// lấy lịch sử tin nhắn giữa 2 người
router.get("/:receiverId", protectedRoute, getMessages);

// lấy lịch sử tin nhắn nhóm
router.get("/group/:groupId", protectedRoute, getGroupMessages);

// gửi tin nhắn mới
router.post("/", protectedRoute, sendMessage);

// đánh dấu tin nhắn đã xem
router.post("/seen", protectedRoute, markMessagesAsSeen);

export default router;
