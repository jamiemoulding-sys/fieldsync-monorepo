import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { getDistance } from "../../utils/geofence";
import { getTodayShift } from "../../utils/schedule";

export default function ClockIn() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [shift, setShift] = useState(null);

  useEffect(() => {
    loadShift();
  }, []);

  async function loadShift() {
    try {
      const data = await getTodayShift();
      setShift(data || null);
    } catch (err) {
      console.log("LOAD SHIFT ERROR:", err);
    }
  }

  /* =========================
     🔵 SITE SHIFT CLOCK-IN
  ========================= */
  async function handleClockIn() {
    if (!shift || !shift.location) {
      Alert.alert("No shift", "You have no assigned site today");
      return;
    }

    try {
      setLoading(true);

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission required", "Location is needed");
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      const location = shift.location;

      if (!location?.latitude || !location?.longitude || !location?.radius) {
        Alert.alert("Error", "Location data incomplete");
        return;
      }

      const distance = getDistance(
        current.coords.latitude,
        current.coords.longitude,
        location.latitude,
        location.longitude
      );

      if (distance > location.radius) {
        const diff = Math.round(distance - location.radius);

        Alert.alert(
          "Outside Area",
          `You're ${diff}m outside ${location.name}`
        );
        return;
      }

      // ✅ SUCCESS
      router.replace({
        pathname: "/(tabs)/dashboard",
        params: {
          checkedIn: "true",
          locationId: location.id.toString(),
          locationName: location.name,
        },
      });

    } catch (err) {
      console.log("CLOCK IN ERROR:", err);
      Alert.alert("Error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     🟣 OPEN SHIFT
  ========================= */
  function handleOpenShift() {
    Alert.alert(
      "Start Open Shift?",
      "Use this for travel or flexible work",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          onPress: () => {
            router.replace({
              pathname: "/(tabs)/dashboard",
              params: {
                checkedIn: "true",
                openShift: "true",
              },
            });
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Clock In</Text>

      {/* =========================
         📋 TODAY’S SHIFT
      ========================= */}
      <View style={styles.card}>
        {shift ? (
          <>
            <Text style={styles.job}>
              {shift.job_name || "Scheduled Shift"}
            </Text>

            <Text style={styles.meta}>
              📍 {shift.location?.name || "Unknown"}
            </Text>

            <Text style={styles.meta}>
              {shift.start_time
                ? new Date(shift.start_time).toLocaleTimeString()
                : "--"}{" "}
              -{" "}
              {shift.end_time
                ? new Date(shift.end_time).toLocaleTimeString()
                : "--"}
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>No assigned shift today</Text>
        )}
      </View>

      {/* =========================
         🧾 TASKS
      ========================= */}
      {shift?.tasks?.length > 0 && (
        <View style={styles.tasks}>
          <Text style={styles.sectionTitle}>Tasks</Text>

          {shift.tasks.map((task) => (
            <View key={task.id} style={styles.taskItem}>
              <Text style={styles.taskText}>• {task.title}</Text>
            </View>
          ))}
        </View>
      )}

      {/* =========================
         🔵 SITE SHIFT BUTTON
      ========================= */}
      <TouchableOpacity
        style={[
          styles.button,
          (!shift || !shift.location) && styles.disabledButton,
        ]}
        onPress={handleClockIn}
        disabled={!shift || !shift.location || loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Checking..." : "Clock In to Site"}
        </Text>
      </TouchableOpacity>

      {/* =========================
         🟣 OPEN SHIFT BUTTON
      ========================= */}
      <TouchableOpacity
        style={styles.openShift}
        onPress={handleOpenShift}
        disabled={loading}
      >
        <Text style={styles.openTitle}>Open Shift</Text>
        <Text style={styles.openSub}>
          Travel / flexible work
        </Text>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#6366f1"
          style={{ marginTop: 20 }}
        />
      )}
    </ScrollView>
  );
}

/* =========================
   🎨 STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
    paddingTop: 70,
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 25,
  },

  card: {
    backgroundColor: "#0f172a",
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  job: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  meta: {
    color: "#64748b",
    marginTop: 6,
  },

  sectionTitle: {
    color: "#6366f1",
    marginBottom: 10,
    fontWeight: "700",
  },

  tasks: {
    marginBottom: 20,
  },

  taskItem: {
    backgroundColor: "#020617",
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },

  taskText: {
    color: "#e5e7eb",
  },

  button: {
    backgroundColor: "#6366f1",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },

  disabledButton: {
    opacity: 0.4,
  },

  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },

  openShift: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6366f1",
  },

  openTitle: {
    color: "#fff",
    fontWeight: "700",
  },

  openSub: {
    color: "#6366f1",
    marginTop: 4,
  },
});