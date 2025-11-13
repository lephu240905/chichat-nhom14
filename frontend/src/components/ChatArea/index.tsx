"use client";

import { useState, useEffect, useRef } from "react";
import { socket } from "@/services/socket";
import api from "@/lib/axios";
import {
    MessageCircle,
    Send,
    Phone,
    PhoneOff,
    Video,
    MoreHorizontal,
    Image,
    ThumbsUp,
} from "lucide-react";
import CreateGroupModal from "./CreateGroupModal";
import CallModal from "./CallModal";
import ChatCustomizeModal from "./ChatCustomizeModal";

// Helper function để build avatar URL
const getAvatarUrl = (avatarUrl: string | undefined) => {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith("http")) return avatarUrl;
    const baseURL = import.meta.env.MODE === "development"
        ? "http://localhost:5001"
        : "";
    return `${baseURL}${avatarUrl}`;
};

interface ChatAreaProps {
    selectedChat: string | null;
    isDark: boolean;
    user: any;
    onSelectChat?: (chatId: string) => void;
}

export default function ChatArea({
    selectedChat,
    isDark,
    user,
    onSelectChat,
}: ChatAreaProps) {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<any[]>([]);
    const [friendInfo, setFriendInfo] = useState<any>(null);
    const [groupInfo, setGroupInfo] = useState<any>(null);
    const [isGroup, setIsGroup] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [chatNickname, setChatNickname] = useState<string | null>(null);
    const [chatTheme, setChatTheme] = useState<string | null>(null);
    const [chatQuickReaction, setChatQuickReaction] = useState<string>("👍"); // Emoji mặc định là 👍
    // const [incomingCall, setIncomingCall] = useState<any | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const [incomingPayload, setIncomingPayload] = useState<any | null>(null);
    const [outgoing, setOutgoing] = useState(false);
    const [currentCallIsVideo, setCurrentCallIsVideo] = useState(false);
    const [currentCallPartnerId, setCurrentCallPartnerId] = useState<string | null>(null); // Lưu ID người đang gọi
    const [currentCallPartnerInfo, setCurrentCallPartnerInfo] = useState<{ name?: string; displayName?: string; avatar?: string } | null>(null); // Lưu thông tin người đang gọi
    const [callStartTime, setCallStartTime] = useState<number | null>(null); // Thời gian bắt đầu cuộc gọi
    const [callDuration, setCallDuration] = useState<number>(0); // Thời gian đã gọi (giây)
    const imageInputRef = useRef<HTMLInputElement | null>(null);

    // 📨 Lấy tin nhắn cũ + thông tin người bạn đang chat
    useEffect(() => {
        setIsGroup(false);
        setGroupInfo(null);
        if (!selectedChat || !user) return;

        const fetchData = async () => {

            // Fetch messages and user/group info
            try {
                // First try to fetch as a user chat
                try {
                    const [msgRes, userRes] = await Promise.all([
                        api.get(`/messages/${selectedChat}`),
                        api.get(`/users/${selectedChat}`),
                    ]);
                    setMessages(msgRes.data || []);
                    setFriendInfo(userRes.data || null);
                    setIsGroup(false);
                    setGroupInfo(null);

                    // Đánh dấu tin nhắn đã xem
                    try {
                        await api.post("/messages/seen", { receiverId: selectedChat });
                    } catch (err) {
                        console.error("Lỗi đánh dấu tin nhắn đã xem:", err);
                    }

                    // Load customization for private chat
                    try {
                        const customizationRes = await api.get(`/chat-customizations/${selectedChat}`);
                        const customization = customizationRes.data;

                        // Load quick reaction
                        setChatQuickReaction(customization.quickReaction || "👍");
                        const quickReactionKey = `chat_quick_reaction_${selectedChat}`;
                        if (customization.quickReaction) {
                            localStorage.setItem(quickReactionKey, customization.quickReaction);
                        } else {
                            localStorage.setItem(quickReactionKey, "👍");
                        }

                        // Load theme
                        if (customization.theme) {
                            setChatTheme(customization.theme);
                            const themeKey = `chat_theme_${selectedChat}`;
                            localStorage.setItem(themeKey, customization.theme);
                        } else {
                            // Fallback về localStorage nếu database không có
                            const themeKey = `chat_theme_${selectedChat}`;
                            const savedTheme = localStorage.getItem(themeKey);
                            if (savedTheme) {
                                setChatTheme(savedTheme);
                            } else {
                                setChatTheme(null);
                            }
                        }

                        // Load nickname
                        if (customization.nickname) {
                            setChatNickname(customization.nickname);
                            const nicknameKey = `chat_nickname_${selectedChat}`;
                            localStorage.setItem(nicknameKey, customization.nickname);
                        } else {
                            const nicknameKey = `chat_nickname_${selectedChat}`;
                            const savedNickname = localStorage.getItem(nicknameKey);
                            setChatNickname(savedNickname || null);
                        }
                    } catch (err) {
                        console.error("Lỗi load customization:", err);
                        // Fallback về localStorage nếu API lỗi
                        const themeKey = `chat_theme_${selectedChat}`;
                        const savedTheme = localStorage.getItem(themeKey);
                        if (savedTheme) {
                            setChatTheme(savedTheme);
                        }
                    }
                    return;
                } catch {
                    // if fetching user failed, try as group
                }

                // Try group
                const [groupRes, groupMsgRes] = await Promise.all([
                    api.get(`/groups/${selectedChat}`),
                    api.get(`/messages/group/${selectedChat}`),
                ]);
                setGroupInfo(groupRes.data || null);
                setMessages(groupMsgRes.data || []);
                setFriendInfo(null);
                setIsGroup(true);

                // Đánh dấu tin nhắn đã xem
                try {
                    await api.post("/messages/seen", { groupId: selectedChat });
                } catch (err) {
                    console.error("Lỗi đánh dấu tin nhắn đã xem:", err);
                }

                // Load customization for group chat
                try {
                    const customizationRes = await api.get(`/chat-customizations/${selectedChat}?isGroup=true`);
                    const customization = customizationRes.data;

                    // Load quick reaction
                    setChatQuickReaction(customization.quickReaction || "👍");
                    const quickReactionKey = `chat_quick_reaction_${selectedChat}`;
                    if (customization.quickReaction) {
                        localStorage.setItem(quickReactionKey, customization.quickReaction);
                    } else {
                        localStorage.setItem(quickReactionKey, "👍");
                    }

                    // Load theme
                    if (customization.theme) {
                        setChatTheme(customization.theme);
                        const themeKey = `chat_theme_${selectedChat}`;
                        localStorage.setItem(themeKey, customization.theme);
                    } else {
                        // Fallback về localStorage nếu database không có
                        const themeKey = `chat_theme_${selectedChat}`;
                        const savedTheme = localStorage.getItem(themeKey);
                        if (savedTheme) {
                            setChatTheme(savedTheme);
                        } else {
                            setChatTheme(null);
                        }
                    }
                } catch (err) {
                    console.error("Lỗi load customization group:", err);
                    // Fallback về localStorage nếu API lỗi
                    const themeKey = `chat_theme_${selectedChat}`;
                    const savedTheme = localStorage.getItem(themeKey);
                    if (savedTheme) {
                        setChatTheme(savedTheme);
                    }
                }
            } catch (err) {
                console.error("Lỗi tải tin nhắn:", err);
            }
        };

        fetchData();
    }, [selectedChat, user]);

    // 🔌 Socket realtime — join room + nhận tin nhắn
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!user?._id) return;

        socket.emit("join", user._id);

        const handleReceiveMessage = (msg: any) => {
            try {
                // group message
                const gId = msg.groupId?._id || msg.groupId;
                if (gId && gId === selectedChat) {
                    setMessages((prev) => {
                        if (msg._id && prev.some((m) => m._id === msg._id)) return prev;
                        return [...prev, msg];
                    });
                    return;
                }

                // private message
                const sender = msg.senderId?._id || msg.senderId;
                const receiver = msg.receiverId?._id || msg.receiverId;

                if (sender === selectedChat || receiver === selectedChat) {
                    setMessages((prev) => {
                        if (msg._id && prev.some((m) => m._id === msg._id)) return prev;
                        return [...prev, msg];
                    });
                }
            } catch (e) {
                console.error("Lỗi xử lý receiveMessage:", e);
            }
        };

        socket.off("receiveMessage");
        socket.on("receiveMessage", handleReceiveMessage);

        // Listen for messages seen event
        const handleMessagesSeen = (data: { receiverId?: string; groupId?: string; seenBy: string }) => {
            // data.seenBy là userId của người đã xem tin nhắn
            // Người nhận socket event này là user (người gửi tin nhắn)
            // Nếu đang chat với người vừa xem tin nhắn (selectedChat === data.seenBy)
            if (!isGroup && data.seenBy === selectedChat) {
                // Cập nhật tất cả tin nhắn của user (người gửi) là đã xem bởi selectedChat
                setMessages((prev) =>
                    prev.map((msg) => {
                        const senderId = msg.senderId?._id || msg.senderId;
                        // Nếu là tin nhắn của user gửi
                        if (senderId === user._id) {
                            const alreadySeen = msg.seenBy?.some(
                                (seen: any) => String(seen.userId || seen) === String(data.seenBy)
                            );
                            if (!alreadySeen) {
                                return {
                                    ...msg,
                                    seenBy: [...(msg.seenBy || []), { userId: data.seenBy, seenAt: new Date() }],
                                };
                            }
                        }
                        return msg;
                    })
                );
            }
        };

        socket.on("messagesSeen", handleMessagesSeen);

        // Listen for avatar updates từ bạn bè
        socket.on("user_avatar_updated", (data: { userId: string; avatarUrl: string }) => {
            // Cập nhật avatar trong header nếu đang chat với người đó
            if (selectedChat === data.userId && friendInfo) {
                setFriendInfo({ ...friendInfo, avatarUrl: data.avatarUrl });
            }
        });

        // Listen for status changes từ bạn bè
        socket.on("user_status_changed", (data: { userId: string; status: "online" | "offline" }) => {
            // Cập nhật status trong header nếu đang chat với người đó
            if (selectedChat === data.userId && friendInfo) {
                setFriendInfo({ ...friendInfo, status: data.status });
            }
        });

        const handleGroupCreated = (group: any) => {
            try {
                const memberIds = (group.members || []).map((m: any) =>
                    m._id ? m._id : m
                );
                if (memberIds.includes(user._id)) {
                    alert(`Bạn được thêm vào nhóm: ${group.name}`);
                    // optionally refresh messages if currently viewing group
                    if (selectedChat === group._id) {
                        // refetch messages for the group
                        api
                            .get(`/messages/group/${group._id}`)
                            .then((r) => setMessages(r.data || []));
                        setGroupInfo(group);
                        setIsGroup(true);
                    }
                }
            } catch (err) {
                console.error("Lỗi xử lý groupCreated:", err);
            }
        };

        socket.off("groupCreated");
        socket.on("groupCreated", handleGroupCreated);

        // Listen for group updates (socket event)
        const handleSocketGroupUpdated = (group: any) => {
            const groupId = group._id || group.id;
            if (selectedChat === groupId) {
                // Cập nhật groupInfo ngay lập tức
                setGroupInfo(group);
                // Emit window event để các component khác cũng cập nhật
                window.dispatchEvent(new CustomEvent('groupUpdated', { detail: group }));
            }
            // Refresh groups list trong sidebar
            window.dispatchEvent(new CustomEvent('refreshGroups'));
        };

        socket.off("groupUpdated");
        socket.on("groupUpdated", handleSocketGroupUpdated);

        // Signaling: incoming call / answer / ice / end
        const handleIncomingCall = async (data: any) => {
            // data: { from, offer, isVideo }
            console.log("Incoming call", data);
            try {
                // try to resolve caller info
                const res = await api.get(`/users/${data.from}`);
                const userData = res?.data;
                setIncomingPayload({
                    ...data,
                    callerName: userData?.username || undefined,
                    callerDisplayName: userData?.displayName || userData?.username || undefined,
                    callerAvatar: userData?.avatarUrl || undefined,
                });
            } catch (err) {
                // fallback to raw payload
                setIncomingPayload(data);
            }
        };

        const handleCallAnswered = async (data: any) => {
            try {
                if (peerRef.current && data.answer) {
                    console.log("✅ Call answered, setting remote description");
                    await peerRef.current.setRemoteDescription(data.answer);
                    // call is established
                    setInCall(true);
                    setOutgoing(false);
                    setCallStartTime(Date.now()); // Bắt đầu đếm thời gian
                    console.log("📞 Call established, inCall set to true");
                }
            } catch (e) {
                console.error("❌ Error handling callAnswered", e);
            }
        };

        const handleIce = async (data: any) => {
            try {
                if (peerRef.current && data.candidate) {
                    await peerRef.current.addIceCandidate(
                        new RTCIceCandidate(data.candidate)
                    );
                }
            } catch (e) {
                console.error("Error adding remote ICE", e);
            }
        };

        const handleEndCall = (data: any) => {
            console.log("📞 Call ended by remote", data);
            // Cleanup đầy đủ khi bên kia ngắt cuộc gọi
            cleanupCall();
            setOutgoing(false);
            setIncomingPayload(null);
            setCurrentCallPartnerId(null);
            setCurrentCallPartnerInfo(null);
            setCallStartTime(null);
            setCallDuration(0);
            console.log("✅ Call cleanup completed after remote end");
        };

        socket.off("incomingCall");
        socket.on("incomingCall", handleIncomingCall);

        socket.on("callAnswered", handleCallAnswered);
        socket.on("iceCandidate", handleIce);
        socket.on("endCall", handleEndCall);

        return () => {
            socket.off("receiveMessage", handleReceiveMessage);
            socket.off("messagesSeen", handleMessagesSeen);
            socket.off("groupCreated");
            socket.off("incomingCall");
            socket.off("callAnswered");
            socket.off("iceCandidate");
            socket.off("endCall");
        };
    }, [selectedChat, user?._id /* answerCall */]);

    // Đảm bảo local video stream được gán khi vào cuộc gọi video
    useEffect(() => {
        if (currentCallIsVideo && inCall && localStreamRef.current && localVideoRef.current) {
            // Đảm bảo local video stream được gán
            if (!localVideoRef.current.srcObject) {
                localVideoRef.current.srcObject = localStreamRef.current;
                console.log("📹 Local video stream attached via useEffect");
            }
        }
    }, [currentCallIsVideo, inCall]);

    // Debug: Log state changes
    useEffect(() => {
        console.log("🔄 Call state changed:", {
            inCall,
            currentCallIsVideo,
            outgoing,
            hasIncomingPayload: !!incomingPayload
        });
    }, [inCall, currentCallIsVideo, outgoing, incomingPayload]);

    // Đếm thời gian cuộc gọi
    useEffect(() => {
        if (inCall && callStartTime) {
            const interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
                setCallDuration(elapsed);
            }, 1000); // Cập nhật mỗi giây

            return () => clearInterval(interval);
        } else {
            setCallDuration(0);
        }
    }, [inCall, callStartTime]);

    // Format thời gian: MM:SS hoặc HH:MM:SS
    const formatCallDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // cleanup helper
    const cleanupCall = () => {
        try {
            if (peerRef.current) {
                peerRef.current.onicecandidate = null;
                peerRef.current.ontrack = null;
                peerRef.current.close();
                peerRef.current = null;
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
            }
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = null;
            }
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
        } catch (e) {
            console.warn("Error during cleanupCall", e);
        }
        setInCall(false);
        setOutgoing(false);
        setCurrentCallIsVideo(false);
        setCurrentCallPartnerId(null);
        setCurrentCallPartnerInfo(null); // Reset thông tin caller
        setCallStartTime(null); // Reset thời gian bắt đầu
        setCallDuration(0); // Reset duration
        // cleared incoming call state (if any)
    };

    const startCall = async (isVideo: boolean) => {
        if (!selectedChat || !user) return;
        try {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            peerRef.current = pc;
            setOutgoing(true);
            setCurrentCallIsVideo(isVideo);
            setCurrentCallPartnerId(selectedChat); // Lưu ID người đang gọi
            // Lưu thông tin người đang gọi từ friendInfo hoặc groupInfo
            if (isGroup && groupInfo) {
                setCurrentCallPartnerInfo({
                    name: groupInfo.name,
                    displayName: groupInfo.name,
                });
            } else if (friendInfo) {
                setCurrentCallPartnerInfo({
                    name: friendInfo.username,
                    displayName: friendInfo.displayName || friendInfo.username,
                    avatar: friendInfo.avatarUrl,
                });
            }

            // Thử lấy media stream với retry logic
            let localStream: MediaStream | null = null;
            let retryCount = 0;
            const maxRetries = 3;

            while (!localStream && retryCount < maxRetries) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: !!isVideo,
                    });
                    break;
                } catch (error: any) {
                    retryCount++;
                    console.warn(`⚠️ Lỗi truy cập camera/mic (lần thử ${retryCount}/${maxRetries}):`, error);

                    if (error.name === 'NotReadableError' || error.name === 'NotAllowedError') {
                        if (retryCount < maxRetries) {
                            // Đợi 1 giây trước khi thử lại
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        } else {
                            // Nếu là video call và không lấy được video, thử chỉ audio
                            if (isVideo) {
                                console.log("📹 Không thể lấy video, thử chỉ audio...");
                                try {
                                    localStream = await navigator.mediaDevices.getUserMedia({
                                        audio: true,
                                        video: false,
                                    });
                                    alert("⚠️ Không thể truy cập camera. Cuộc gọi sẽ chỉ có âm thanh.");
                                    setCurrentCallIsVideo(false);
                                    break;
                                } catch (audioError) {
                                    console.error("❌ Không thể lấy audio:", audioError);
                                    throw new Error("Không thể truy cập camera hoặc microphone. Vui lòng kiểm tra quyền truy cập và đóng các ứng dụng khác đang sử dụng camera/mic.");
                                }
                            } else {
                                throw new Error("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
                            }
                        }
                    } else {
                        throw error;
                    }
                }
            }

            if (!localStream) {
                throw new Error("Không thể truy cập camera/microphone sau nhiều lần thử.");
            }

            localStreamRef.current = localStream;
            console.log("🎥 Local stream created:", {
                audioTracks: localStream.getAudioTracks().length,
                videoTracks: localStream.getVideoTracks().length,
                isVideo
            });

            // Gán local stream vào video element để hiển thị
            if (isVideo) {
                // Sử dụng setTimeout để đảm bảo ref đã được mount
                setTimeout(() => {
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = localStream;
                        console.log("📹 Local video stream attached to localVideoRef");
                    }
                }, 100);
            }
            localStream.getTracks().forEach((t) => {
                pc.addTrack(t, localStream);
                console.log("➕ Added track to peer connection:", t.kind, t.enabled);
            });

            pc.ontrack = (e) => {
                console.log("📹 Received remote track:", e.track.kind, e.streams);
                const stream = e.streams[0];

                if (!stream) {
                    console.warn("⚠️ No stream in ontrack event");
                    return;
                }

                // Gán toàn bộ stream vào cả audio và video elements
                // Browser sẽ tự động xử lý audio/video tracks
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = stream;
                    console.log("🔊 Audio stream attached to remoteAudioRef");
                }
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = stream;
                    console.log("📹 Video stream attached to remoteVideoRef");
                }
            };

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit("iceCandidate", {
                        to: selectedChat,
                        from: user._id,
                        candidate: e.candidate,
                    });
                }
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log("📞 Offer created and sent to:", selectedChat, "isVideo:", isVideo);

            socket.emit("callUser", {
                to: selectedChat,
                from: user._id,
                offer,
                isVideo,
            });
            // outgoing modal shown; wait for answer to set inCall
        } catch (e: any) {
            console.error("❌ Lỗi khi bắt đầu gọi:", e);
            const errorMessage = e.message || "Lỗi không xác định khi bắt đầu cuộc gọi";
            alert(`❌ ${errorMessage}`);
            cleanupCall();
        }
    };

    const answerCall = async (from: string, offer: any, isVideo = false) => {
        try {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            peerRef.current = pc;
            // Set state ngay lập tức để UI cập nhật
            setCurrentCallIsVideo(isVideo);
            setCurrentCallPartnerId(from); // Lưu ID người đã gọi (bên nhận)
            // Thông tin caller đã được lưu trong currentCallPartnerInfo từ onAccept
            console.log("📹 Set currentCallIsVideo to:", isVideo, "call partner:", from);

            // Thử lấy media stream với retry logic
            let localStream: MediaStream | null = null;
            let retryCount = 0;
            const maxRetries = 3;

            while (!localStream && retryCount < maxRetries) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: !!isVideo,
                    });
                    break;
                } catch (error: any) {
                    retryCount++;
                    console.warn(`⚠️ Lỗi truy cập camera/mic khi trả lời (lần thử ${retryCount}/${maxRetries}):`, error);

                    if (error.name === 'NotReadableError' || error.name === 'NotAllowedError') {
                        if (retryCount < maxRetries) {
                            // Đợi 1 giây trước khi thử lại
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        } else {
                            // Nếu là video call và không lấy được video, thử chỉ audio
                            if (isVideo) {
                                console.log("📹 Không thể lấy video, thử chỉ audio...");
                                try {
                                    localStream = await navigator.mediaDevices.getUserMedia({
                                        audio: true,
                                        video: false,
                                    });
                                    alert("⚠️ Không thể truy cập camera. Cuộc gọi sẽ chỉ có âm thanh.");
                                    setCurrentCallIsVideo(false);
                                    break;
                                } catch (audioError) {
                                    console.error("❌ Không thể lấy audio:", audioError);
                                    throw new Error("Không thể truy cập camera hoặc microphone. Vui lòng kiểm tra quyền truy cập và đóng các ứng dụng khác đang sử dụng camera/mic.");
                                }
                            } else {
                                throw new Error("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
                            }
                        }
                    } else {
                        throw error;
                    }
                }
            }

            if (!localStream) {
                throw new Error("Không thể truy cập camera/microphone sau nhiều lần thử.");
            }

            localStreamRef.current = localStream;
            console.log("🎥 Local stream created (answer):", {
                audioTracks: localStream.getAudioTracks().length,
                videoTracks: localStream.getVideoTracks().length,
                isVideo
            });

            // Gán local stream vào video element để hiển thị
            if (isVideo) {
                // Sử dụng setTimeout để đảm bảo ref đã được mount
                setTimeout(() => {
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = localStream;
                        console.log("📹 Local video stream attached to localVideoRef (answer)");
                    }
                }, 100);
            }
            localStream.getTracks().forEach((t) => {
                pc.addTrack(t, localStream);
                console.log("➕ Added track to peer connection (answer):", t.kind, t.enabled);
            });

            pc.ontrack = (e) => {
                console.log("📹 Received remote track (answer):", e.track.kind, e.streams);
                const stream = e.streams[0];

                if (!stream) {
                    console.warn("⚠️ No stream in ontrack event (answer)");
                    return;
                }

                // Gán toàn bộ stream vào cả audio và video elements
                // Browser sẽ tự động xử lý audio/video tracks
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = stream;
                    console.log("🔊 Audio stream attached to remoteAudioRef (answer)");
                }
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = stream;
                    console.log("📹 Video stream attached to remoteVideoRef (answer)");
                }
            };

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit("iceCandidate", {
                        to: from,
                        from: user._id,
                        candidate: e.candidate,
                    });
                }
            };

            console.log("📞 Answering call from:", from, "isVideo:", isVideo);
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log("✅ Answer created and set as local description");

            socket.emit("answerCall", { to: from, from: user._id, answer });
            setInCall(true);
            setCallStartTime(Date.now()); // Bắt đầu đếm thời gian
            console.log("📞 Call answered, inCall set to true");
        } catch (e: any) {
            console.error("❌ Lỗi trả lời cuộc gọi:", e);
            const errorMessage = e.message || "Lỗi không xác định khi trả lời cuộc gọi";
            alert(`❌ ${errorMessage}`);
            cleanupCall();
            setIncomingPayload(null);
        }
    };

    const endCall = () => {
        try {
            // Xác định người nhận endCall signal
            // Ưu tiên: currentCallPartnerId > incomingPayload.from > selectedChat
            const recipientId = currentCallPartnerId || incomingPayload?.from || selectedChat;

            // Luôn gửi endCall event cho bên kia, kể cả khi không có peer connection
            if (recipientId && user?._id) {
                socket.emit("endCall", { to: recipientId, from: user._id });
                console.log("📞 End call signal sent to:", recipientId);
            }
        } catch (e) {
            console.warn("⚠️ Error sending endCall", e);
        }
        // Cleanup local call
        cleanupCall();
        setOutgoing(false);
        setIncomingPayload(null);
        setCurrentCallPartnerId(null);
        console.log("✅ Local call ended and cleaned up");
    };

    // ✅ Cuộn xuống cuối khi có tin nhắn mới
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Debug: Log khi selectedChat thay đổi
    useEffect(() => {
        if (selectedChat) {
            console.log("✅ ChatArea rendered with selectedChat:", selectedChat);
            console.log("✅ isCustomizeOpen state:", isCustomizeOpen);
        }
    }, [selectedChat, isCustomizeOpen]);

    // Listen for theme changes (từ window event và socket)
    useEffect(() => {
        if (!user?._id) return;

        // Listen window event (local changes)
        const handleThemeChange = (e: CustomEvent) => {
            if (e.detail.chatId === selectedChat) {
                setChatTheme(e.detail.theme);
                console.log("Theme changed (local):", e.detail.theme);
            }
        };

        // Listen socket event (remote changes từ bạn bè)
        const handleSocketThemeChange = (data: { chatId: string; theme: string | null }) => {
            // data.chatId là userId của người gửi, selectedChat là userId của người đang chat
            // Nếu đang chat với người gửi event, thì cập nhật theme
            if (data.chatId === selectedChat) {
                setChatTheme(data.theme);
                // Cũng cập nhật localStorage
                const themeKey = `chat_theme_${selectedChat}`;
                if (data.theme) {
                    localStorage.setItem(themeKey, data.theme);
                } else {
                    localStorage.removeItem(themeKey);
                }
                console.log("Theme changed (socket):", data.theme);
            }
        };

        window.addEventListener('chatThemeChanged', handleThemeChange as EventListener);
        socket.on("chatThemeChanged", handleSocketThemeChange);

        return () => {
            window.removeEventListener('chatThemeChanged', handleThemeChange as EventListener);
            socket.off("chatThemeChanged", handleSocketThemeChange);
            socket.off("groupUpdated");
            socket.off("leftGroup");
        };
    }, [selectedChat, user?._id]);

    // Listen for group updates (window event)
    useEffect(() => {
        const handleGroupUpdated = async (e: Event) => {
            const customEvent = e as CustomEvent;
            if (!selectedChat || !isGroup) return;

            const updatedGroup = customEvent.detail;
            if (updatedGroup && (updatedGroup._id === selectedChat || updatedGroup.id === selectedChat)) {
                // Cập nhật groupInfo từ event hoặc fetch lại
                if (updatedGroup.name) {
                    setGroupInfo(updatedGroup);
                } else {
                    // Fetch lại từ API nếu không có đầy đủ thông tin
                    try {
                        const res = await api.get(`/groups/${selectedChat}`);
                        setGroupInfo(res.data);
                    } catch (err) {
                        console.error("Lỗi fetch group info:", err);
                    }
                }
            }
        };

        window.addEventListener('groupUpdated', handleGroupUpdated);
        return () => {
            window.removeEventListener('groupUpdated', handleGroupUpdated);
        };
    }, [selectedChat, isGroup]);

    // Listen for customization changes (when nickname/theme/quickReaction is saved)
    useEffect(() => {
        const handleCustomizationChange = (e: CustomEvent) => {
            if (!selectedChat || e.detail.chatId !== selectedChat) return;

            if (e.detail.type === 'nickname') {
                setChatNickname(e.detail.value);
                console.log("Nickname updated:", e.detail.value);
            }
            if (e.detail.type === 'theme') {
                setChatTheme(e.detail.value);
                console.log("Theme updated:", e.detail.value);
            }
            if (e.detail.type === 'quickReaction') {
                setChatQuickReaction(e.detail.value || "👍");
                console.log("Quick reaction updated:", e.detail.value);
            }
        };

        window.addEventListener('chatCustomizationChanged', handleCustomizationChange as EventListener);
        return () => {
            window.removeEventListener('chatCustomizationChanged', handleCustomizationChange as EventListener);
        };
    }, [selectedChat]);

    // Listen for socket events for real-time customization sync
    useEffect(() => {
        if (!user?._id || !selectedChat) return;

        const handleSocketCustomizationChange = (data: {
            chatId: string;
            type: 'nickname' | 'theme' | 'quickReaction';
            value: any;
            isGroup?: boolean;
        }) => {
            // Chỉ xử lý nếu đang ở đúng chat
            if (data.chatId !== selectedChat) return;

            console.log("📡 Socket customization changed:", data);

            if (data.type === 'nickname') {
                setChatNickname(data.value);
                // Cập nhật localStorage
                const key = `chat_nickname_${selectedChat}`;
                if (data.value) {
                    localStorage.setItem(key, data.value);
                } else {
                    localStorage.removeItem(key);
                }
            } else if (data.type === 'theme') {
                setChatTheme(data.value);
                // Cập nhật localStorage
                const key = `chat_theme_${selectedChat}`;
                if (data.value) {
                    localStorage.setItem(key, data.value);
                } else {
                    localStorage.removeItem(key);
                }
            } else if (data.type === 'quickReaction') {
                setChatQuickReaction(data.value || "👍");
                // Cập nhật localStorage
                const key = `chat_quick_reaction_${selectedChat}`;
                localStorage.setItem(key, data.value || "👍");
            }

            // Emit window event để các component khác cũng cập nhật
            window.dispatchEvent(new CustomEvent('chatCustomizationChanged', {
                detail: {
                    chatId: data.chatId,
                    type: data.type,
                    value: data.value,
                }
            }));
        };

        socket.on("chatCustomizationChanged", handleSocketCustomizationChange);

        return () => {
            socket.off("chatCustomizationChanged", handleSocketCustomizationChange);
        };
    }, [selectedChat, user?._id]);

    // 🚀 Gửi tin nhắn
    const handleSend = async (
        content?: string,
        messageType: "text" | "image" | "audio" | "gif" | "emoji" = "text",
        imgUrl?: string,
        audioUrl?: string,
        gifUrl?: string
    ) => {
        const messageContent = content || message;
        // Kiểm tra nội dung: với emoji, chỉ cần có content, không cần trim
        const hasValidContent = messageType === "emoji"
            ? (messageContent && messageContent.length > 0)
            : (messageContent && messageContent.trim().length > 0);

        if ((!hasValidContent && !imgUrl && !audioUrl && !gifUrl) || !selectedChat || !user) return;

        try {
            const messageData: any = {
                senderId: user._id,
                content: messageContent,
                messageType,
                imgUrl: imgUrl || "",
                audioUrl: audioUrl || "",
                gifUrl: gifUrl || "",
            };

            if (isGroup) {
                messageData.groupId = selectedChat;
                socket.emit("sendMessage", messageData);
            } else {
                messageData.receiverId = selectedChat;
                socket.emit("sendMessage", messageData);
            }

            setMessage("");
        } catch (err) {
            console.error("Lỗi gửi tin:", err);
        }
    };

    // open group creation modal
    const handleOpenCreate = () => {
        setIsCreateOpen(true);
    };

    // 📷 Xử lý upload ảnh
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate image file
        if (!file.type.startsWith("image/")) {
            alert("Vui lòng chọn file ảnh");
            return;
        }

        const formData = new FormData();
        formData.append("image", file);

        try {
            const uploadRes = await api.post("/upload/image", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            // Use baseURL from axios config
            const baseURL = import.meta.env.MODE === "development"
                ? "http://localhost:5001"
                : "";
            const imgUrl = `${baseURL}${uploadRes.data.url}`;
            await handleSend(message, "image", imgUrl);
        } catch (err) {
            console.error("Lỗi upload ảnh:", err);
            alert("Lỗi khi upload ảnh");
        }

        // Reset input
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    };

    // 👍 Gửi cảm xúc nhanh (quick reaction)
    const handleQuickReaction = () => {
        if (!chatQuickReaction || !selectedChat || !user) return;
        handleSend(chatQuickReaction, "emoji");
    };


    // Helper function to get theme colors as CSS values
    const getThemeColors = () => {
        if (!chatTheme) {
            return null;
        }

        // Map of color names to Tailwind color values
        const colorMap: { [key: string]: { light: string; lighter: string; dark: string; border: string } } = {
            blue: {
                light: "rgb(239, 246, 255)", // blue-50
                lighter: "rgb(219, 234, 254)", // blue-100
                dark: "rgb(30, 58, 138)", // blue-900
                border: "rgb(191, 219, 254)", // blue-200
            },
            purple: {
                light: "rgb(250, 245, 255)", // purple-50
                lighter: "rgb(243, 232, 255)", // purple-100
                dark: "rgb(88, 28, 135)", // purple-900
                border: "rgb(233, 213, 255)", // purple-200
            },
            pink: {
                light: "rgb(253, 244, 255)", // pink-50
                lighter: "rgb(250, 232, 255)", // pink-100
                dark: "rgb(131, 24, 67)", // pink-900
                border: "rgb(251, 207, 232)", // pink-200
            },
            green: {
                light: "rgb(240, 253, 244)", // green-50
                lighter: "rgb(220, 252, 231)", // green-100
                dark: "rgb(20, 83, 45)", // green-900
                border: "rgb(187, 247, 208)", // green-200
            },
            orange: {
                light: "rgb(255, 247, 237)", // orange-50
                lighter: "rgb(255, 237, 213)", // orange-100
                dark: "rgb(154, 52, 18)", // orange-900
                border: "rgb(254, 215, 170)", // orange-200
            },
        };

        const colorMatch = chatTheme.match(/from-(\w+)-500/);
        if (colorMatch) {
            const colorName = colorMatch[1];
            return colorMap[colorName] || null;
        }
        return null;
    };

    // Helper function to get background style for main area
    const getThemeBackgroundStyle = (): React.CSSProperties => {
        const colors = getThemeColors();
        if (!colors) {
            return {};
        }
        return {
            background: `linear-gradient(to bottom right, ${colors.light}, ${colors.lighter})`,
        };
    };

    // Helper function to convert rgb to rgba with opacity
    const rgbToRgba = (rgb: string, opacity: number): string => {
        const match = rgb.match(/\d+/g);
        if (match && match.length === 3) {
            return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${opacity})`;
        }
        return rgb;
    };

    // Helper function to get header/input background style
    const getThemeHeaderStyle = (): React.CSSProperties => {
        const colors = getThemeColors();
        if (!colors) {
            return {};
        }
        return {
            backgroundColor: isDark
                ? rgbToRgba(colors.dark, 0.95) // 95% opacity
                : rgbToRgba(colors.light, 0.95), // 95% opacity
            borderColor: isDark
                ? colors.dark
                : colors.border,
        };
    };

    // 💤 Nếu chưa chọn chat
    if (!selectedChat) {
        return (
            <div
                className={`flex-1 flex items-center justify-center ${isDark ? "bg-gray-900" : "bg-gray-50"
                    }`}
            >
                <div className="text-center">
                    <MessageCircle
                        className={`w-20 h-20 mx-auto mb-4 ${isDark ? "text-gray-700" : "text-gray-300"
                            }`}
                    />
                    <h3
                        className={`text-xl font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"
                            }`}
                    >
                        Chọn một cuộc trò chuyện
                    </h3>
                    <p className={`${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        Chọn bạn bè từ danh sách để bắt đầu nhắn tin
                    </p>
                </div>
            </div>
        );
    }
    const themeColors = getThemeColors();
    const hasTheme = !!chatTheme && !!themeColors;

    return (
        <div
            className={`flex-1 flex flex-col ${hasTheme
                ? "text-gray-900"
                : isDark
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-900"
                }`}
            style={hasTheme ? getThemeBackgroundStyle() : undefined}
        >
            {/* Header */}
            <div
                className={`p-4 border-b backdrop-blur-md shadow-sm ${hasTheme
                    ? ""
                    : isDark
                        ? "bg-gray-900/95 border-gray-800/50"
                        : "bg-white/95 border-gray-200/50"
                    }`}
                style={hasTheme ? getThemeHeaderStyle() : undefined}
            >
                <div className="flex items-center gap-3">
                    <div className="relative">
                        {isGroup ? (
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white/20 transition-all duration-300 hover:scale-110">
                                {groupInfo?.name?.[0]?.toUpperCase() || "?"}
                            </div>
                        ) : getAvatarUrl(friendInfo?.avatarUrl) ? (
                            <img
                                src={getAvatarUrl(friendInfo?.avatarUrl)!}
                                alt="Avatar"
                                className="w-12 h-12 rounded-full object-cover shadow-lg ring-2 ring-white/20 transition-all duration-300 hover:scale-110"
                            />
                        ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white/20 transition-all duration-300 hover:scale-110">
                                {((friendInfo?.displayName || friendInfo?.username)?.[0]
                                )?.toUpperCase() || "?"}
                            </div>
                        )}
                        {friendInfo?.status === "online" && !isGroup && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-lg shadow-green-500/50 animate-pulse"></span>
                        )}
                    </div>
                    <div>
                        <h2 className="font-semibold flex items-center gap-2">
                            {isGroup
                                ? groupInfo?.name
                                : chatNickname || friendInfo?.displayName || friendInfo?.username || "Đang tải..."}
                        </h2>
                        <p
                            className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"
                                }`}
                        >
                            {isGroup
                                ? `Thành viên: ${groupInfo?.members?.length || 0}`
                                : friendInfo?.status === "online"
                                    ? "Đang hoạt động"
                                    : "Không hoạt động"}
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {isGroup ? (
                            <>
                                <button
                                    onClick={() => (inCall ? endCall() : startCall(false))}
                                    className={`p-2.5 rounded-xl transition-all duration-300 ${inCall
                                        ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
                                        : isDark
                                            ? "hover:bg-gray-800 hover:shadow-md"
                                            : "hover:bg-gray-100 hover:shadow-md"
                                        }`}
                                >
                                    <Phone className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => (inCall ? endCall() : startCall(true))}
                                    className={`p-2.5 rounded-xl transition-all duration-300 ${inCall
                                        ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
                                        : isDark
                                            ? "hover:bg-gray-800 hover:shadow-md"
                                            : "hover:bg-gray-100 hover:shadow-md"
                                        }`}
                                >
                                    <Video className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("🔵 More button clicked!", {
                                            selectedChat,
                                            isCustomizeOpen,
                                            willSetTo: true
                                        });
                                        setIsCustomizeOpen(true);
                                        console.log("🔵 After setState, checking in next render...");
                                    }}
                                    className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                                        ? "hover:bg-gray-800 hover:shadow-md"
                                        : "hover:bg-gray-100 hover:shadow-md"
                                        }`}
                                    title="Tùy chỉnh đoạn chat"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                >
                                    <MoreHorizontal className="w-5 h-5" style={{ minWidth: '20px', minHeight: '20px' }} />
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => (inCall ? endCall() : startCall(false))}
                                    className={`p-2.5 rounded-xl transition-all duration-300 ${inCall
                                        ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
                                        : isDark
                                            ? "hover:bg-gray-800 hover:shadow-md"
                                            : "hover:bg-gray-100 hover:shadow-md"
                                        }`}
                                >
                                    <Phone className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => (inCall ? endCall() : startCall(true))}
                                    className={`p-2.5 rounded-xl transition-all duration-300 ${inCall
                                        ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
                                        : isDark
                                            ? "hover:bg-gray-800 hover:shadow-md"
                                            : "hover:bg-gray-100 hover:shadow-md"
                                        }`}
                                >
                                    <Video className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("🔵 More button clicked!", {
                                            selectedChat,
                                            isCustomizeOpen,
                                            willSetTo: true
                                        });
                                        setIsCustomizeOpen(true);
                                        console.log("🔵 After setState, checking in next render...");
                                    }}
                                    className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                                        ? "hover:bg-gray-800 hover:shadow-md"
                                        : "hover:bg-gray-100 hover:shadow-md"
                                        }`}
                                    title="Tùy chỉnh đoạn chat"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                >
                                    <MoreHorizontal className="w-5 h-5" style={{ minWidth: '20px', minHeight: '20px' }} />
                                </button>
                                <button
                                    onClick={handleOpenCreate}
                                    className="text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:scale-105"
                                >
                                    Tạo nhóm
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!isGroup && (
                <CreateGroupModal
                    isOpen={isCreateOpen}
                    onClose={() => setIsCreateOpen(false)}
                    preselect={selectedChat}
                    onGroupCreated={(groupId?: string) => {
                        // Refresh groups if needed
                        window.dispatchEvent(new CustomEvent('refreshGroups'));
                        // Tự động chọn nhóm vừa tạo
                        if (groupId && onSelectChat) {
                            onSelectChat(groupId);
                        }
                    }}
                />
            )}

            <ChatCustomizeModal
                isOpen={isCustomizeOpen}
                onClose={() => setIsCustomizeOpen(false)}
                isDark={isDark}
                selectedChat={selectedChat}
                userId={user?._id || null}
                isGroup={isGroup}
                groupInfo={groupInfo}
                onSelectChat={onSelectChat}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {(() => {
                    // Tìm tin nhắn mới nhất của user đã được xem (chỉ tính một lần)
                    let lastSeenMessageId: string | null = null;
                    if (!isGroup && selectedChat) {
                        // Tìm tin nhắn cuối cùng của user đã được xem
                        for (let i = messages.length - 1; i >= 0; i--) {
                            const msg = messages[i];
                            const senderId = msg.senderId?._id || msg.senderId;
                            if (senderId === user._id) {
                                const hasBeenSeen = msg.seenBy?.some(
                                    (seen: any) => String(seen.userId || seen) === String(selectedChat)
                                );
                                if (hasBeenSeen) {
                                    lastSeenMessageId = msg._id || msg.id || null;
                                    break;
                                }
                            }
                        }
                    }

                    return messages.map((msg, idx) => {
                        const senderId = msg.senderId?._id || msg.senderId;
                        const senderInfo = msg.senderId;
                        const isOwn = senderId === user._id;
                        const showAvatar =
                            idx === 0 ||
                            (messages[idx - 1].senderId?._id || messages[idx - 1].senderId) !== senderId;

                        // Kiểm tra xem đây có phải tin nhắn cuối cùng đã được xem không
                        const isLastSeenMessage = isOwn && !isGroup && lastSeenMessageId &&
                            (msg._id === lastSeenMessageId || msg.id === lastSeenMessageId);

                        // Lấy thông tin sender để hiển thị (cho group chat) hoặc friendInfo (cho private chat)
                        const displaySender = isGroup ? senderInfo : friendInfo;
                        const senderAvatarUrl = isGroup
                            ? (senderInfo?.avatarUrl || null)
                            : (friendInfo?.avatarUrl || null);
                        const senderName = isGroup
                            ? (senderInfo?.displayName || senderInfo?.username || "?")
                            : (friendInfo?.displayName || friendInfo?.username || "?");

                        return (
                            <div
                                key={msg._id || Math.random()}
                                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`flex gap-2 max-w-md ${isOwn ? "flex-row-reverse" : "flex-row"
                                        }`}
                                >
                                    {!isOwn && (
                                        <div
                                            className={`w-8 h-8 flex-shrink-0 ${showAvatar ? "" : "invisible"
                                                }`}
                                        >
                                            {senderAvatarUrl ? (
                                                <img
                                                    src={getAvatarUrl(senderAvatarUrl)!}
                                                    alt={senderName}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                                    {senderName?.[0]?.toUpperCase() || "?"}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div
                                        className={`flex flex-col ${isOwn ? "items-end" : "items-start"
                                            }`}
                                    >
                                        {/* Hiển thị tên người gửi trong group chat */}
                                        {isGroup && !isOwn && showAvatar && (
                                            <span
                                                className={`text-xs mb-1 px-1 ${isDark ? "text-gray-400" : "text-gray-600"
                                                    }`}
                                            >
                                                {senderName}
                                            </span>
                                        )}
                                        <div
                                            className={`px-4 py-3 rounded-2xl transition-all duration-300 hover:scale-[1.02] ${isOwn
                                                ? chatTheme
                                                    ? `bg-gradient-to-r ${chatTheme} text-white rounded-br-sm shadow-lg shadow-blue-500/30`
                                                    : "bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white rounded-br-sm shadow-lg shadow-blue-500/30"
                                                : isDark
                                                    ? "bg-gray-800 text-gray-100 border border-gray-700/50 rounded-bl-sm shadow-md shadow-gray-900/20"
                                                    : "bg-white text-gray-900 border border-gray-200/50 rounded-bl-sm shadow-md shadow-gray-200/30"
                                                }`}
                                        >
                                            {/* Hiển thị ảnh */}
                                            {msg.imgUrl && (
                                                <img
                                                    src={msg.imgUrl}
                                                    alt="Message image"
                                                    className="max-w-xs rounded-lg mb-2"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = "placeholder.png";
                                                    }}
                                                />
                                            )}
                                            {/* Hiển thị GIF */}
                                            {msg.gifUrl && (
                                                <img
                                                    src={msg.gifUrl}
                                                    alt="GIF"
                                                    className="max-w-xs rounded-lg mb-2"
                                                />
                                            )}
                                            {/* Hiển thị audio */}
                                            {msg.audioUrl && (
                                                <audio
                                                    controls
                                                    src={msg.audioUrl}
                                                    className="w-full mb-2"
                                                >
                                                    Your browser does not support the audio element.
                                                </audio>
                                            )}
                                            {/* Hiển thị text content hoặc emoji lớn */}
                                            {msg.content && (
                                                msg.messageType === "emoji" && msg.content.trim().length <= 10 ? (
                                                    // Hiển thị emoji lớn nếu là quick reaction (cho phép emoji kết hợp)
                                                    <div className="text-4xl text-center py-2">
                                                        {msg.content}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm break-words">{msg.content}</p>
                                                )
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                                            {msg.createdAt && (
                                                <span
                                                    className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"
                                                        }`}
                                                >
                                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            )}
                                            {/* Hiển thị "đã xem" chỉ ở tin nhắn mới nhất đã được xem */}
                                            {isOwn && !isGroup && isLastSeenMessage && (
                                                <span
                                                    className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"
                                                        }`}
                                                >
                                                    • Đã xem
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    });
                })()}
                <div ref={scrollRef} />
            </div>

            {/* Input */}
            <div
                className={`p-4 border-t backdrop-blur-md shadow-lg ${hasTheme
                    ? ""
                    : isDark
                        ? "bg-gray-900/95 border-gray-800/50"
                        : "bg-white/95 border-gray-200/50"
                    }`}
                style={hasTheme ? getThemeHeaderStyle() : undefined}
            >
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Aa"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        className={`flex-1 rounded-xl px-4 py-3 text-sm border transition-all duration-300 ${isDark
                            ? "bg-gray-800/80 border-gray-700/50 text-white placeholder-gray-500 focus:border-blue-500 focus:bg-gray-800 focus:shadow-lg focus:shadow-blue-500/20"
                            : "bg-white/80 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10"
                            } focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:scale-[1.02]`}
                    />
                    {/* Icons on the right side */}
                    <div className="flex items-center gap-1 relative">
                        {/* Hidden file input for images */}
                        <input
                            type="file"
                            ref={imageInputRef}
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />

                        <button
                            onClick={() => imageInputRef.current?.click()}
                            className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                                ? "hover:bg-gray-700/80 text-gray-300 hover:text-white hover:shadow-md"
                                : "hover:bg-gray-100 text-gray-600 hover:text-gray-900 hover:shadow-md"
                                }`}
                            title="Gửi ảnh"
                        >
                            <Image className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleQuickReaction}
                            className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                                ? "text-blue-400 hover:bg-blue-900/30 hover:shadow-md hover:scale-110"
                                : "text-blue-600 hover:bg-blue-50 hover:shadow-md hover:scale-110"
                                }`}
                            title="Cảm xúc nhanh"
                        >
                            {chatQuickReaction ? (
                                <span className="text-xl">{chatQuickReaction}</span>
                            ) : (
                                <ThumbsUp className="w-5 h-5" />
                            )}
                        </button>
                        <button
                            onClick={() => handleSend()}
                            className="p-2.5 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95"
                            title="Gửi"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
            {/* Call modal (incoming / outgoing) - ẩn khi đang trong cuộc gọi video */}
            <CallModal
                open={(!!incomingPayload || (outgoing && !inCall) || (inCall && !currentCallIsVideo))}
                outgoing={outgoing}
                inCall={inCall}
                callerName={
                    incomingPayload?.callerName ||
                    currentCallPartnerInfo?.name ||
                    (inCall || outgoing
                        ? isGroup
                            ? groupInfo?.name
                            : friendInfo?.username
                        : undefined)
                }
                callerDisplayName={
                    incomingPayload?.callerDisplayName ||
                    currentCallPartnerInfo?.displayName ||
                    (inCall || outgoing
                        ? isGroup
                            ? groupInfo?.name
                            : friendInfo?.displayName || friendInfo?.username
                        : undefined)
                }
                callerAvatar={
                    incomingPayload?.callerAvatar ||
                    currentCallPartnerInfo?.avatar ||
                    (inCall || outgoing
                        ? isGroup
                            ? undefined
                            : friendInfo?.avatarUrl
                        : undefined)
                }
                isVideo={incomingPayload?.isVideo || currentCallIsVideo}
                callDuration={inCall ? formatCallDuration(callDuration) : undefined}
                onAccept={() => {
                    if (incomingPayload) {
                        const isVideo = incomingPayload.isVideo || false;
                        // Lưu thông tin caller trước khi clear incomingPayload
                        setCurrentCallPartnerInfo({
                            name: incomingPayload.callerName,
                            displayName: incomingPayload.callerDisplayName,
                            avatar: incomingPayload.callerAvatar,
                        });
                        // Set state trước để UI cập nhật ngay
                        setCurrentCallIsVideo(isVideo);
                        setIncomingPayload(null);
                        // Gọi answerCall
                        answerCall(
                            incomingPayload.from,
                            incomingPayload.offer,
                            isVideo
                        );
                    }
                }}
                onReject={() => {
                    if (inCall) {
                        endCall();
                    } else if (incomingPayload) {
                        socket.emit("endCall", {
                            to: incomingPayload.from,
                            from: user._id,
                        });
                        setIncomingPayload(null);
                    }
                }}
                onCancel={() => {
                    // cancel outgoing call
                    socket.emit("endCall", { to: selectedChat, from: user._id });
                    setOutgoing(false);
                    cleanupCall();
                }}
            />

            {/* Video call overlay - hiển thị khi đang trong cuộc gọi video */}
            {currentCallIsVideo && inCall && (
                <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
                    {/* Remote video - video của người kia (full screen) */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        onLoadedMetadata={() => {
                            console.log("✅ Remote video loaded");
                            if (remoteVideoRef.current) {
                                remoteVideoRef.current.play().catch(e => {
                                    console.error("❌ Error playing remote video:", e);
                                });
                            }
                        }}
                        onError={(e) => {
                            console.error("❌ Remote video error:", e);
                        }}
                    />

                    {/* Local video - video của mình (góc trên bên phải) */}
                    <div className="absolute top-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20 bg-gray-900">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                            onLoadedMetadata={() => {
                                console.log("✅ Local video loaded");
                                if (localVideoRef.current) {
                                    localVideoRef.current.play().catch(e => {
                                        console.error("❌ Error playing local video:", e);
                                    });
                                }
                            }}
                            onError={(e) => {
                                console.error("❌ Local video error:", e);
                            }}
                        />
                    </div>

                    {/* Call duration timer - hiển thị ở trên cùng */}
                    {callDuration > 0 && (
                        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
                            <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-full">
                                <p className="text-2xl font-mono font-bold text-white">
                                    {formatCallDuration(callDuration)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Remote audio - ẩn nhưng vẫn phát */}
                    <audio
                        ref={remoteAudioRef}
                        autoPlay
                        playsInline
                        className="hidden"
                        onLoadedMetadata={() => {
                            console.log("✅ Remote audio loaded");
                            if (remoteAudioRef.current) {
                                remoteAudioRef.current.play().catch(e => {
                                    console.error("❌ Error playing remote audio:", e);
                                });
                            }
                        }}
                        onError={(e) => {
                            console.error("❌ Remote audio error:", e);
                        }}
                    />

                    {/* Control buttons */}
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
                        <button
                            onClick={endCall}
                            className="flex items-center justify-center w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200"
                            title="Ngắt cuộc gọi"
                        >
                            <PhoneOff className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}

            {/* Audio-only call - chỉ hiển thị modal, không có video overlay */}
            {!currentCallIsVideo && inCall && (
                <audio
                    ref={remoteAudioRef}
                    autoPlay
                    playsInline
                    className="hidden"
                    onLoadedMetadata={() => {
                        console.log("✅ Remote audio loaded (audio call)");
                        if (remoteAudioRef.current) {
                            remoteAudioRef.current.play().catch(e => {
                                console.error("❌ Error playing remote audio:", e);
                            });
                        }
                    }}
                    onError={(e) => {
                        console.error("❌ Remote audio error:", e);
                    }}
                />
            )}
        </div>
    );
}
