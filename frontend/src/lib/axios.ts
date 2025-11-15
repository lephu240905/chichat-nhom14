import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";

// ✅ Tự động phát hiện IP và cấu hình base URL
const getBaseURL = () => {
  if (import.meta.env.MODE === "development") {
    const hostname = window.location.hostname;

    // Nếu truy cập qua IP (không phải localhost) → dùng IP đó
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:5001/api`;
    }

    // Nếu localhost → dùng localhost
    return "http://localhost:5001/api";
  }
  // Production → dùng relative path
  return "/api";
};

const BASE_URL = getBaseURL();

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Gắn access token vào header
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Tự refresh token khi hết hạn
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (
      originalRequest.url.includes("/auth/signin") ||
      originalRequest.url.includes("/auth/signup") ||
      originalRequest.url.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 403 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await api.post("/auth/refresh");
        const newAccessToken = res.data.accessToken;
        useAuthStore.getState().setAccessToken(newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        useAuthStore.getState().clearState();
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
