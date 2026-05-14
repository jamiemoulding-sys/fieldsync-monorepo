import * as TaskManager from 'expo-task-manager';

export const LOCATION_TASK = "background-location-task";

TaskManager.defineTask(LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.log("Task error:", error);
    return;
  }

  if (data) {
    const { locations } = data;

    locations.forEach((loc) => {
      console.log("📍 BG", loc.coords.latitude, loc.coords.longitude);

      // 🔥 NEXT: send to API here later
    });
  }
});