import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import moment from "moment";
import { reportAPI } from "../../services/api";

export default function History() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ refreshing: isRefreshing = false } = {}) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const data = await reportAPI.getTimesheets();
      setShifts(data || []);
    } catch (err) {
      setError(err.message || "Could not load work history.");
      setShifts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function calcHours(shift) {
    if (!shift.clock_in_time || !shift.clock_out_time) return 0;
    return (
      (new Date(shift.clock_out_time) - new Date(shift.clock_in_time)) / 3600000 -
      (shift.total_break_seconds || 0) / 3600
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load({ refreshing: true })}
          tintColor="#6366f1"
          colors={["#6366f1"]}
        />
      }
    >
      <Text style={styles.title}>Work History</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {shifts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>No history available</Text>
          <Text style={styles.emptyText}>Your completed shifts will appear here</Text>
        </View>
      ) : (
        shifts.map((shift) => {
          const hours = calcHours(shift);

          return (
            <View key={shift.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {moment(shift.clock_in_time).format("ddd DD MMM")}
              </Text>

              <Text style={styles.cardMeta}>
                {moment(shift.clock_in_time).format("HH:mm")} -{" "}
                {moment(shift.clock_out_time).format("HH:mm")}
              </Text>

              <Text style={styles.hoursText}>{hours.toFixed(2)} hours</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B1220",
  },
  screen: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: "#3f1018",
    borderColor: "#7f1d1d",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    color: "#9ca3af",
    marginTop: 16,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
  },
  card: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardTitle: {
    color: "#ffffff",
    fontWeight: "700",
  },
  cardMeta: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  hoursText: {
    color: "#818cf8",
    marginTop: 8,
    fontWeight: "700",
  },
});
