import AsyncStorage from "@react-native-async-storage/async-storage";

export const AUTH_TOKEN_KEY = "token";

export async function getToken() {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function setToken(token) {
  if (!token) {
    await removeToken();
    return;
  }

  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function removeToken() {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}
