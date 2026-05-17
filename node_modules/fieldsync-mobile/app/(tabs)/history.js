import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import { reportAPI } from "../../services/api";

export default function History() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (loading) return;
    console.log("History fetch started");
    
    try {
      const data = await reportAPI.getTimesheets();
      setShifts(data || []);
      console.log("History fetch completed");
    } catch (e) {
      console.error("History fetch error:", e.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    load();
  }, [load]);

  function calcHours(s) {
    if (!s.clock_in_time || !s.clock_out_time) return 0;
    return (
      (new Date(s.clock_out_time) - new Date(s.clock_in_time)) / 3600000 -
      (s.total_break_seconds || 0) / 3600
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0B1220]">
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView className="bg-[#0B1220] p-4">
      <Text className="text-white text-lg font-semibold mb-4">
        Work History
      </Text>

      {shifts.length === 0 ? (
        <View className="flex-1 items-center justify-center py-20">
          <Ionicons name="time-outline" size={48} color="#6b7280" />
          <Text className="text-gray-400 mt-4 text-center">
            No history available
          </Text>
          <Text className="text-gray-500 text-sm mt-2 text-center">
            Your completed shifts will appear here
          </Text>
        </View>
      ) : (
        shifts.map((s) => {
          const hours = calcHours(s);

          return (
            <View
              key={s.id}
              className="bg-[#111827] p-4 rounded-xl mb-3"
            >
              <Text className="text-white font-semibold">
                {moment(s.clock_in_time).format("ddd DD MMM")}
              </Text>

              <Text className="text-gray-400 text-sm">
                {moment(s.clock_in_time).format("HH:mm")} -{" "}
                {moment(s.clock_out_time).format("HH:mm")}
              </Text>

              <Text className="text-indigo-400 mt-2">
                {hours.toFixed(2)} hours
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}