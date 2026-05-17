import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../utils/supabase";
import API from "../../services/api";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUser = useCallback(async () => {
    console.log("=== PROFILE LOAD START ===");
    console.log("LOADING TRUE");
    
    try {
      console.log("API BASE URL:", API.defaults.baseURL);
      
      const token = await AsyncStorage.getItem('token');
      console.log("TOKEN:", token);
      
      if (!token) {
        console.error("No token found");
        setUser({});
        console.log("LOADING FALSE");
        return;
      }

      console.log("FETCHING URL:", "/api/auth/me");

      const response = await API.get('/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log("FULL RESPONSE:", JSON.stringify(response?.data, null, 2));
      console.log("PROFILE STATE BEFORE SET:", user);
      console.log("SETTING PROFILE NOW");
      setUser(response.data);
    } catch (error) {
      console.log("ERROR MESSAGE:", error.message);
      console.log("ERROR RESPONSE:", JSON.stringify(error.response?.data, null, 2));
      console.log("ERROR STATUS:", error.response?.status);
      console.log("ERROR REQUEST:", error.request);
      console.log("ERROR CONFIG:", error.config);
      // Set empty user object to prevent white screen
      setUser({});
    } finally {
      console.log("LOADING FALSE");
      setLoading(false);
      setRefreshing(false);
    }
    
    console.log("=== PROFILE LOAD END ===");
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
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
      <SafeAreaView className="flex-1 bg-[#0B1220]">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366f1" size="large" />
          <Text className="text-gray-400 mt-4">Loading profile...</Text>
        </View>
      </SafeAreaView>
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
    <SafeAreaView className="flex-1 bg-[#0B1220]">
      <ScrollView 
        className="bg-[#0B1220]"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
      >
        <View className="p-4 pt-12 pb-8">
        {/* Profile Header */}
        <View className="items-center mb-8">
          <View className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full items-center justify-center mb-4 shadow-lg">
            <Text className="text-white text-4xl font-bold">{initials}</Text>
          </View>
          <Text className="text-white text-2xl font-bold mb-1">
            {user?.name || "User Name"}
          </Text>
          <Text className="text-gray-400 text-base mb-1">
            {user?.role || "Employee"}
          </Text>
          {user?.company_name && (
            <Text className="text-indigo-400 text-sm">
              {user.company_name}
            </Text>
          )}
        </View>

        {/* Contact Information Card */}
        <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
          <View className="flex-row items-center mb-4">
            <Ionicons name="person-circle-outline" size={24} color="#6366f1" />
            <Text className="text-white text-lg font-semibold ml-3">
              Contact Information
            </Text>
          </View>
          <View className="space-y-4">
            <View>
              <Text className="text-gray-400 text-sm mb-1">Full Name</Text>
              <Text className="text-white font-medium text-base">
                {user?.name || "Not set"}
              </Text>
            </View>
            <View>
              <Text className="text-gray-400 text-sm mb-1">Email</Text>
              <Text className="text-white font-medium text-base">
                {user?.email || "Not set"}
              </Text>
            </View>
            {user?.phone && (
              <View>
                <Text className="text-gray-400 text-sm mb-1">Phone</Text>
                <Text className="text-white font-medium text-base">
                  {user.phone}
                </Text>
              </View>
            )}
            {user?.employee_id && (
              <View>
                <Text className="text-gray-400 text-sm mb-1">Employee ID</Text>
                <Text className="text-white font-medium text-base">
                  {user.employee_id}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Pay Information Card */}
        <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
          <View className="flex-row items-center mb-4">
            <Ionicons name="cash-outline" size={24} color="#6366f1" />
            <Text className="text-white text-lg font-semibold ml-3">
              Pay Information
            </Text>
          </View>
          <View className="space-y-4">
            {user?.hourly_rate && (
              <View>
                <Text className="text-gray-400 text-sm mb-1">Hourly Rate</Text>
                <Text className="text-white font-medium text-base">
                  £{Number(user.hourly_rate).toFixed(2)}/hr
                </Text>
              </View>
            )}
            {user?.overtime_rate && (
              <View>
                <Text className="text-gray-400 text-sm mb-1">Overtime Rate</Text>
                <Text className="text-white font-medium text-base">
                  £{Number(user.overtime_rate).toFixed(2)}/hr
                </Text>
              </View>
            )}
            {!user?.hourly_rate && !user?.overtime_rate && (
              <Text className="text-gray-500 text-sm">No pay information available</Text>
            )}
          </View>
        </View>

        {/* Holiday Information Card */}
        <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
          <View className="flex-row items-center mb-4">
            <Ionicons name="calendar-outline" size={24} color="#6366f1" />
            <Text className="text-white text-lg font-semibold ml-3">
              Holiday Information
            </Text>
          </View>
          <View className="space-y-4">
            {user?.holiday_allowance !== undefined && (
              <View>
                <Text className="text-gray-400 text-sm mb-1">Holiday Allowance</Text>
                <Text className="text-white font-medium text-base">
                  {user.holiday_allowance} days
                </Text>
              </View>
            )}
            {user?.holiday_remaining !== undefined && (
              <View>
                <Text className="text-gray-400 text-sm mb-1">Remaining Holiday</Text>
                <Text className="text-indigo-400 font-medium text-base">
                  {user.holiday_remaining} days
                </Text>
              </View>
            )}
            {user?.holiday_allowance !== undefined && user?.holiday_remaining !== undefined && (
              <View className="mt-2">
                <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ 
                      width: `${(user.holiday_remaining / user.holiday_allowance) * 100}%` 
                    }}
                  />
                </View>
                <Text className="text-gray-500 text-xs mt-1">
                  {Math.round((user.holiday_remaining / user.holiday_allowance) * 100)}% remaining
                </Text>
              </View>
            )}
            {!user?.holiday_allowance && !user?.holiday_remaining && (
              <Text className="text-gray-500 text-sm">No holiday information available</Text>
            )}
          </View>
        </View>

        {/* Account Information Card */}
        <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
          <View className="flex-row items-center mb-4">
            <Ionicons name="information-circle-outline" size={24} color="#6366f1" />
            <Text className="text-white text-lg font-semibold ml-3">
              Account Information
            </Text>
          </View>
          <View className="space-y-4">
            <View>
              <Text className="text-gray-400 text-sm mb-1">Role</Text>
              <Text className="text-white font-medium text-base capitalize">
                {user?.role || "Employee"}
              </Text>
            </View>
            {user?.company_id && (
              <View>
                <Text className="text-gray-400 text-sm mb-1">Company ID</Text>
                <Text className="text-white font-medium text-base">
                  {user.company_id}
                </Text>
              </View>
            )}
            {user?.created_at && (
              <View>
                <Text className="text-gray-400 text-sm mb-1">Member Since</Text>
                <Text className="text-white font-medium text-base">
                  {new Date(user.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Account Actions Card */}
        <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
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
              <Ionicons name="create-outline" size={20} color="#9ca3af" />
              <Text className="text-white font-medium ml-3">
                Edit Profile
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" className="ml-auto" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red-600 p-4 rounded-xl items-center shadow-lg mb-8"
        >
          <Text className="text-white font-semibold text-base">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}
