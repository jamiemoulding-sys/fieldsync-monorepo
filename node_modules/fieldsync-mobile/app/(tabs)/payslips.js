import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { reportAPI } from "../../services/api";

export default function Payslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await reportAPI.getPayslips();
      setPayslips(data || []);
    } catch (e) {
      console.log("Payslip error:", e);
    }
    setLoading(false);
  }

  function openPDF(url) {
    if (!url) return;
    Linking.openURL(url);
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
        Payslips
      </Text>

      {payslips.map((p) => (
        <View
          key={p.id}
          className="bg-[#111827] p-4 rounded-xl mb-3"
        >
          <Text className="text-white font-semibold">
            {p.period || "Payslip"}
          </Text>

          <Text className="text-gray-400 text-sm">
            £{Number(p.net || 0).toFixed(2)}
          </Text>

          <View className="flex-row gap-2 mt-3">

            <TouchableOpacity
              onPress={() => openPDF(p.url)}
              className="bg-indigo-600 px-3 py-1 rounded"
            >
              <Text className="text-white text-xs">
                View
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openPDF(p.url)}
              className="bg-gray-700 px-3 py-1 rounded"
            >
              <Text className="text-white text-xs">
                Download
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      ))}
    </ScrollView>
  );
}