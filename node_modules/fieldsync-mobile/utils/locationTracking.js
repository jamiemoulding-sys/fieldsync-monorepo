import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

const LOCATION_TASK = "background-location-task";

// 🔥 store last location to avoid spam logging
let lastCoords = null;

TaskManager.defineTask(LOCATION_TASK, ({ data, error }) => {
  if (error) return;

  if (data) {
    const { locations } = data;

    locations.forEach((loc) => {
      const { latitude, longitude } = loc.coords;

      // ✅ avoid duplicate points
      if (
        lastCoords &&
        Math.abs(latitude - lastCoords.latitude) < 0.00005 &&
        Math.abs(longitude - lastCoords.longitude) < 0.00005
      ) {
        return;
      }

      lastCoords = { latitude, longitude };

      console.log("📍 TRACK", latitude, longitude);

      // 🔥 NEXT STEP (later)
      // save to local storage / send to backend here
    });
  }
});

export async function startTracking() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return;

  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);

  if (started) return; // ✅ prevent double start

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
  });

  console.log("✅ Tracking started");
}

export async function stopTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);

  if (!started) return;

  await Location.stopLocationUpdatesAsync(LOCATION_TASK);

  console.log("🛑 Tracking stopped");
}