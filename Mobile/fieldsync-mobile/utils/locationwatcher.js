import * as Location from "expo-location";
import { Alert } from "react-native";
import { isInsideGeofence } from "./geofence";

let activeLocationId = null;
let lastPromptTime = 0;

const PROMPT_COOLDOWN = 60 * 1000; // 60 seconds

export async function startLocationWatcher(locations, onCheckIn) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 20,
    },
    (loc) => {
      const now = Date.now();

      locations.forEach((location) => {
        const inside = isInsideGeofence(loc.coords, location);

        // ✅ ENTERING ZONE
        if (inside && activeLocationId !== location.id) {
          // prevent spam
          if (now - lastPromptTime < PROMPT_COOLDOWN) return;

          activeLocationId = location.id;
          lastPromptTime = now;

          Alert.alert(
            "You're at " + location.name,
            "Do you want to check in?",
            [
              { text: "Not now", style: "cancel" },
              {
                text: "Check In",
                onPress: () => {
                  onCheckIn(location);
                },
              },
            ]
          );
        }

        // ✅ LEAVING ZONE (reset)
        if (!inside && activeLocationId === location.id) {
          activeLocationId = null;
        }
      });
    }
  );

  return subscription;
}