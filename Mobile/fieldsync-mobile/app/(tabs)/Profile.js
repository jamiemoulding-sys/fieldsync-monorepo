import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getCurrentUser } from "../../utils/session";
import { supabase } from "../../utils/supabase";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.log("Error loading user:", error);
    }
    setLoading(false);
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (error) {
      console.log("Logout error:", error);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0B1220]">
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView className="bg-[#0B1220]">
      <View className="p-4 pt-12">
        <Text className="text-white text-2xl font-bold mb-6">Profile</Text>

        <View className="bg-[#111827] p-6 rounded-xl mb-4">
          <View className="items-center mb-4">
            <View className="w-20 h-20 bg-indigo-600 rounded-full items-center justify-center mb-3">
              <Ionicons name="person" size={40} color="#fff" />
            </View>
            <Text className="text-white text-lg font-semibold">
              {user?.name || "User"}
            </Text>
            <Text className="text-gray-400 text-sm">
              {user?.email || ""}
            </Text>
          </View>

          <View className="border-t border-gray-700 pt-4">
            <Text className="text-gray-400 text-sm mb-1">Role</Text>
            <Text className="text-white font-medium capitalize">
              {user?.role || "Employee"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red-600 p-4 rounded-xl items-center"
        >
          <Text className="text-white font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
