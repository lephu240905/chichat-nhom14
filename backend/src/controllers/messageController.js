import Message from "../models/Message.js";
import Group from "../models/Group.js";

// 📨 Gửi tin nhắn
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, imgUrl, audioUrl, gifUrl, messageType, groupId } = req.body;
    const senderId = req.user._id;

    // If groupId provided, validate sender is member
    if (groupId) {
      const group = await Group.findById(groupId).select("members name");
      if (!group)
        return res.status(404).json({ message: "Group không tồn tại" });
      const isMember = group.members.some(
        (m) => String(m) === String(senderId)
      );
      if (!isMember)
        return res
          .status(403)
          .json({ message: "Bạn không phải thành viên nhóm" });
    }

    const message = await Message.create({
      senderId,
      receiverId: receiverId || null,
      groupId: groupId || null,
      content: content || "",
      imgUrl: imgUrl || "",
      audioUrl: audioUrl || "",
      gifUrl: gifUrl || "",
      messageType: messageType || "text",
    });

    const populatePaths = [
      { path: "senderId", select: "username displayName avatarUrl" },
      { path: "seenBy.userId", select: "username displayName avatarUrl" },
    ];
    if (groupId) populatePaths.push({ path: "groupId", select: "name" });
    else
      populatePaths.push({
        path: "receiverId",
        select: "username displayName avatarUrl",
      });

    const populatedMsg = await message.populate(populatePaths);

    return res.status(201).json(populatedMsg);
  } catch (error) {
    console.error("❌ Lỗi gửi tin nhắn:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// 📜 Lấy lịch sử chat giữa 2 user
export const getMessages = async (req, res) => {
  try {
    // ✅ Đúng tên param trong route
    const { receiverId } = req.params;
    const currentUserId = req.user._id;

    // 🔍 Lấy tin nhắn giữa 2 người (dù ai gửi)
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId },
        { senderId: receiverId, receiverId: currentUserId },
      ],
    })
      .populate("senderId", "username displayName avatarUrl")
      .populate("receiverId", "username displayName avatarUrl")
      .populate("seenBy.userId", "username displayName avatarUrl")
      .sort({ createdAt: 1 });

    return res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Lỗi lấy tin nhắn:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Lấy tin nhắn của 1 nhóm
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId).select("members");
    if (!group) return res.status(404).json({ message: "Group không tồn tại" });

    const isMember = group.members.some(
      (m) => String(m) === String(currentUserId)
    );
    if (!isMember)
      return res
        .status(403)
        .json({ message: "Bạn không phải thành viên nhóm" });

    const messages = await Message.find({ groupId })
      .populate("senderId", "username displayName avatarUrl")
      .populate("groupId", "name")
      .populate("seenBy.userId", "username displayName avatarUrl")
      .sort({ createdAt: 1 });

    return res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Lỗi lấy tin nhắn nhóm:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Đánh dấu tin nhắn đã xem
export const markMessagesAsSeen = async (req, res) => {
  try {
    const { receiverId, groupId } = req.body;
    const currentUserId = req.user._id;

    if (!receiverId && !groupId) {
      return res.status(400).json({ message: "Thiếu receiverId hoặc groupId" });
    }

    let query = {};
    if (groupId) {
      // Với group chat: đánh dấu tất cả tin nhắn trong nhóm mà user chưa xem
      query = { groupId };
    } else {
      // Với private chat: đánh dấu tin nhắn từ người kia gửi đến user hiện tại
      query = {
        senderId: receiverId,
        receiverId: currentUserId,
      };
    }

    // Tìm tất cả tin nhắn chưa được user này xem
    const messages = await Message.find(query);

    // Đánh dấu từng tin nhắn là đã xem
    const updatePromises = messages.map(async (message) => {
      // Kiểm tra xem user đã xem chưa
      const alreadySeen = message.seenBy.some(
        (seen) => String(seen.userId) === String(currentUserId)
      );

      if (!alreadySeen) {
        message.seenBy.push({
          userId: currentUserId,
          seenAt: new Date(),
        });
        await message.save();
      }
    });

    await Promise.all(updatePromises);

    // Emit socket event để người gửi biết tin nhắn đã được xem
    const io = req.app && req.app.get("io");
    if (io) {
      if (groupId) {
        // Với group: emit đến tất cả thành viên (trừ người xem)
        const group = await Group.findById(groupId).select("members");
        if (group) {
          group.members.forEach((memberId) => {
            if (String(memberId) !== String(currentUserId)) {
              io.to(String(memberId)).emit("messagesSeen", {
                groupId,
                seenBy: currentUserId,
              });
            }
          });
        }
      } else {
        // Với private: emit đến người gửi (receiverId là người gửi tin nhắn)
        // currentUserId là người đã xem
        io.to(String(receiverId)).emit("messagesSeen", {
          receiverId: currentUserId, // Người đã xem
          seenBy: currentUserId, // Người đã xem
        });
      }
    }

    return res.status(200).json({ 
      message: "Đã đánh dấu tin nhắn là đã xem",
      count: messages.length 
    });
  } catch (error) {
    console.error("❌ Lỗi đánh dấu tin nhắn đã xem:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// Lấy tin nhắn mới nhất cho tất cả conversations
export const getLatestMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const Friend = (await import("../models/friendModel.js")).default;

    // Lấy danh sách bạn bè đã chấp nhận
    const friends = await Friend.find({
      status: "accepted",
      $or: [
        { sender: currentUserId },
        { receiver: currentUserId },
      ],
    })
      .populate("sender", "username displayName avatarUrl")
      .populate("receiver", "username displayName avatarUrl");

    // Lấy danh sách nhóm
    const groups = await Group.find({
      members: currentUserId,
    }).select("_id name members");

    // Lấy tin nhắn mới nhất cho mỗi friend
    const friendLatestMessages = await Promise.all(
      friends.map(async (friend) => {
        const friendId = friend.sender._id.toString() === currentUserId.toString()
          ? friend.receiver._id
          : friend.sender._id;

        const latestMessage = await Message.findOne({
          $or: [
            { senderId: currentUserId, receiverId: friendId },
            { senderId: friendId, receiverId: currentUserId },
          ],
        })
          .populate("senderId", "username displayName avatarUrl")
          .populate("seenBy.userId", "username displayName avatarUrl")
          .sort({ createdAt: -1 })
          .limit(1);

        return {
          chatId: friendId.toString(),
          isGroup: false,
          latestMessage: latestMessage || null,
        };
      })
    );

    // Lấy tin nhắn mới nhất cho mỗi group
    const groupLatestMessages = await Promise.all(
      groups.map(async (group) => {
        const latestMessage = await Message.findOne({ groupId: group._id })
          .populate("senderId", "username displayName avatarUrl")
          .populate("seenBy.userId", "username displayName avatarUrl")
          .sort({ createdAt: -1 })
          .limit(1);

        return {
          chatId: group._id.toString(),
          isGroup: true,
          latestMessage: latestMessage || null,
        };
      })
    );

    // Kết hợp tất cả
    const allLatestMessages = [
      ...friendLatestMessages,
      ...groupLatestMessages,
    ];

    return res.status(200).json(allLatestMessages);
  } catch (error) {
    console.error("❌ Lỗi lấy tin nhắn mới nhất:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
