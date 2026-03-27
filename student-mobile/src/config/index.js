import { Platform } from "react-native";

const USE_NGROK  = false;
const USE_DOCKER = false;  // ← change to false (you're using XAMPP now, not Docker)

const NGROK_URL = "https://PASTE-YOUR-NGROK-URL-HERE";

const LOCAL_IP = "10.44.227.240";  // ← paste YOUR actual IP from ipconfig here

const BASE = USE_NGROK
  ? NGROK_URL
  : Platform.OS === "web"
    ? "http://localhost:8000"
    : `http://${LOCAL_IP}:8000`;

export const API_URL     = `${BASE}/api`;
export const STORAGE_URL = `${BASE}/storage`;
export const COUNSELOR   = "Julie Torreon Maestrado";