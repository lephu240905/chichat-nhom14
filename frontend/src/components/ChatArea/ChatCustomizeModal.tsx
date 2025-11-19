"use client";

import { useState, memo } from "react";
import { X, ChevronRight, Users, LogOut } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";

interface ChatCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  selectedChat: string | null;
  userId: string | null;
  isGroup?: boolean;
  groupInfo?: any;
  onSelectChat?: ((chatId: string | null) => void) | ((chatId: string) => void);
}

function ChatCustomizeModal({
  isOpen,
  onClose,
  isDark,
  selectedChat,
  userId,
  isGroup = false,
  groupInfo,
  onSelectChat,
}: ChatCustomizeModalProps) {
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showQuickReactionPicker, setShowQuickReactionPicker] = useState(false);
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);
  const [showMembersList, setShowMembersList] = useState(false);
  const [nickname, setNickname] = useState("");

  const themes = [
    { name: "Mặc định", color: "from-blue-500 to-blue-600" },
    { name: "Tím", color: "from-purple-500 to-purple-600" },
    { name: "Hồng", color: "from-pink-500 to-pink-600" },
    { name: "Xanh lá", color: "from-green-500 to-green-600" },
    { name: "Cam", color: "from-orange-500 to-orange-600" },
  ];

  const quickReactionEmojis = [
    "👍",
    "👏",
    "❤️",
    "🔥",
    "🎉",
    "😂",
    "😍",
    "🥰",
    "😊",
    "😀",
    "❤️‍🔥",
    "💯",
    "👌",
    "🙌",
    "🤝",
  ];

  // Early return if modal is not open
  if (!isOpen) {
    return null;
  }

  const handleThemeChange = async (theme: (typeof themes)[0]) => {
    if (!selectedChat || !userId) return;

    try {
      // Lưu vào database với isGroup flag
      await api.put(`/chat-customizations/${selectedChat}`, {
        theme: theme.color,
        isGroup: isGroup,
      });

      // Cũng lưu vào localStorage như cache
      const key = `chat_theme_${selectedChat}`;
      localStorage.setItem(key, theme.color);

      setShowThemePicker(false);
      // Emit event để ChatArea có thể cập nhật theme
      window.dispatchEvent(
        new CustomEvent("chatThemeChanged", {
          detail: { chatId: selectedChat, theme: theme.color },
        })
      );
      // Emit storage change event để update UI
      window.dispatchEvent(
        new CustomEvent("chatCustomizationChanged", {
          detail: {
            chatId: selectedChat,
            type: "theme",
            value: theme.color,
          },
        })
      );
      toast.success(`Đã đổi chủ đề thành: ${theme.name}`, {
        description: "Chủ đề đã được cập nhật thành công",
      });
    } catch (error: any) {
      console.error("Lỗi cập nhật theme:", error);
      toast.error("Lỗi cập nhật chủ đề", {
        description: error.response?.data?.message || error.message,
      });
    }
  };

  const handleQuickReactionChange = async (emoji: string) => {
    if (!selectedChat || !userId) return;

    try {
      // Lưu vào database
      await api.put(`/chat-customizations/${selectedChat}`, {
        quickReaction: emoji,
        isGroup: isGroup,
      });

      // Cũng lưu vào localStorage như cache
      const key = `chat_quick_reaction_${selectedChat}`;
      localStorage.setItem(key, emoji);

      setShowQuickReactionPicker(false);
      // Emit event để ChatArea có thể cập nhật quick reaction
      window.dispatchEvent(
        new CustomEvent("chatCustomizationChanged", {
          detail: {
            chatId: selectedChat,
            type: "quickReaction",
            value: emoji,
          },
        })
      );
      toast.success(`Đã đổi cảm xúc nhanh thành: ${emoji}`, {
        description: "Cảm xúc nhanh đã được cập nhật",
      });
    } catch (error: any) {
      console.error("Lỗi cập nhật quick reaction:", error);
      toast.error("Lỗi cập nhật cảm xúc nhanh", {
        description: error.response?.data?.message || error.message,
      });
    }
  };

  const handleNicknameSave = async () => {
    if (!selectedChat || !userId || !isGroup) return;

    try {
      // Đổi tên nhóm
      if (nickname.trim()) {
        const response = await api.put(
          `/chat-customizations/${selectedChat}`,
          {
            nickname: nickname.trim(),
            isGroup: true,
          }
        );

        // Refresh group info từ response hoặc fetch lại
        if (response.data?.group) {
          window.dispatchEvent(
            new CustomEvent("groupUpdated", { detail: response.data.group })
          );
        } else {
          // Nếu không có trong response, fetch lại
          try {
            const groupRes = await api.get(`/groups/${selectedChat}`);
            window.dispatchEvent(
              new CustomEvent("groupUpdated", { detail: groupRes.data })
            );
          } catch (fetchErr) {
            console.error("Lỗi fetch group info:", fetchErr);
          }
        }

        // Refresh groups list trong sidebar
        window.dispatchEvent(new CustomEvent("refreshGroups"));
        toast.success(`Đã đổi tên nhóm thành: ${nickname.trim()}`, {
          description: "Tên nhóm đã được cập nhật thành công",
        });
      }

      setShowNicknameEditor(false);
      setNickname("");
    } catch (error: any) {
      console.error("Lỗi cập nhật tên nhóm:", error);
      toast.error("Lỗi cập nhật", {
        description: error.response?.data?.message || error.message,
      });
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedChat || !isGroup) return;

    if (!confirm("Bạn có chắc chắn muốn rời nhóm này không?")) {
      return;
    }

    try {
      await api.post(`/groups/${selectedChat}/leave`);
      toast.success("Đã rời nhóm thành công", {
        description: "Bạn đã rời khỏi nhóm này",
      });
      window.dispatchEvent(new CustomEvent("refreshGroups"));
      if (onSelectChat) {
        // Handle both function signatures
        try {
          (onSelectChat as any)(null);
        } catch {
          // If onSelectChat doesn't accept null, just close
        }
      }
      onClose();
    } catch (error: any) {
      console.error("Lỗi rời nhóm:", error);
      toast.error("Lỗi rời nhóm", {
        description: error.response?.data?.message || error.message,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      onClick={onClose}
      style={{
        zIndex: 99999,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-lg shadow-2xl ${
          isDark ? "bg-gray-800" : "bg-white"
        }`}
        style={{
          zIndex: 100000,
          position: "relative",
          maxWidth: "28rem",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b ${
            isDark
              ? "border-gray-700 bg-gray-900"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <h3
            className={`font-semibold ${isDark ? "text-white" : "text-gray-900"
              }`}
          >
            Tùy chỉnh đoạn chat
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 ${isDark ? "text-white" : "text-gray-900"
              }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          {/* Đổi chủ đề */}
          <div className="mb-1">
            <button
              onClick={() => {
                setShowThemePicker(!showThemePicker);
                setShowQuickReactionPicker(false);
                if (isGroup) {
                  setShowNicknameEditor(false);
                }
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${isDark
                  ? "hover:bg-gray-700 text-white"
                  : "hover:bg-gray-100 text-gray-900"
                }`}
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white">
                  <div className="w-2 h-2 rounded-full bg-white m-auto mt-1"></div>
                </div>
              </div>
              <span className="flex-1 text-left">Chủ đề</span>
            </button>
            {showThemePicker && (
              <div
                className={`mt-2 p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"
                  }`}
              >
                <div className="grid grid-cols-3 gap-2">
                  {themes.map((theme, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleThemeChange(theme)}
                      className={`p-3 rounded-lg bg-gradient-to-r ${theme.color} text-white hover:opacity-80 transition-opacity`}
                      title={theme.name}
                    >
                      {theme.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cảm xúc nhanh (cho nút like) */}
          <div className="mb-1">
            <button
              onClick={() => {
                setShowQuickReactionPicker(!showQuickReactionPicker);
                setShowThemePicker(false);
                if (isGroup) {
                  setShowNicknameEditor(false);
                }
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${isDark
                  ? "hover:bg-gray-700 text-white"
                  : "hover:bg-gray-100 text-gray-900"
                }`}
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <span className="text-xl">👍</span>
              </div>
              <span className="flex-1 text-left">Cảm xúc nhanh</span>
            </button>
            {showQuickReactionPicker && (
              <div
                className={`mt-2 p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"
                  }`}
              >
                <div className="grid grid-cols-5 gap-2">
                  {quickReactionEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickReactionChange(emoji)}
                      className="text-2xl p-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Đặt tên nhóm (chỉ hiển thị cho nhóm) */}
          {isGroup && (
            <div className="mb-1">
              <button
                onClick={async () => {
                  setShowNicknameEditor(!showNicknameEditor);
                  setShowThemePicker(false);
                  setShowQuickReactionPicker(false);
                  setShowMembersList(false);
                  // Load existing group name
                  if (groupInfo) {
                    setNickname(groupInfo.name || "");
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${isDark
                    ? "hover:bg-gray-700 text-white"
                    : "hover:bg-gray-100 text-gray-900"
                  }`}
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  <span
                    className={`text-lg font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Aa
                  </span>
                </div>
                <span className="flex-1 text-left">Đặt tên nhóm</span>
                <ChevronRight
                  className={`w-5 h-5 ${
                    isDark ? "text-gray-400" : "text-gray-400"
                  }`}
                />
              </button>
              {showNicknameEditor && (
                <div
                  className={`mt-2 p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"
                    }`}
                >
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Nhập tên nhóm..."
                    className={`w-full px-3 py-2 rounded-lg border ${isDark
                        ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <button
                    onClick={handleNicknameSave}
                    className={`mt-2 w-full px-4 py-2 rounded-lg ${isDark
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-blue-500 hover:bg-blue-600 text-white"
                      } transition-colors`}
                  >
                    Lưu
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chỉ hiển thị cho nhóm */}
          {isGroup && (
            <>
              {/* Xem danh sách thành viên */}
              <div className="mb-1">
                <button
                  onClick={() => {
                    setShowMembersList(!showMembersList);
                    setShowThemePicker(false);
                    setShowQuickReactionPicker(false);
                    setShowNicknameEditor(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${isDark
                      ? "hover:bg-gray-700 text-white"
                      : "hover:bg-gray-100 text-gray-900"
                    }`}
                >
                  <div className="w-8 h-8 flex items-center justify-center">
                    <Users
                      className={`w-5 h-5 ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    />
                  </div>
                  <span className="flex-1 text-left">
                    Xem danh sách thành viên
                  </span>
                  <ChevronRight
                    className={`w-5 h-5 ${
                      isDark ? "text-gray-400" : "text-gray-400"
                    }`}
                  />
                </button>
                {showMembersList && groupInfo && (
                  <div
                    className={`mt-2 p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-50"
                      }`}
                  >
                    <div className="space-y-2">
                      {groupInfo.members &&
                        groupInfo.members.map((member: any) => {
                          const memberData = member._id
                            ? member
                            : { _id: member, displayName: "", username: "" };
                          const displayName =
                            memberData.displayName ||
                            memberData.username ||
                            "Unknown";
                          const isAdmin =
                            groupInfo.admin &&
                            String(groupInfo.admin) === String(memberData._id);
                          return (
                            <div
                              key={memberData._id}
                              className={`flex items-center justify-between p-2 rounded-lg ${
                                isDark ? "bg-gray-800" : "bg-white"
                              }`}
                            >
                              <span
                                className={
                                  isDark ? "text-white" : "text-gray-900"
                                }
                              >
                                {displayName}
                                {isAdmin && (
                                  <span className="ml-2 text-xs text-blue-500">
                                    (Admin)
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Rời nhóm */}
              <div className="mb-1">
                <button
                  onClick={handleLeaveGroup}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${isDark
                      ? "hover:bg-red-900/50 text-red-400"
                      : "hover:bg-red-50 text-red-600"
                    }`}
                >
                  <div className="w-8 h-8 flex items-center justify-center">
                    <LogOut className={`w-5 h-5`} />
                  </div>
                  <span className="flex-1 text-left">Rời nhóm</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export default memo(ChatCustomizeModal, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.selectedChat === nextProps.selectedChat &&
    prevProps.userId === nextProps.userId &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.isGroup === nextProps.isGroup &&
    JSON.stringify(prevProps.groupInfo) === JSON.stringify(nextProps.groupInfo)
  );
});
