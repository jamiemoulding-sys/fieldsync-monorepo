import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import moment from "moment";
import { reportAPI } from "../../services/api";

export default function History() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await reportAPI.getTimesheets();
      setShifts(data || []);
    } catch (e) {
      console.log("History error:", e);
    }
    setLoading(false);
  }

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

      {shifts.map((s) => {
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
      })}
    </ScrollView>
  );
}