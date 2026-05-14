import { View, Text, StyleSheet, FlatList } from "react-native";
import { useEffect, useState } from "react";
import { getShifts } from "../../utils/shiftsStorage";

export default function Shifts() {
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await getShifts();
    setShifts(data);
  }

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shifts</Text>

      <Text style={styles.total}>Total: {totalHours()}</Text>

      <FlatList
        data={shifts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.location}>
              {item.locations?.name || "Unknown"}
            </Text>

            <Text style={styles.time}>
              {new Date(item.clock_in_time).toLocaleString()}
            </Text>

            <Text style={styles.duration}>
              {formatDuration(
                item.clock_in_time,
                item.clock_out_time
              )}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
    paddingTop: 80,
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 10,
  },

  total: {
    color: "#6366f1",
    marginBottom: 20,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#0f172a",
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  location: {
    color: "#fff",
    fontWeight: "700",
  },

  time: {
    color: "#64748b",
    marginTop: 4,
  },

  duration: {
    color: "#4ade80",
    marginTop: 6,
    fontWeight: "600",
  },
});