import express from "express";
import {
  sendFriendRequest,
  respondFriendRequest,
  getFriends,
  getPendingRequests,
  cancelFriendRequest,
  unfriend,
} from "../controllers/friendController.js";
import { protectedRoute } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Gửi lời mời kết bạn bằng username
router.post("/request", protectedRoute, sendFriendRequest);

// Phản hồi (chấp nhận hoặc từ chối)
router.put("/respond/:id", protectedRoute, respondFriendRequest);

// Lấy danh sách bạn bè
router.get("/", protectedRoute, getFriends);

// Lấy danh sách lời mời đang chờ
router.get("/pending", protectedRoute, getPendingRequests);

// ❌ Hủy lời mời (người gửi)
router.delete("/cancel/:friendId", protectedRoute, cancelFriendRequest);

// ❌ Hủy kết bạn (unfriend)
router.delete("/unfriend/:friendId", protectedRoute, unfriend);

export default router;
