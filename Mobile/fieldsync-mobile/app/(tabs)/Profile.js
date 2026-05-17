import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getCurrentUser } from "../../utils/session";
import { supabase } from "../../utils/supabase";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (loading) return;
    console.log("Profile fetch started");
    
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      console.log("Profile fetch completed");
    } catch (error) {
      console.error("Profile fetch error:", error.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    loadUser();
  }, [loadUser]);

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

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <ScrollView className="bg-[#0B1220]">
      <View className="p-4 pt-12">
        {/* Profile Header */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full items-center justify-center mb-4 shadow-lg">
            <Text className="text-white text-3xl font-bold">{initials}</Text>
          </View>
          <Text className="text-white text-2xl font-bold">
            {user?.name || "User"}
          </Text>
          <Text className="text-gray-400 text-base">
            {user?.email || ""}
          </Text>
        </View>

        {/* Personal Information Card */}
        <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg">
          <View className="flex-row items-center mb-4">
            <Ionicons name="person-outline" size={24} color="#6366f1" />
            <Text className="text-white text-lg font-semibold ml-3">
              Personal Information
            </Text>
          </View>
          <View className="space-y-3">
            <View>
              <Text className="text-gray-400 text-sm mb-1">Full Name</Text>
              <Text className="text-white font-medium">
                {user?.name || "Not set"}
              </Text>
            </View>
            <View>
              <Text className="text-gray-400 text-sm mb-1">Email</Text>
              <Text className="text-white font-medium">
                {user?.email || "Not set"}
              </Text>
            </View>
          </View>
        </View>

        {/* Employment Information Card */}
        <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg">
          <View className="flex-row items-center mb-4">
            <Ionicons name="briefcase-outline" size={24} color="#6366f1" />
            <Text className="text-white text-lg font-semibold ml-3">
              Employment Information
            </Text>
          </View>
          <View className="space-y-3">
            <View>
              <Text className="text-gray-400 text-sm mb-1">Role</Text>
              <Text className="text-white font-medium capitalize">
                {user?.role || "Employee"}
              </Text>
            </View>
            <View>
              <Text className="text-gray-400 text-sm mb-1">Company ID</Text>
              <Text className="text-white font-medium">
                {user?.company_id || "Not set"}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Actions Card */}
        <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg">
          <View className="flex-row items-center mb-4">
            <Ionicons name="settings-outline" size={24} color="#6366f1" />
            <Text className="text-white text-lg font-semibold ml-3">
              Account Actions
            </Text>
          </View>
          <View className="space-y-3">
            <TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
              <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
              <Text className="text-white font-medium ml-3">
                Change Password
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" className="ml-auto" />
            </TouchableOpacity>
            <TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
              <Ionicons name="exit-outline" size={20} color="#9ca3af" />
              <Text className="text-white font-medium ml-3">
                Leave Company
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" className="ml-auto" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red-600 p-4 rounded-xl items-center shadow-lg"
        >
          <Text className="text-white font-semibold text-base">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
