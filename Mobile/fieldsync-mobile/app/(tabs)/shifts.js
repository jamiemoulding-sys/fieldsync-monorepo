import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { getShifts } from "../../utils/shifts";

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (loading) return;
    console.log("Shifts fetch started");
    
    try {
      const data = await getShifts();
      setShifts(data);
      console.log("Shifts fetch completed");
    } catch (err) {
      console.error("Shifts fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    load();
  }, [load]);

  function formatDuration(start, end) {
    if (!end) return "In progress";

    const diff = (new Date(end) - new Date(start)) / 1000;
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);

    return `${hrs}h ${mins}m`;
  }

  function totalHours() {
    let total = 0;

    shifts.forEach((s) => {
      if (s.clock_out_time) {
        total +=
          (new Date(s.clock_out_time) - new Date(s.clock_in_time)) /
          1000;
      }
    });

    const hrs = Math.floor(total / 3600);
    return `${hrs}h`;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  }

  function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  function getStatus(item) {
    if (!item.clock_out_time) return { text: "In Progress", color: "#f59e0b" };
    return { text: "Completed", color: "#10b981" };
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading shifts...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shifts</Text>
        <TouchableOpacity onPress={load} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Hours</Text>
        <Text style={styles.totalValue}>{totalHours()}</Text>
      </View>

      {shifts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color="#6b7280" />
          <Text style={styles.emptyTitle}>No shifts yet</Text>
          <Text style={styles.emptySubtitle}>
            Your completed shifts will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const status = getStatus(item);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.locationContainer}>
                    <Ionicons name="location-outline" size={20} color="#6366f1" />
                    <Text style={styles.location}>
                      {item.locations?.name || "Unknown Location"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.color + "20" }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>
                      {status.text}
                    </Text>
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
                  <Text style={styles.dateText}>{formatDate(item.clock_in_time)}</Text>
                </View>

                <View style={styles.timeRow}>
                  <View style={styles.timeItem}>
                    <Ionicons name="time-outline" size={16} color="#9ca3af" />
                    <Text style={styles.timeLabel}>Start</Text>
                    <Text style={styles.timeValue}>{formatTime(item.clock_in_time)}</Text>
                  </View>
                  {item.clock_out_time && (
                    <View style={styles.timeItem}>
                      <Ionicons name="time-outline" size={16} color="#9ca3af" />
                      <Text style={styles.timeLabel}>End</Text>
                      <Text style={styles.timeValue}>{formatTime(item.clock_out_time)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.durationRow}>
                  <Ionicons name="hourglass-outline" size={16} color="#6366f1" />
                  <Text style={styles.durationLabel}>Duration</Text>
                  <Text style={styles.durationValue}>
                    {formatDuration(item.clock_in_time, item.clock_out_time)}
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#6b7280",
    fontSize: 16,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },

  refreshButton: {
    padding: 8,
  },

  totalCard: {
    backgroundColor: "#111827",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  totalLabel: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },

  totalValue: {
    color: "#6366f1",
    fontSize: 24,
    fontWeight: "700",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },

  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
  },

  emptySubtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  card: {
    backgroundColor: "#111827",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  location: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  dateText: {
    color: "#9ca3af",
    fontSize: 14,
    marginLeft: 8,
  },

  timeRow: {
    flexDirection: "row",
    marginBottom: 12,
  },

  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },

  timeLabel: {
    color: "#6b7280",
    fontSize: 12,
    marginLeft: 8,
    marginRight: 4,
  },

  timeValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },

  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },

  durationLabel: {
    color: "#6b7280",
    fontSize: 12,
    marginLeft: 8,
    marginRight: 4,
  },

  durationValue: {
    color: "#6366f1",
    fontSize: 16,
    fontWeight: "600",
  },
});