import axios from "axios";
import { Platform } from "react-native";
import { API_URL } from "../config";  // ← uses config/index.js

// ── Authenticated API (for logged-in requests) ──
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 15000,
});

api.interceptors.request.use(
  async (config) => {
    let token = null;
    if (Platform.OS === "web") {
      token = typeof localStorage !== "undefined"
        ? localStorage.getItem("user_token") : null;
    } else {
      const SecureStore = await import("expo-secure-store");
      token = await SecureStore.getItemAsync("user_token");
    }
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("401 Unauthorized — token may be missing or expired");
    }
    return Promise.reject(error);
  }
);

// ── Public API (NO token — for login, register, reset password) ──
export const publicApi = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 15000,
});

export default api;