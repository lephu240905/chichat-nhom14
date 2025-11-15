"use client";

import { useEffect, useState } from "react";
import { friendService } from "@/services/friendService";
import { groupService } from "@/services/groupService";
import { useAuthStore } from "@/stores/useAuthStore";
import { socket } from "@/services/socket";
import { X } from "lucide-react";
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

interface Props {
    isOpen: boolean;
    onClose: () => void;
    preselect?: string | null; // user id to preselect
    onGroupCreated?: (groupId?: string) => void; // Callback khi tạo nhóm thành công, truyền groupId
}

interface Friend {
    _id: string;
    username: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
}

export default function CreateGroupModal({
    isOpen,
    onClose,
    preselect,
    onGroupCreated,
}: Props) {
    const user = useAuthStore((s) => s.user);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const fetch = async () => {
            try {
                const res = await friendService.getFriends();
                // Transform friend data: lấy bạn bè thực sự (không phải user hiện tại)
                const friendList: Friend[] = [];

                if (res && Array.isArray(res)) {
                    res.forEach((friend: any) => {
                        // Nếu sender là user hiện tại, thì bạn bè là receiver
                        if (friend.sender?._id === user?._id) {
                            if (friend.receiver) {
                                const receiver = friend.receiver;
                                friendList.push({
                                    _id: receiver._id,
                                    username: receiver.username,
                                    // Ưu tiên displayName, nếu không có hoặc rỗng thì dùng username
                                    displayName: receiver.displayName && receiver.displayName.trim()
                                        ? receiver.displayName.trim()
                                        : receiver.username,
                                    email: receiver.email,
                                    avatarUrl: receiver.avatarUrl,
                                });
                            }
                        }
                        // Nếu receiver là user hiện tại, thì bạn bè là sender
                        else if (friend.receiver?._id === user?._id) {
                            if (friend.sender) {
                                const sender = friend.sender;
                                friendList.push({
                                    _id: sender._id,
                                    username: sender.username,
                                    // Ưu tiên displayName, nếu không có hoặc rỗng thì dùng username
                                    displayName: sender.displayName && sender.displayName.trim()
                                        ? sender.displayName.trim()
                                        : sender.username,
                                    email: sender.email,
                                    avatarUrl: sender.avatarUrl,
                                });
                            }
                        }
                    });
                }

                setFriends(friendList);
                if (preselect) setSelected([preselect]);
            } catch (err) {
                console.error("Lỗi tải danh sách bạn bè:", err);
                toast.error("Không thể tải danh sách bạn bè", {
                    description: "Vui lòng thử lại sau",
                });
            }
        };
        fetch();
    }, [isOpen, preselect, user?._id]);

    useEffect(() => {
        if (!isOpen) {
            setName("");
            setSelected([]);
        }
    }, [isOpen]);

    // Lắng nghe avatar updates từ socket
    useEffect(() => {
        if (!isOpen) return;

        const handleAvatarUpdate = (data: { userId: string; avatarUrl: string }) => {
            // Cập nhật avatar trong danh sách bạn bè
            setFriends((prevFriends) => {
                return prevFriends.map((f) => {
                    if (f._id === data.userId) {
                        return { ...f, avatarUrl: data.avatarUrl };
                    }
                    return f;
                });
            });
        };

        socket.on("user_avatar_updated", handleAvatarUpdate);
        return () => {
            socket.off("user_avatar_updated", handleAvatarUpdate);
        };
    }, [isOpen]);

    const toggle = (id: string) => {
        setSelected((s) =>
            s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
        );
    };

    const handleCreate = async () => {
        console.log("🔵 handleCreate called:", { name, selected, loading });

        if (!name.trim()) {
            toast.warning("Vui lòng nhập tên nhóm", {
                description: "Tên nhóm không được để trống",
            });
            return;
        }

        if (selected.length === 0) {
            toast.warning("Vui lòng chọn ít nhất một thành viên", {
                description: "Nhóm cần có ít nhất 2 thành viên",
            });
            return;
        }

        console.log("🔵 Starting to create group...");
        console.log("🔵 Payload sẽ gửi:", { name: name.trim(), members: selected });
        setLoading(true);
        try {
            const payload = { name: name.trim(), members: selected };
            console.log("🔵 Calling groupService.createGroup with:", payload);
            const created = await groupService.createGroup(payload);
            console.log("✅ Group created successfully:", created);

            toast.success(`Tạo nhóm thành công: ${created.name}`, {
                description: "Bạn có thể bắt đầu chat ngay bây giờ",
            });

            // Callback để refresh danh sách nhóm và chọn nhóm vừa tạo
            if (onGroupCreated) {
                console.log("🔵 Calling onGroupCreated with groupId:", created._id || created.id);
                onGroupCreated(created._id || created.id);
            }

            // Emit window event để các component khác có thể lắng nghe
            window.dispatchEvent(new CustomEvent('groupCreated', { detail: created }));

            // Reset form
            setName("");
            setSelected([]);

            onClose();
        } catch (err: any) {
            console.error("❌ Lỗi tạo nhóm:", err);
            console.error("❌ Error response:", err.response);
            console.error("❌ Error message:", err.message);
            const errorMsg = err.response?.data?.message || err.message || "Không thể tạo nhóm";
            toast.error("Lỗi tạo nhóm", {
                description: errorMsg,
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Tạo nhóm mới
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tên nhóm */}
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên nhóm"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                />

                {/* Danh sách bạn bè */}
                <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Chọn thành viên ({selected.length} đã chọn)
                    </p>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                        {friends.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                Không có bạn bè để chọn
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {friends.map((friend) => (
                                    <label
                                        key={friend._id}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selected.includes(friend._id)
                                                ? "bg-blue-50 dark:bg-blue-900/20"
                                                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(friend._id)}
                                            onChange={() => toggle(friend._id)}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            disabled={loading}
                                        />
                                        <div className="flex items-center gap-2 flex-1">
                                            {/* Avatar */}
                                            {getAvatarUrl(friend.avatarUrl) ? (
                                                <img
                                                    src={getAvatarUrl(friend.avatarUrl)!}
                                                    alt={friend.displayName}
                                                    className="w-10 h-10 rounded-full object-cover shadow-md ring-2 ring-gray-200 dark:ring-gray-700"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-md ring-2 ring-gray-200 dark:ring-gray-700">
                                                    {(friend.displayName || friend.username)?.[0]?.toUpperCase() || "?"}
                                                </div>
                                            )}
                                            {/* Tên */}
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {friend.displayName}
                                                </p>
                                                {friend.username && friend.username !== friend.displayName && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        @{friend.username}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("🔵 Tạo button clicked:", {
                                name: name.trim(),
                                nameLength: name.trim().length,
                                selectedCount: selected.length,
                                selected,
                                loading,
                                willCall: !loading && name.trim() && selected.length > 0
                            });
                            if (!loading && name.trim() && selected.length > 0) {
                                handleCreate();
                            } else {
                                const errors = [];
                                if (!name.trim()) errors.push("Nhập tên nhóm");
                                if (selected.length === 0) errors.push("Chọn ít nhất 1 thành viên");
                                toast.warning("Vui lòng hoàn thành thông tin", {
                                    description: errors.join(", "),
                                });
                            }
                        }}
                        className={`px-4 py-2 rounded-lg text-white transition-colors ${loading || !name.trim() || selected.length === 0
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 cursor-pointer"
                            }`}
                    >
                        {loading ? "Đang tạo..." : "Tạo"}
                    </button>
                </div>
            </div>
        </div>
    );
}
