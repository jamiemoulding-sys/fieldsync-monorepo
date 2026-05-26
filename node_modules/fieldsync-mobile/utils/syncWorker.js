import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";
import { clearQueue, getQueue } from "./syncQueue";

/* =========================
   STATUS STORAGE
========================= */

const STATUS_KEY = "sync_status";

function devLog(...args) {
  if (__DEV__) {
    console.log(...args);
  }
}

export async function setStatus(status) {
  await AsyncStorage.setItem(STATUS_KEY, status);
}

export async function getStatus() {
  return await AsyncStorage.getItem(STATUS_KEY);
}

/* =========================
   PROCESS QUEUE
========================= */

export async function processQueue() {
  const queue = await getQueue();

  // Nothing to sync
  if (!queue.length) {
    await setStatus("synced");
    return;
  }

  devLog("Processing queue:", queue.length);

  await setStatus("syncing");

  const failed = [];

  for (const job of queue) {
    try {
      await API.post("/route", job);
      devLog("Synced job");
    } catch (err) {
      devLog("Failed job, keeping in queue");
      failed.push(job);
    }
  }

  // Clear old queue
  await clearQueue();

  // Save failed jobs back
  if (failed.length) {
    await AsyncStorage.setItem("sync_queue", JSON.stringify(failed));
    await setStatus("failed");
  } else {
    await setStatus("synced");
  }
}
