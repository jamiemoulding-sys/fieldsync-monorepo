import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "./supabase";

const LOCATION_TASK = "background-location-task";
const TRACKING_CONTEXT_KEY = "fieldsync_tracking_context";

let lastCoords = null;

async function getTrackingContext() {
  const raw = await AsyncStorage.getItem(TRACKING_CONTEXT_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function saveTrackingContext(context) {
  await AsyncStorage.setItem(
    TRACKING_CONTEXT_KEY,
    JSON.stringify({
      ...context,
      active: true,
      started_at: new Date().toISOString(),
    })
  );
}

async function clearTrackingContext() {
  await AsyncStorage.removeItem(TRACKING_CONTEXT_KEY);
}

async function sendLocationPing(coords) {
  const context = await getTrackingContext();
  if (!context?.active || !context.shiftId || !context.userId || !context.companyId) {
    return;
  }

  const payload = {
    shift_id: context.shiftId,
    user_id: context.userId,
    company_id: context.companyId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed: coords.speed || 0,
    accuracy: coords.accuracy || 0,
    battery: 0,
  };

  const { error } = await supabase.from("shift_route_logs").insert([payload]);

  if (error) {
    console.log("TRACKING PING ERROR:", error.message);
  }
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;

  const { locations } = data;

  for (const loc of locations) {
    const { latitude, longitude } = loc.coords;

    if (
      lastCoords &&
      Math.abs(latitude - lastCoords.latitude) < 0.00005 &&
      Math.abs(longitude - lastCoords.longitude) < 0.00005
    ) {
      return;
    }

    lastCoords = { latitude, longitude };
    await sendLocationPing(loc.coords);
  }
});

export async function startTracking(context) {
  if (!context?.shiftId || !context?.userId || !context?.companyId) {
    console.log("TRACKING NOT STARTED: missing context");
    return false;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  await saveTrackingContext(context);

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    console.log("Background tracking permission not granted; foreground tracking only.");
    return true;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
  });

  console.log("Tracking started");
  return true;
}

export async function stopTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);

  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }

  await clearTrackingContext();
  lastCoords = null;
  console.log("Tracking stopped");
}

export async function isTrackingActive() {
  const context = await getTrackingContext();
  return !!context?.active;
}

export async function pingCurrentLocation(coords) {
  await sendLocationPing(coords);
}
