import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "sync_queue";

// ➕ Add job to queue
export async function addToQueue(job) {
  const existing = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = existing ? JSON.parse(existing) : [];

  queue.push(job);

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// 📥 Get queue
export async function getQueue() {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
}

// 🧹 Clear queue
export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function getQueueCount() {
  const data = await AsyncStorage.getItem("sync_queue");
  const queue = data ? JSON.parse(data) : [];
  return queue.length;
}