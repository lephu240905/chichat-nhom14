import Friend from "../models/friendModel.js";
import User from "../models/User.js";

// 🧑‍🤝‍🧑 Gửi lời mời kết bạn bằng username
export const sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Thiếu username người nhận" });
    }

    const receiver = await User.findOne({ username });
    if (!receiver) {
      return res.status(404).json({ message: "Không tìm thấy người nhận" });
    }

    if (receiver._id.toString() === senderId.toString()) {
      return res
        .status(400)
        .json({ message: "Không thể gửi lời mời cho chính mình" });
    }

    const existing = await Friend.findOne({
      $or: [
        { sender: senderId, receiver: receiver._id },
        { sender: receiver._id, receiver: senderId },
      ],
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "Đã có lời mời hoặc đã là bạn bè" });
    }

    let request = await Friend.create({
      sender: senderId,
      receiver: receiver._id,
      status: "pending",
    });

    request = await request.populate("sender", "username email displayName avatarUrl status");
    request = await request.populate("receiver", "username email displayName avatarUrl status");

    // ✅ Gửi realtime đến người nhận
    const io = req.app && req.app.get("io");
    if (io) {
      // Gửi đến người nhận
      io.to(receiver._id.toString()).emit("new_friend_request", {
        from: req.user.username,
        request,
      });
      
      // Gửi đến người gửi để cập nhật sent requests ngay lập tức
      io.to(senderId.toString()).emit("friend_request_sent", {
        request,
      });
    }

    res.status(201).json({
      message: `Đã gửi lời mời kết bạn đến ${receiver.username}`,
      request,
    });
  } catch (error) {
    console.error("🔥 Lỗi khi gửi lời mời:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ✅ Chấp nhận hoặc từ chối lời mời kết bạn
export const respondFriendRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const currentUserId = req.user._id;

    const friendReq = await Friend.findById(id).populate("sender", "username email displayName avatarUrl").populate("receiver", "username email displayName avatarUrl");
    if (!friendReq)
      return res.status(404).json({ message: "Không tìm thấy lời mời" });

    const io = req.app && req.app.get("io");
    const senderId = friendReq.sender._id.toString();
    const receiverId = friendReq.receiver._id.toString();

    if (action === "accept") {
      friendReq.status = "accepted";
      await friendReq.save();
      
      // Populate lại để có đầy đủ thông tin
      await friendReq.populate("sender", "username email displayName avatarUrl status");
      await friendReq.populate("receiver", "username email displayName avatarUrl status");
      
      // Emit socket event cho cả 2 bên
      if (io) {
        const friendData = {
          friendRequest: friendReq,
          friend: friendReq.sender._id.toString() === currentUserId.toString() 
            ? friendReq.receiver 
            : friendReq.sender,
        };
        
        // Gửi đến cả 2 bên để cả 2 đều cập nhật danh sách bạn bè
        io.to(receiverId).emit("friend_request_accepted", friendData);
        io.to(senderId).emit("friend_request_accepted", {
          friendRequest: friendReq,
          friend: friendReq.receiver._id.toString() === currentUserId.toString() 
            ? friendReq.sender 
            : friendReq.receiver,
        });
      }
      
      return res.status(200).json({ 
        message: "Đã chấp nhận lời mời",
        friendRequest: friendReq 
      });
    }

    if (action === "reject") {
      await Friend.findByIdAndDelete(id);
      
      // Emit socket event cho người gửi để xóa sent request
      if (io) {
        io.to(senderId).emit("friend_request_rejected", {
          requestId: id,
          receiverId: receiverId,
        });
      }
      
      return res.status(200).json({ message: "Đã từ chối lời mời" });
    }

    res.status(400).json({ message: "Hành động không hợp lệ" });
  } catch (error) {
    console.error("❌ Lỗi khi phản hồi lời mời:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// 📋 Lấy danh sách bạn bè
export const getFriends = async (req, res) => {
  try {
    const userId = req.user._id;
    const friends = await Friend.find({
      $or: [
        { sender: userId, status: "accepted" },
        { receiver: userId, status: "accepted" },
      ],
    })
      .populate("sender", "username email displayName avatarUrl")
      .populate("receiver", "username email displayName avatarUrl");

    // Lấy danh sách user online từ socket
    const io = req.app && req.app.get("io");
    const onlineUserIds = new Set();
    if (io) {
      // Lấy tất cả sockets đang connected
      const sockets = await io.fetchSockets();
      sockets.forEach((s) => {
        const uid = s.handshake.query.userId;
        if (uid) onlineUserIds.add(uid.toString());
      });
    }

    // Thêm status vào friends
    const friendsWithStatus = friends.map((f) => {
      const senderId = f.sender._id.toString();
      const receiverId = f.receiver._id.toString();
      
      return {
        ...f.toObject(),
        sender: {
          ...f.sender.toObject(),
          status: onlineUserIds.has(senderId) ? "online" : "offline",
        },
        receiver: {
          ...f.receiver.toObject(),
          status: onlineUserIds.has(receiverId) ? "online" : "offline",
        },
      };
    });

    res.status(200).json(friendsWithStatus);
  } catch (error) {
    console.error("❌ Lỗi lấy danh sách bạn bè:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// 🕓 Lấy danh sách lời mời chờ
export const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const pending = await Friend.find({
      $or: [{ receiver: userId }, { sender: userId }],
      status: "pending",
    })
      .populate("sender", "username email displayName avatarUrl status")
      .populate("receiver", "username email displayName avatarUrl status");

    res.status(200).json(pending);
  } catch (error) {
    console.error("❌ Lỗi lấy lời mời chờ:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const cancelFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { friendId } = req.params;

    const friend = await Friend.findById(friendId);
    if (!friend) {
      return res.status(404).json({ message: "Không tìm thấy lời mời" });
    }

    if (friend.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền hủy lời mời này" });
    }

    await friend.deleteOne();
    
    // Emit socket event để người nhận biết lời mời đã bị hủy
    const io = req.app && req.app.get("io");
    if (io) {
      io.to(friend.receiver.toString()).emit("friend_request_cancelled", {
        requestId: friendId,
        senderId: userId.toString(),
      });
    }
    
    res.status(200).json({ message: "Đã hủy lời mời kết bạn" });
  } catch (error) {
    console.error("❌ Lỗi khi hủy lời mời:", error);
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};

// Hủy kết bạn (unfriend)
export const unfriend = async (req, res) => {
  try {
    const userId = req.user._id;
    const { friendId } = req.params; // userId của người bạn muốn hủy kết bạn

    // Tìm friend relationship
    const friend = await Friend.findOne({
      $or: [
        { sender: userId, receiver: friendId, status: "accepted" },
        { sender: friendId, receiver: userId, status: "accepted" },
      ],
    });

    if (!friend) {
      return res.status(404).json({ message: "Không tìm thấy bạn bè" });
    }

    // Xóa friend relationship
    await friend.deleteOne();

    // Xóa tất cả messages giữa 2 người
    const Message = (await import("../models/Message.js")).default;
    await Message.deleteMany({
      $or: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
      ],
    });

    // Xóa chat customizations
    const ChatCustomization = (await import("../models/ChatCustomization.js")).default;
    await ChatCustomization.deleteMany({
      $or: [
        { userId, chatId: friendId, isGroup: false },
        { userId: friendId, chatId: userId, isGroup: false },
      ],
    });

    // Emit socket event để cả 2 bên biết
    const io = req.app && req.app.get("io");
    if (io) {
      io.to(String(userId)).emit("friendRemoved", { friendId });
      io.to(String(friendId)).emit("friendRemoved", { friendId: userId });
    }

    res.status(200).json({ message: "Đã hủy kết bạn thành công" });
  } catch (error) {
    console.error("❌ Lỗi khi hủy kết bạn:", error);
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};
