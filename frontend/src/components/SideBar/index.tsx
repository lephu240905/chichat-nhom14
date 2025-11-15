"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageCircle,
  Users,
  UserPlus,
  Check,
  X,
  Moon,
  Sun,
  Clock,
  Search,
  Camera,
  Settings,
  LogOut,
  MoreHorizontal,
} from "lucide-react";
import { io } from "socket.io-client";
import api from "@/lib/axios";
import { groupService } from "@/services/groupService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNavigate } from "react-router";
import { toast } from "sonner";

// Helper function để build avatar URL
const getAvatarUrl = (avatarUrl: string | undefined) => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  const baseURL = import.meta.env.MODE === "development"
    ? "http://localhost:5001"
    : "";
  return `${baseURL}${avatarUrl}`;
};

interface SidebarProps {
  selectedChat: string | null;
  onSelectChat: (id: string) => void;
  isDark: boolean;
  onToggleDark: () => void;
  user: any;
}

export default function Sidebar({
  selectedChat,
  onSelectChat,
  isDark,
  onToggleDark,
  user,
}: SidebarProps) {
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [userData, setUserData] = useState<any>(user);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [latestMessages, setLatestMessages] = useState<Record<string, any>>({});
  const [openFriendMenu, setOpenFriendMenu] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const friendMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectedChatRef = useRef<string | null>(selectedChat);
  const onSelectChatRef = useRef(onSelectChat);
  const { signOut } = useAuthStore();
  const navigate = useNavigate();

  // Load user data on mount
  useEffect(() => {
    if (user) {
      setUserData(user);
    }
  }, [user]);

  // Update refs when props change
  useEffect(() => {
    selectedChatRef.current = selectedChat;
    onSelectChatRef.current = onSelectChat;
  }, [selectedChat, onSelectChat]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(event.target as Node)
      ) {
        setShowSettingsMenu(false);
      }

      // Close friend menu when clicking outside
      if (openFriendMenu) {
        const menuRef = friendMenuRefs.current[openFriendMenu];
        if (menuRef && !menuRef.contains(event.target as Node)) {
          setOpenFriendMenu(null);
        }
      }
    };

    if (showSettingsMenu || openFriendMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettingsMenu, openFriendMenu]);

  // Listen for avatar updates
  useEffect(() => {
    const handleAvatarUpdate = (e: CustomEvent) => {
      if (userData) {
        setUserData({ ...userData, avatarUrl: e.detail.avatarUrl });
      }
    };

    window.addEventListener('userAvatarUpdated', handleAvatarUpdate as EventListener);
    return () => {
      window.removeEventListener('userAvatarUpdated', handleAvatarUpdate as EventListener);
    };
  }, [userData]);

  // 📥 Lấy danh sách bạn bè và lời mời
  const fetchFriends = async () => {
    try {
      // Fetch cả 2 API song song để nhanh hơn
      const [resFriends, resPending] = await Promise.all([
        api.get("/friends"),
        api.get("/friends/pending")
      ]);

      const accepted = resFriends.data.filter(
        (f: any) => f.status === "accepted"
      );
      setFriends(accepted);

      const pending = resPending.data;
      const sent = pending.filter((f: any) => f.sender._id === user._id);
      const received = pending.filter((f: any) => f.receiver._id === user._id);

      setSentRequests(sent);
      setReceivedRequests(received);
    } catch (err) {
      console.error("Lỗi lấy danh sách bạn:", err);
    }
  };

  useEffect(() => {
    if (!user?._id) return;

    fetchFriends();
    fetchGroups();
    fetchLatestMessages();

    // ✅ Kết nối socket và lắng nghe realtime
    const socketUrl = import.meta.env.MODE === "development"
      ? "http://localhost:5001"
      : window.location.origin;
    const socket = io(socketUrl, {
      query: { userId: user._id },
    });

    socket.on("new_friend_request", (data) => {
      console.log("📥 Có lời mời kết bạn mới:", data);
      setReceivedRequests((prev) => {
        // Kiểm tra xem đã có request này chưa để tránh duplicate
        const exists = prev.some((r) => r._id === data.request._id);
        if (exists) return prev;
        return [...prev, data.request];
      });
    });

    socket.on("friend_request_sent", (data) => {
      console.log("✅ Đã gửi lời mời kết bạn:", data);
      setSentRequests((prev) => {
        // Kiểm tra xem đã có request này chưa để tránh duplicate
        const exists = prev.some((r) => r._id === data.request._id);
        if (exists) return prev;
        return [...prev, data.request];
      });
    });

    socket.on("friend_request_accepted", (data) => {
      console.log("✅ Lời mời kết bạn đã được chấp nhận:", data);
      // Xóa khỏi sent requests nếu có
      setSentRequests((prev) => prev.filter((r) => r._id !== data.friendRequest?._id));
      // Xóa khỏi received requests nếu có
      setReceivedRequests((prev) => prev.filter((r) => r._id !== data.friendRequest?._id));
      // Refresh danh sách bạn bè ngay lập tức
      fetchFriends();
      // Hiển thị toast thông báo
      toast.success("Đã trở thành bạn bè!", {
        description: `Bạn và ${data.friend?.displayName || data.friend?.username} đã trở thành bạn bè`,
      });
    });

    socket.on("friend_request_rejected", (data) => {
      console.log("❌ Lời mời kết bạn đã bị từ chối:", data);
      // Xóa khỏi sent requests
      setSentRequests((prev) => prev.filter((r) => r._id !== data.requestId));
    });

    socket.on("friend_request_cancelled", (data) => {
      console.log("🚫 Lời mời kết bạn đã bị hủy:", data);
      // Xóa khỏi received requests
      setReceivedRequests((prev) => prev.filter((r) => r._id !== data.requestId));
    });

    // Listen for avatar updates từ bạn bè
    socket.on("user_avatar_updated", (data: { userId: string; avatarUrl: string }) => {
      // Cập nhật avatar trong danh sách bạn bè
      setFriends((prevFriends) => {
        return prevFriends.map((f) => {
          const friend = f.sender._id === user._id ? f.receiver : f.sender;
          if (friend._id === data.userId) {
            return {
              ...f,
              sender: f.sender._id === data.userId
                ? { ...f.sender, avatarUrl: data.avatarUrl }
                : f.sender,
              receiver: f.receiver._id === data.userId
                ? { ...f.receiver, avatarUrl: data.avatarUrl }
                : f.receiver,
            };
          }
          return f;
        });
      });
    });

    // Listen for status changes
    socket.on("user_status_changed", (data: { userId: string; status: "online" | "offline" }) => {
      // Cập nhật status trong danh sách bạn bè
      setFriends((prevFriends) => {
        return prevFriends.map((f) => {
          const friend = f.sender._id === user._id ? f.receiver : f.sender;
          if (friend._id === data.userId) {
            return {
              ...f,
              sender: f.sender._id === data.userId
                ? { ...f.sender, status: data.status }
                : f.sender,
              receiver: f.receiver._id === data.userId
                ? { ...f.receiver, status: data.status }
                : f.receiver,
            };
          }
          return f;
        });
      });
    });

    socket.on("groupCreated", (group: any) => {
      // Nếu user là thành viên, refresh danh sách nhóm
      try {
        const memberIds = (group.members || []).map((m: any) =>
          m._id ? m._id : m
        );
        if (memberIds.includes(user._id)) {
          fetchGroups();
          fetchLatestMessages();
        }
      } catch (e) {
        console.error("Lỗi xử lý groupCreated trong sidebar", e);
      }
    });

    // Lắng nghe tin nhắn mới để cập nhật latest messages
    socket.on("receiveMessage", (message: any) => {
      const chatId = message.groupId
        ? message.groupId._id || message.groupId
        : (String(message.senderId._id || message.senderId) === String(user._id)
          ? message.receiverId._id || message.receiverId
          : message.senderId._id || message.senderId);

      setLatestMessages((prev) => ({
        ...prev,
        [String(chatId)]: message,
      }));
    });

    // Lắng nghe khi có tin nhắn đã được xem để cập nhật
    socket.on("messagesSeen", () => {
      // Refresh latest messages để cập nhật seenBy
      fetchLatestMessages();
    });

    // Lắng nghe khi có người hủy kết bạn
    socket.on("friendRemoved", (data: { friendId: string }) => {
      // Xóa friend khỏi danh sách
      setFriends((prev) => prev.filter((f) => {
        const friend = f.sender._id === user._id ? f.receiver : f.sender;
        return friend._id !== data.friendId;
      }));

      // Nếu đang chat với người này, đóng chat
      if (selectedChatRef.current === data.friendId && onSelectChatRef.current) {
        onSelectChatRef.current("");
      }

      // Xóa latest message
      setLatestMessages((prev) => {
        const newMessages = { ...prev };
        delete newMessages[data.friendId];
        return newMessages;
      });
    });

    // Listen for window event (fallback)
    const handleWindowGroupCreated = () => {
      fetchGroups();
      fetchLatestMessages();
    };
    window.addEventListener('groupCreated', handleWindowGroupCreated);
    window.addEventListener('refreshGroups', handleWindowGroupCreated);

    // Listen for chat selection to refresh latest messages
    const handleChatSelected = () => {
      fetchLatestMessages();
    };
    window.addEventListener('chatSelected', handleChatSelected);

    return () => {
      socket.disconnect();
      window.removeEventListener('groupCreated', handleWindowGroupCreated);
      window.removeEventListener('refreshGroups', handleWindowGroupCreated);
      window.removeEventListener('chatSelected', handleChatSelected);
    };
  }, [user]);

  const fetchGroups = async () => {
    try {
      const res = await groupService.listMyGroups();
      setGroups(res || []);
    } catch (err) {
      console.error("Lỗi tải nhóm:", err);
    }
  };

  // 📨 Lấy tin nhắn mới nhất cho tất cả conversations
  const fetchLatestMessages = async () => {
    try {
      const res = await api.get("/messages/latest/all");
      const messagesMap: Record<string, any> = {};
      res.data.forEach((item: any) => {
        messagesMap[item.chatId] = item.latestMessage;
      });
      setLatestMessages(messagesMap);
    } catch (err) {
      console.error("Lỗi lấy tin nhắn mới nhất:", err);
    }
  };

  // Helper function để lấy preview text của tin nhắn
  const getMessagePreview = (message: any): string => {
    if (!message) return "";
    if (message.messageType === "image") return "📷 Hình ảnh";
    if (message.messageType === "audio") return "🎤 Voice message";
    if (message.messageType === "gif") return "🎬 GIF";
    if (message.messageType === "emoji") return message.content || "😊";
    return message.content || "";
  };

  // Helper function để kiểm tra tin nhắn đã được xem chưa
  const isMessageSeen = (message: any): boolean => {
    if (!message) return true;

    const senderId = String(message.senderId._id || message.senderId);
    const currentUserId = String(user._id);

    // Nếu tin nhắn là của chính user thì luôn coi là đã xem
    if (senderId === currentUserId) {
      return true;
    }

    // Với private chat: tin nhắn từ người kia, kiểm tra xem user đã xem chưa
    // Với group chat: kiểm tra xem user đã xem tin nhắn chưa
    if (!message.seenBy || message.seenBy.length === 0) {
      return false;
    }

    // Kiểm tra xem user hiện tại có trong seenBy không
    return message.seenBy.some(
      (seen: any) => String(seen.userId._id || seen.userId) === currentUserId
    );
  };

  // ➕ Gửi lời mời kết bạn
  const handleAddFriend = async () => {
    if (!username.trim()) {
      toast.warning("Vui lòng nhập username", {
        description: "Nhập username người cần kết bạn",
      });
      return;
    }
    try {
      const res = await api.post("/friends/request", { username });
      const { request } = res.data;
      toast.success("Đã gửi lời mời kết bạn!", {
        description: `Lời mời đã được gửi đến ${username}`,
      });
      setUsername("");
      // Socket event sẽ tự động cập nhật sentRequests, nhưng cũng cập nhật ngay để UX tốt hơn
      setSentRequests((prev) => {
        const exists = prev.some((r) => r._id === request._id);
        if (exists) return prev;
        return [...prev, request];
      });
    } catch (err: any) {
      toast.error("Lỗi gửi lời mời", {
        description: err.response?.data?.message || "Lỗi hệ thống",
      });
    }
  };

  // 🤝 Chấp nhận lời mời
  const handleAccept = async (friendId: string) => {
    try {
      await api.put(`/friends/respond/${friendId}`, { action: "accept" });
      // Xóa khỏi received requests ngay lập tức (UI update ngay)
      setReceivedRequests((prev) => prev.filter((r) => r._id !== friendId));
      // Refresh danh sách bạn bè ngay lập tức
      await fetchFriends();
      // Toast sẽ được hiển thị từ socket event để tránh duplicate
    } catch (err) {
      console.error("Lỗi chấp nhận:", err);
      toast.error("Lỗi chấp nhận lời mời");
    }
  };

  // 🚫 Từ chối lời mời
  const handleReject = async (friendId: string) => {
    try {
      await api.put(`/friends/respond/${friendId}`, { action: "reject" });
      toast.info("Đã từ chối lời mời", {
        description: "Lời mời đã được từ chối",
      });
      // Xóa khỏi received requests ngay lập tức
      setReceivedRequests((prev) => prev.filter((r) => r._id !== friendId));
    } catch (err) {
      console.error("Lỗi từ chối:", err);
      toast.error("Lỗi từ chối lời mời");
    }
  };

  // ❌ Hủy lời mời đã gửi
  const handleCancel = async (friendId: string) => {
    try {
      await api.delete(`/friends/cancel/${friendId}`);
      toast.info("Đã hủy lời mời", {
        description: "Lời mời kết bạn đã được hủy",
      });
      setSentRequests((prev) => prev.filter((r) => r._id !== friendId));
    } catch (err) {
      console.error("Lỗi khi hủy:", err);
      toast.error("Lỗi khi hủy lời mời");
    }
  };

  // ❌ Hủy kết bạn
  const handleUnfriend = async (friendId: string) => {
    if (!confirm("Bạn có chắc chắn muốn hủy kết bạn với người này không? Tất cả tin nhắn sẽ bị xóa.")) {
      return;
    }

    try {
      await api.delete(`/friends/unfriend/${friendId}`);
      toast.success("Đã hủy kết bạn thành công", {
        description: "Tất cả tin nhắn đã được xóa",
      });

      // Xóa friend khỏi danh sách
      setFriends((prev) => prev.filter((f) => {
        const friend = f.sender._id === user._id ? f.receiver : f.sender;
        return friend._id !== friendId;
      }));

      // Nếu đang chat với người này, đóng chat
      if (selectedChat === friendId && onSelectChat) {
        onSelectChat("");
      }

      // Xóa latest message
      setLatestMessages((prev) => {
        const newMessages = { ...prev };
        delete newMessages[friendId];
        return newMessages;
      });

      // Đóng menu
      setOpenFriendMenu(null);
    } catch (err: any) {
      console.error("Lỗi khi hủy kết bạn:", err);
      toast.error("Lỗi hủy kết bạn", {
        description: err.response?.data?.message || err.message,
      });
    }
  };

  const filteredFriends = friends
    .filter((f) => {
      const friend = f.sender._id === user._id ? f.receiver : f.sender;
      return friend.username.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const friendA = a.sender._id === user._id ? a.receiver : a.sender;
      const friendB = b.sender._id === user._id ? b.receiver : b.sender;
      const msgA = latestMessages[friendA._id];
      const msgB = latestMessages[friendB._id];

      // Nếu có tin nhắn chưa đọc, ưu tiên lên trên
      const isSeenA = isMessageSeen(msgA);
      const isSeenB = isMessageSeen(msgB);

      if (!isSeenA && isSeenB) return -1; // A chưa đọc, B đã đọc -> A lên trên
      if (isSeenA && !isSeenB) return 1; // A đã đọc, B chưa đọc -> B lên trên

      // Cả hai cùng trạng thái, sắp xếp theo thời gian
      if (msgA && msgB) {
        const timeA = new Date(msgA.createdAt || msgA.timestamp || 0).getTime();
        const timeB = new Date(msgB.createdAt || msgB.timestamp || 0).getTime();
        return timeB - timeA; // Mới nhất lên trên
      }

      if (msgA && !msgB) return -1;
      if (!msgA && msgB) return 1;
      return 0;
    });

  // 🧭 UI Giao diện (giữ nguyên từ bản đẹp)
  return (
    <div
      className={`w-80 flex flex-col transition-colors duration-300 shadow-xl ${isDark
          ? "bg-gradient-to-b from-gray-900 to-gray-800 text-white border-r border-gray-700"
          : "bg-gradient-to-b from-white to-gray-50 text-gray-900 border-r border-gray-200"
        }`}
    >
      {/* Header */}
      <div
        className={`p-5 border-b backdrop-blur-sm ${isDark
            ? "border-gray-700/50 bg-gray-900/80"
            : "border-gray-200/50 bg-white/80"
          }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-all duration-300 ${isDark
                ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20"
                : "bg-gradient-to-br from-blue-100 to-purple-100"
              }`}>
              <MessageCircle
                className={`w-5 h-5 transition-transform duration-300 ${isDark ? "text-blue-400" : "text-blue-600"
                  }`}
              />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Chats
            </h1>
          </div>
          <button
            onClick={onToggleDark}
            className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 hover:rotate-12 ${isDark
                ? "bg-gradient-to-br from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 shadow-lg shadow-gray-900/50"
                : "bg-gradient-to-br from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 shadow-md shadow-gray-200/50"
              }`}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-600" />
            )}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isDark ? "text-gray-400" : "text-gray-500"
              }`}
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm bạn bè..."
            className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm transition-all duration-300 ${isDark
                ? "bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500 focus:border-blue-500 focus:bg-gray-800 focus:shadow-lg focus:shadow-blue-500/20"
                : "bg-white/80 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10"
              } focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:scale-[1.02]`}
          />
        </div>
      </div>

      {/* Add friend section */}
      <div
        className={`p-4 border-b backdrop-blur-sm ${isDark
            ? "border-gray-700/50 bg-gray-900/50"
            : "border-gray-200/50 bg-white/50"
          }`}
      >
        <div className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập username..."
            className={`flex-1 px-4 py-3 rounded-xl border text-sm transition-all duration-300 ${isDark
                ? "bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500 focus:border-blue-500 focus:bg-gray-800 focus:shadow-lg focus:shadow-blue-500/20"
                : "bg-white/80 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10"
              } focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:scale-[1.02]`}
          />
          <button
            onClick={handleAddFriend}
            className="bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white p-3 rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Received requests */}
        {receivedRequests.length > 0 && (
          <div
            className={`p-4 border-b ${isDark ? "border-gray-800" : "border-gray-200"
              }`}
          >
            <h3
              className={`font-semibold mb-3 text-sm flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"
                }`}
            >
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              Lời mời kết bạn ({receivedRequests.length})
            </h3>
            <div className="space-y-2">
              {receivedRequests.map((r) => (
                <div
                  key={r._id}
                  className={`p-3 rounded-xl transition-colors ${isDark
                      ? "bg-gray-800 hover:bg-gray-700"
                      : "bg-gray-50 hover:bg-gray-100"
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {r.sender.username[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">
                        {r.sender.username}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(r._id)}
                      className="flex-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Chấp nhận
                    </button>
                    <button
                      onClick={() => handleReject(r._id)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${isDark
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                    >
                      <X className="w-3 h-3" />
                      Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent requests */}
        {sentRequests.length > 0 && (
          <div
            className={`p-4 border-b ${isDark ? "border-gray-800" : "border-gray-200"
              }`}
          >
            <h3
              className={`font-semibold mb-3 text-sm flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"
                }`}
            >
              <Clock className="w-4 h-4" />
              Đã gửi lời mời ({sentRequests.length})
            </h3>
            <div className="space-y-2">
              {sentRequests.map((r) => (
                <div
                  key={r._id}
                  className={`p-3 rounded-xl flex items-center justify-between transition-colors ${isDark ? "bg-gray-800" : "bg-gray-50"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {r.receiver.username[0].toUpperCase()}
                    </div>
                    <span className="text-sm">{r.receiver.username}</span>
                  </div>
                  <button
                    onClick={() => handleCancel(r._id)}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Groups list */}
        <div className="p-4 border-t">
          <h3
            className={`font-semibold mb-3 text-sm flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"
              }`}
          >
            <Users className="w-4 h-4" />
            Nhóm ({groups.length})
          </h3>
          {groups.length > 0 ? (
            <div className="space-y-1">
              {groups
                .sort((a, b) => {
                  const msgA = latestMessages[a._id];
                  const msgB = latestMessages[b._id];
                  const isSeenA = isMessageSeen(msgA);
                  const isSeenB = isMessageSeen(msgB);

                  // Ưu tiên tin nhắn chưa đọc
                  if (!isSeenA && isSeenB) return -1;
                  if (isSeenA && !isSeenB) return 1;

                  // Sắp xếp theo thời gian
                  if (msgA && msgB) {
                    const timeA = new Date(msgA.createdAt || msgA.timestamp || 0).getTime();
                    const timeB = new Date(msgB.createdAt || msgB.timestamp || 0).getTime();
                    return timeB - timeA;
                  }

                  if (msgA && !msgB) return -1;
                  if (!msgA && msgB) return 1;
                  return 0;
                })
                .map((g) => {
                  const latestMsg = latestMessages[g._id];
                  const messagePreview = getMessagePreview(latestMsg);
                  const isSeen = isMessageSeen(latestMsg);
                  const isSelected = selectedChat === g._id;

                  return (
                    <div
                      key={g._id}
                      onClick={() => {
                        onSelectChat(g._id);
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('chatSelected'));
                        }, 100);
                      }}
                      className={`p-3.5 rounded-2xl cursor-pointer transition-all duration-300 group relative ${isSelected
                          ? "bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white shadow-xl shadow-blue-500/40 scale-[1.02]"
                          : !isSeen
                            ? isDark
                              ? "bg-blue-900/30 border border-blue-700/50 hover:bg-blue-900/40"
                              : "bg-blue-50 border border-blue-200 hover:bg-blue-100"
                            : isDark
                              ? "hover:bg-gray-800/70 hover:shadow-lg hover:shadow-gray-900/20 hover:scale-[1.01]"
                              : "hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:shadow-md hover:shadow-gray-200/50 hover:scale-[1.01]"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shadow-lg transition-all duration-300 ${isSelected
                              ? "bg-white/20 ring-2 ring-white/30 scale-110"
                              : "bg-gradient-to-br from-indigo-400 to-purple-400 group-hover:scale-110 group-hover:shadow-xl"
                            }`}>
                            {g.name?.[0]?.toUpperCase() || "G"}
                          </div>
                          {!isSeen && !isSelected && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`font-semibold text-sm truncate transition-all ${isSelected ? "text-white" : !isSeen ? "font-bold" : ""
                              }`}>{g.name}</p>
                            {!isSeen && !isSelected && (
                              <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            )}
                          </div>
                          <p
                            className={`text-xs truncate transition-all ${isSelected
                                ? "text-white/90"
                                : isSeen
                                  ? isDark
                                    ? "text-gray-500 font-normal"
                                    : "text-gray-400 font-normal"
                                  : isDark
                                    ? "text-blue-300 font-bold"
                                    : "text-blue-600 font-bold"
                              }`}
                          >
                            {messagePreview || "Chưa có tin nhắn"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p
              className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"
                } text-center py-4`}
            >
              Chưa có nhóm nào
            </p>
          )}
        </div>
        <div className="p-4">
          <h3
            className={`font-semibold mb-3 text-sm flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"
              }`}
          >
            <Users className="w-4 h-4" />
            Bạn bè ({filteredFriends.length})
          </h3>
          {filteredFriends.length > 0 ? (
            <div className="space-y-1">
              {filteredFriends.map((f) => {
                const friend =
                  f.sender._id === user._id ? f.receiver : f.sender;
                const isSelected = selectedChat === friend._id;
                const displayName = friend.displayName || friend.username;
                const latestMsg = latestMessages[friend._id];
                const messagePreview = getMessagePreview(latestMsg);
                const isSeen = isMessageSeen(latestMsg);

                return (
                  <div
                    key={f._id}
                    className={`p-3.5 rounded-2xl transition-all duration-300 group relative ${isSelected
                        ? "bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white shadow-xl shadow-blue-500/40 scale-[1.02]"
                        : !isSeen
                          ? isDark
                            ? "bg-blue-900/30 border border-blue-700/50 hover:bg-blue-900/40"
                            : "bg-blue-50 border border-blue-200 hover:bg-blue-100"
                          : isDark
                            ? "hover:bg-gray-800/70 hover:shadow-lg hover:shadow-gray-900/20 hover:scale-[1.01]"
                            : "hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:shadow-md hover:shadow-gray-200/50 hover:scale-[1.01]"
                      }`}
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        onSelectChat(friend._id);
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('chatSelected'));
                        }, 100);
                      }}
                    >
                      <div className="relative">
                        {getAvatarUrl(friend.avatarUrl) ? (
                          <img
                            src={getAvatarUrl(friend.avatarUrl)!}
                            alt={displayName}
                            className={`w-12 h-12 rounded-full object-cover transition-all duration-300 ${isSelected
                                ? "ring-2 ring-white/30 scale-110"
                                : "group-hover:scale-110 group-hover:shadow-lg"
                              }`}
                          />
                        ) : (
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shadow-lg transition-all duration-300 ${isSelected
                                ? "bg-white/20 ring-2 ring-white/30 scale-110"
                                : "bg-gradient-to-br from-indigo-400 to-purple-400 group-hover:scale-110 group-hover:shadow-xl"
                              }`}
                          >
                            {displayName[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        {friend.status === "online" && (
                          <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 rounded-full transition-all duration-300 ${isSelected
                              ? "border-white shadow-lg shadow-green-500/50"
                              : "border-white group-hover:scale-125"
                            }`}></span>
                        )}
                        {!isSeen && !isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-semibold text-sm truncate transition-all ${isSelected ? "text-white" : !isSeen ? "font-bold" : ""
                            }`}>
                            {displayName}
                          </p>
                          {!isSeen && !isSelected && (
                            <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <p
                          className={`text-xs truncate transition-all ${isSelected
                              ? "text-white/90"
                              : isSeen
                                ? isDark
                                  ? "text-gray-500 font-normal"
                                  : "text-gray-400 font-normal"
                                : isDark
                                  ? "text-blue-300 font-bold"
                                  : "text-blue-600 font-bold"
                            }`}
                        >
                          {messagePreview || "Chưa có tin nhắn"}
                        </p>
                      </div>
                    </div>
                    {/* Menu 3 chấm */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFriendMenu(openFriendMenu === friend._id ? null : friend._id);
                        }}
                        className={`p-1.5 rounded-lg transition-all duration-300 ${isSelected
                            ? "text-white/80 hover:bg-white/20 hover:text-white"
                            : isDark
                              ? "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                              : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                          }`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {/* Dropdown menu */}
                      {openFriendMenu === friend._id && (
                        <div
                          ref={(el) => {
                            friendMenuRefs.current[friend._id] = el;
                          }}
                          className={`absolute right-0 top-full mt-1 w-48 rounded-xl shadow-2xl border backdrop-blur-md z-50 ${isDark
                              ? "bg-gray-800/95 border-gray-700/50"
                              : "bg-white/95 border-gray-200/50"
                            }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleUnfriend(friend._id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${isDark
                                ? "hover:bg-red-900/50 text-red-400"
                                : "hover:bg-red-50 text-red-600"
                              }`}
                          >
                            <X className="w-4 h-4" />
                            <span className="text-sm font-medium">Hủy kết bạn</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p
              className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"
                } text-center py-8`}
            >
              {searchQuery ? "Không tìm thấy bạn bè" : "Chưa có bạn bè nào"}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className={`p-4 border-t backdrop-blur-sm ${isDark
            ? "border-gray-700/50 bg-gray-900/80"
            : "border-gray-200/50 bg-white/80"
          }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              {getAvatarUrl(userData?.avatarUrl) ? (
                <img
                  src={getAvatarUrl(userData?.avatarUrl)!}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full object-cover shadow-lg ring-2 ring-white/20 transition-all duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white/20 transition-all duration-300 group-hover:scale-110">
                  {(userData?.displayName || userData?.username)?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    const formData = new FormData();
                    formData.append("avatar", file);

                    const res = await api.put("/users/me/avatar", formData, {
                      headers: {
                        "Content-Type": "multipart/form-data",
                      },
                    });

                    // Cập nhật user data local
                    const updatedUser = { ...userData, avatarUrl: res.data.avatarUrl };
                    setUserData(updatedUser);

                    // Cập nhật user trong auth store
                    const { fetchMe } = useAuthStore.getState();
                    await fetchMe();

                    // Refresh danh sách bạn bè để bạn bè thấy avatar mới
                    fetchFriends();

                    // Dispatch event để các component khác cập nhật
                    window.dispatchEvent(new CustomEvent('userAvatarUpdated', {
                      detail: { avatarUrl: res.data.avatarUrl }
                    }));

                    toast.success("Đã cập nhật ảnh đại diện thành công!", {
                      description: "Ảnh đại diện của bạn đã được thay đổi",
                    });
                  } catch (error: any) {
                    console.error("Lỗi upload avatar:", error);
                    toast.error("Lỗi cập nhật ảnh đại diện", {
                      description: error.response?.data?.message || error.message,
                    });
                  }
                }}
              />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {userData?.displayName || userData?.username || "User"}
              </p>
              <p
                className={`text-xs flex items-center gap-1.5 ${isDark ? "text-gray-400" : "text-gray-500"
                  }`}
              >
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Đang hoạt động
              </p>
            </div>
          </div>
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                  ? "hover:bg-gray-700/80 text-gray-300 hover:text-white hover:shadow-md"
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-900 hover:shadow-md"
                }`}
              title="Cài đặt"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Settings Menu Dropdown */}
            {showSettingsMenu && (
              <div
                className={`absolute bottom-full right-0 mb-2 w-56 rounded-xl shadow-2xl border backdrop-blur-md ${isDark
                    ? "bg-gray-800/95 border-gray-700/50"
                    : "bg-white/95 border-gray-200/50"
                  } z-50 animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className="p-2">
                  {/* Hiển thị tên tài khoản */}
                  <div
                    className={`px-3 py-2 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"
                      } mb-2`}
                  >
                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"} mb-1`}>
                      Tên tài khoản
                    </p>
                    <p className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      @{userData?.username || "user"}
                    </p>
                  </div>

                  {/* Thay đổi ảnh đại diện */}
                  <button
                    onClick={() => {
                      avatarInputRef.current?.click();
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isDark
                        ? "hover:bg-gray-700 text-white"
                        : "hover:bg-gray-100 text-gray-900"
                      }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span className="flex-1 text-left">Thay đổi ảnh đại diện</span>
                  </button>

                  {/* Đăng xuất */}
                  <button
                    onClick={async () => {
                      try {
                        await signOut();
                        navigate("/signin");
                      } catch (error) {
                        console.error("Lỗi đăng xuất:", error);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mt-1 ${isDark
                        ? "hover:bg-red-900/50 text-red-400"
                        : "hover:bg-red-50 text-red-600"
                      }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="flex-1 text-left">Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
