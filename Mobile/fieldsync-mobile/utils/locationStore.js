import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "route_points";

export async function savePoint(point) {
  const existing = await AsyncStorage.getItem(KEY);
  const points = existing ? JSON.parse(existing) : [];

  points.push(point);

  await AsyncStorage.setItem(KEY, JSON.stringify(points));
}

export async function getPoints() {
  const data = await AsyncStorage.getItem(KEY);
  return data ? JSON.parse(data) : [];
}

export async function clearPoints() {
  await AsyncStorage.removeItem(KEY);
}