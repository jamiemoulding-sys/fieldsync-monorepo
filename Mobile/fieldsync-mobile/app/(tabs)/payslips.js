import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { reportAPI } from "../../services/api";

export default function Payslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (loading) return;
    console.log("Payslips fetch started");
    
    try {
      const data = await reportAPI.getPayslips();
      setPayslips(data || []);
      console.log("Payslips fetch completed");
    } catch (e) {
      console.error("Payslips fetch error:", e.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    load();
  }, [load]);

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

      {payslips.length === 0 ? (
        <View className="flex-1 items-center justify-center py-20">
          <Ionicons name="document-text-outline" size={48} color="#6b7280" />
          <Text className="text-gray-400 mt-4 text-center">
            No payslips found
          </Text>
          <Text className="text-gray-500 text-sm mt-2 text-center">
            Your payslips will appear here when available
          </Text>
        </View>
      ) : (
        payslips.map((p) => (
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
        ))
      )}
    </ScrollView>
  );
}