import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// ── Web uses localStorage, Mobile uses SecureStore ──
const isWeb = Platform.OS === "web";

const storage = {
  async set(key, value) {
    if (isWeb) {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async get(key) {
    if (isWeb) {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  async remove(key) {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const saveToken  = (token) => storage.set("user_token", token);
export const getToken   = ()      => storage.get("user_token");
export const removeToken= ()      => storage.remove("user_token");

export const saveUser   = (user)  => storage.set("user_data", JSON.stringify(user));
export const getUser    = async () => {
  const data = await storage.get("user_data");
  return data ? JSON.parse(data) : null;
};
export const removeUser = ()      => storage.remove("user_data");

export const clearAll   = async () => {
  await removeToken();
  await removeUser();
};