import { io } from "socket.io-client";

const userId = localStorage.getItem("userId");

// ✅ Tự động phát hiện IP và cấu hình Socket URL
const getSocketURL = () => {
  const hostname = window.location.hostname;

  // Development: Dùng hostname hiện tại (localhost hoặc IP)
  if (import.meta.env.MODE === "development") {
    return `http://${hostname}:5001`;
  }

  // Production (Render)
  return window.location.origin.replace(/^http/, "ws");
};

const BASE_URL = getSocketURL();

export const socket = io(BASE_URL, {
  withCredentials: true,
  transports: ["websocket"],
  query: { userId },
});
