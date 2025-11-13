import { io } from "socket.io-client";

const userId = localStorage.getItem("userId");

// ✅ Nếu đang deploy (Render) thì dùng origin → https://webchat-533n.onrender.com
// ✅ Nếu local → http://localhost:5001
const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5001"
    : window.location.origin.replace(/^http/, "ws");

export const socket = io(BASE_URL, {
  withCredentials: true,
  transports: ["websocket"],
  query: { userId },
});
