import User from "../models/User.js";
import cloudinary from "../libs/cloudinary.js";
import fs from "fs/promises";
import { existsSync } from "fs";

export const authMe = async (req, res) => {
  try {
    const user = req.user; // lấy từ protectedRoute
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Lỗi khi gọi authMe:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-hashedPassword -__v");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }
    
    // Kiểm tra user có online không từ socket
    const io = req.app && req.app.get("io");
    let status = "offline";
    if (io) {
      const sockets = await io.fetchSockets();
      const isOnline = sockets.some((s) => s.handshake.query.userId === id);
      status = isOnline ? "online" : "offline";
    }
    
    const userWithStatus = {
      ...user.toObject(),
      status,
    };
    
    res.json(userWithStatus);
  } catch (err) {
    console.error("Lỗi getUserById:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// Cập nhật avatar
export const updateAvatar = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy user từ protectedRoute
    if (!req.file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    console.log("📤 Đang upload avatar lên Cloudinary:", req.file.originalname);

    // Xóa avatar cũ trên Cloudinary nếu có
    if (user.avatarId) {
      try {
        await cloudinary.uploader.destroy(user.avatarId);
        console.log("✅ Đã xóa avatar cũ trên Cloudinary:", user.avatarId);
      } catch (deleteError) {
        console.warn("⚠️ Không thể xóa avatar cũ:", deleteError);
        // Không throw error, tiếp tục upload avatar mới
      }
    }

    // Upload avatar mới lên Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "chat_app/avatars",
      resource_type: "image",
      timeout: 60000,
      chunk_size: 6000000,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" }, // Crop thành hình vuông 400x400, focus vào mặt
        { quality: "auto", fetch_format: "auto" } // Tự động tối ưu chất lượng
      ]
    });

    // Xóa file tạm sau khi upload thành công
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.warn("⚠️ Không thể xóa file tạm:", unlinkError.message);
    }

    console.log("✅ Upload avatar thành công:", result.secure_url);

    // Cập nhật avatar trong database
    user.avatarUrl = result.secure_url; // URL đầy đủ từ Cloudinary
    user.avatarId = result.public_id; // Public ID để xóa sau này
    await user.save();

    // Emit socket event để bạn bè cập nhật avatar real-time
    const io = req.app && req.app.get("io");
    if (io) {
      io.emit("user_avatar_updated", {
        userId: userId.toString(),
        avatarUrl: result.secure_url,
      });
    }

    res.status(200).json({
      message: "Cập nhật avatar thành công",
      avatarUrl: result.secure_url,
    });
  } catch (error) {
    console.error("❌ Lỗi cập nhật avatar:", error);
    
    // Xóa file tạm nếu có lỗi
    if (req.file && existsSync(req.file.path)) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn("⚠️ Không thể xóa file tạm:", unlinkError.message);
      }
    }
    
    res.status(500).json({ 
      message: "Lỗi cập nhật avatar",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};
