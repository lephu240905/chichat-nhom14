"use client";

import { Phone, PhoneOff, Video } from "lucide-react";

interface Props {
    open: boolean;
    callerName?: string;
    callerDisplayName?: string;
    callerAvatar?: string;
    isVideo?: boolean;
    outgoing?: boolean;
    inCall?: boolean;
    callDuration?: string; // Thời gian cuộc gọi (MM:SS hoặc HH:MM:SS)
    onAccept?: () => void;
    onReject?: () => void;
    onCancel?: () => void;
}

export default function CallModal({
    open,
    callerName,
    callerDisplayName,
    callerAvatar,
    isVideo = false,
    outgoing = false,
    inCall = false,
    callDuration,
    onAccept,
    onReject,
    onCancel,
}: Props) {
    // Helper function để build avatar URL
    const getAvatarUrl = (avatarUrl: string | undefined) => {
        if (!avatarUrl) return null;
        if (avatarUrl.startsWith("http")) return avatarUrl;
        const baseURL = import.meta.env.MODE === "development"
            ? "http://localhost:5001"
            : "";
        return `${baseURL}${avatarUrl}`;
    };

    const displayName = callerDisplayName || callerName || "Ai đó";
    const avatarUrl = getAvatarUrl(callerAvatar);
    const initial = displayName[0]?.toUpperCase() || "?";
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl w-full max-w-md mx-4 shadow-2xl transform transition-all" style={{ animation: 'zoomIn 0.3s ease-out' }}>
                {/* Avatar với animation pulse khi đang gọi */}
                <div className="mb-6 flex flex-col items-center">
                    <div
                        className={`relative mb-4 ${outgoing && !inCall ? "animate-pulse" : ""
                            }`}
                    >
                        {/* Ring animation khi đang gọi đến */}
                        {!inCall && !outgoing && (
                            <div className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-ping" />
                        )}
                        {/* Avatar circle */}
                        <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-xl ring-4 ring-white dark:ring-gray-800 overflow-hidden">
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={displayName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span>{initial}</span>
                            )}
                        </div>
                        {/* Icon overlay */}
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-gray-800">
                            {isVideo ? (
                                <Video className="w-5 h-5 text-blue-600" />
                            ) : (
                                <Phone className="w-5 h-5 text-blue-600" />
                            )}
                        </div>
                    </div>

                    {/* Status text */}
                    <h3 className="text-2xl font-bold dark:text-white mb-2">
                        {inCall
                            ? "Đang trong cuộc gọi"
                            : outgoing
                                ? "Đang gọi..."
                                : "Cuộc gọi đến"}
                    </h3>

                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-1">
                        {displayName}
                    </p>

                    {/* Hiển thị thời gian cuộc gọi */}
                    {inCall && callDuration && (
                        <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 mb-2">
                            {callDuration}
                        </p>
                    )}

                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                        {isVideo ? (
                            <>
                                <Video className="w-4 h-4" />
                                Cuộc gọi video
                            </>
                        ) : (
                            <>
                                <Phone className="w-4 h-4" />
                                Cuộc gọi âm thanh
                            </>
                        )}
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex justify-center gap-4">
                    {inCall ? (
                        <button
                            onClick={() => onReject && onReject()}
                            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-semibold text-lg"
                        >
                            <PhoneOff className="w-5 h-5" />
                            <span>Ngắt cuộc gọi</span>
                        </button>
                    ) : !outgoing ? (
                        <>
                            <button
                                onClick={() => onReject && onReject()}
                                className="flex items-center justify-center gap-2 w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200"
                                title="Từ chối"
                            >
                                <PhoneOff className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => onAccept && onAccept()}
                                className="flex items-center justify-center gap-2 w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 animate-pulse"
                                title="Chấp nhận"
                            >
                                <Phone className="w-6 h-6" />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => onCancel && onCancel()}
                            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-semibold"
                        >
                            <PhoneOff className="w-5 h-5" />
                            <span>Huỷ cuộc gọi</span>
                        </button>
                    )}
                </div>

                {/* Status indicator */}
                {outgoing && !inCall && (
                    <div className="mt-6 text-center">
                        <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            <span>Đang kết nối...</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
