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
import { useEffect, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { getDistance } from "../../utils/geofence";
import { getTodayShift } from "../../utils/schedule";

export default function ClockIn() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [shift, setShift] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const loadShift = useCallback(async () => {
    try {
      const data = await getTodayShift();
      setShift(data || null);
    } catch (err) {
      console.log("LOAD SHIFT ERROR:", err);
    }
  }, []);

  useEffect(() => {
    loadShift();
  }, [loadShift]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  function formatTime(date) {
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatDate(date) {
    return date.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header with Clock */}
      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(currentTime)}</Text>
        <Text style={styles.clock}>{formatTime(currentTime)}</Text>
      </View>

      {/* =========================
         📋 TODAY'S SHIFT
      ========================= */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar-outline" size={24} color="#6366f1" />
          <Text style={styles.cardTitle}>Today's Shift</Text>
        </View>
        
        {shift ? (
          <>
            <Text style={styles.job}>
              {shift.job_name || "Scheduled Shift"}
            </Text>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#9ca3af" />
              <Text style={styles.infoText}>
                {shift.location?.name || "Unknown Location"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color="#9ca3af" />
              <Text style={styles.infoText}>
                {shift.start_time
                  ? new Date(shift.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                  : "--"}{" "}
                -{" "}
                {shift.end_time
                  ? new Date(shift.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                  : "--"}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyText}>No assigned shift today</Text>
          </View>
        )}
      </View>

      {/* =========================
         🧾 TASKS
      ========================= */}
      {shift?.tasks?.length > 0 && (
        <View style={styles.tasks}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>Tasks</Text>
          </View>

          {shift.tasks.map((task) => (
            <View key={task.id} style={styles.taskItem}>
              <View style={styles.taskBullet} />
              <Text style={styles.taskText}>{task.title}</Text>
            </View>
          ))}
        </View>
      )}

      {/* =========================
         🔵 SITE SHIFT BUTTON
      ========================= */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          (!shift || !shift.location) && styles.disabledButton,
        ]}
        onPress={handleClockIn}
        disabled={!shift || !shift.location || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="location-outline" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>Clock In to Site</Text>
          </>
        )}
      </TouchableOpacity>

      {/* =========================
         🟣 OPEN SHIFT BUTTON
      ========================= */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleOpenShift}
        disabled={loading}
      >
        <Ionicons name="time-outline" size={24} color="#6366f1" />
        <View style={styles.secondaryButtonContent}>
          <Text style={styles.secondaryButtonTitle}>Open Shift</Text>
          <Text style={styles.secondaryButtonSub}>
            Travel / flexible work
          </Text>
        </View>
      </TouchableOpacity>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: shift ? "#10b981" : "#f59e0b" }]} />
          <Text style={styles.statusText}>
            {shift ? "Shift Assigned" : "No Shift Today"}
          </Text>
        </View>
        <Text style={styles.statusSub}>
          {shift && shift.location 
            ? "Ready to clock in" 
            : "Use open shift for flexible work"}
        </Text>
      </View>
    </ScrollView>
  );
}

/* =========================
   🎨 STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
  },

  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },

  date: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },

  clock: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: 2,
  },

  card: {
    backgroundColor: "#111827",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 12,
  },

  job: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  infoText: {
    color: "#9ca3af",
    fontSize: 15,
    marginLeft: 12,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
  },

  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 12,
  },

  tasks: {
    backgroundColor: "#111827",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },

  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0B1220",
    borderRadius: 12,
    marginBottom: 8,
  },

  taskBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366f1",
    marginRight: 12,
  },

  taskText: {
    color: "#e5e7eb",
    fontSize: 15,
    flex: 1,
  },

  primaryButton: {
    backgroundColor: "#6366f1",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.5,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 12,
  },

  secondaryButton: {
    backgroundColor: "#111827",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6366f1",
  },

  secondaryButtonContent: {
    marginLeft: 12,
    flex: 1,
  },

  secondaryButtonTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  secondaryButtonSub: {
    color: "#6366f1",
    fontSize: 13,
    marginTop: 4,
  },

  statusCard: {
    backgroundColor: "#111827",
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },

  statusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  statusSub: {
    color: "#6b7280",
    fontSize: 14,
    marginLeft: 22,
  },
});