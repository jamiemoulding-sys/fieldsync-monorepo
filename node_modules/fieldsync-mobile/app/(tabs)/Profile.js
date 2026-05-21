import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { getCurrentUser } from "../../utils/session";
import { removeToken, setToken } from "../../utils/auth";
import { supabase } from "../../utils/supabase";

const coalesce = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const formatText = (value) => {
  const normalized = coalesce(value);
  return normalized === undefined ? "Not set" : String(normalized);
};

const formatRate = (value) => {
  const normalized = coalesce(value);
  if (normalized === undefined) return "Not set";

  const amount = Number(normalized);
  if (Number.isNaN(amount)) return "Not set";

  return `\u00a3${amount.toFixed(2)}/hr`;
};

const formatDays = (value) => {
  const normalized = coalesce(value);
  if (normalized === undefined) return "Not set";

  const amount = Number(normalized);
  if (Number.isNaN(amount)) return "Not set";

  return `${amount} days`;
};

const getApprovedDays = (rows = []) =>
  rows.reduce((sum, row) => {
    if (row.days !== undefined && row.days !== null) {
      return sum + Number(row.days || 0);
    }

    if (row.start_date && row.end_date) {
      const start = new Date(row.start_date);
      const end = new Date(row.end_date);
      const diff = Math.floor((end - start) / 86400000) + 1;
      return sum + Math.max(diff, 0);
    }

    return sum;
  }, 0);

async function loadHolidayRemaining(userId, allowance) {
  if (!userId || allowance === undefined) return undefined;

  const request = (table) =>
    supabase
      .from(table)
      .select("days,status,start_date,end_date")
      .eq("user_id", userId)
      .eq("status", "approved");

  const primary = await request("holidays");
  const result = primary.error ? await request("holiday_requests") : primary;

  if (result.error) return undefined;

  return Math.max(Number(allowance || 0) - getApprovedDays(result.data), 0);
}

function normalizeProfile(authUser, row, calculatedHolidayRemaining) {
  const metadata = authUser?.user_metadata || {};
  const appMetadata = authUser?.app_metadata || {};
  const holidayAllowance = coalesce(
    row?.holiday_allowance,
    metadata.holiday_allowance,
    appMetadata.holiday_allowance
  );

  return {
    id: coalesce(row?.id, authUser?.id),
    name: coalesce(row?.name, metadata.name, metadata.full_name),
    email: coalesce(row?.email, authUser?.email, metadata.email),
    phone: coalesce(row?.phone, metadata.phone),
    role: coalesce(row?.role, metadata.role, appMetadata.role, "employee"),
    company_id: coalesce(row?.company_id, metadata.company_id, appMetadata.company_id),
    company_name: coalesce(row?.company_name, metadata.company_name),
    employee_id: coalesce(row?.employee_id, metadata.employee_id),
    hourly_rate: coalesce(row?.hourly_rate, metadata.hourly_rate),
    overtime_rate: coalesce(row?.overtime_rate, metadata.overtime_rate),
    holiday_allowance: holidayAllowance,
    holiday_remaining: coalesce(
      row?.holiday_remaining,
      row?.remaining_holiday,
      row?.holiday_balance,
      metadata.holiday_remaining,
      calculatedHolidayRemaining
    ),
    created_at: coalesce(row?.created_at, authUser?.created_at),
  };
}

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [clearingCache, setClearingCache] = useState(false);

  const clearAuthCache = useCallback(async () => {
    try {
      setClearingCache(true);
      await removeToken();
      await supabase.auth.signOut({ scope: "local" });
      setUser(null);
      setError("Auth cache cleared. Please sign in again.");
      Alert.alert("Auth cache cleared", "Please sign in again.");
      router.replace("/login");
    } finally {
      setClearingCache(false);
    }
  }, [router]);

  const loadUser = useCallback(async () => {
    try {
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        setUser(null);
        setError("No active session. Please sign in again.");
        return;
      }

      await setToken(token);

      const [authResponse, profileRow] = await Promise.all([
        API.get("/auth/me"),
        getCurrentUser(),
      ]);

      const authUser = authResponse.data?.user || authResponse.data;
      const holidayAllowance = coalesce(
        profileRow?.holiday_allowance,
        authUser?.user_metadata?.holiday_allowance
      );
      const holidayRemaining = await loadHolidayRemaining(
        profileRow?.id || authUser?.id,
        holidayAllowance
      );

      setUser(normalizeProfile(authUser, profileRow, holidayRemaining));
    } catch (loadError) {
      if (loadError.response?.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError("Profile could not be loaded. Pull to refresh or try again.");
      }

      setUser(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUser();
  }, [loadUser]);

  async function handleLogout() {
    await removeToken();
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login");
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

  const holidayAllowance = Number(user?.holiday_allowance || 0);
  const holidayRemaining = Number(user?.holiday_remaining || 0);
  const holidayPercent = holidayAllowance
    ? Math.max(Math.min((holidayRemaining / holidayAllowance) * 100, 100), 0)
    : 0;

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
          <View className="items-center mb-8">
            <View className="w-28 h-28 bg-indigo-600 rounded-full items-center justify-center mb-4 shadow-lg">
              <Text className="text-white text-4xl font-bold">{initials}</Text>
            </View>
            <Text className="text-white text-2xl font-bold mb-1">
              {formatText(user?.name)}
            </Text>
            <Text className="text-gray-400 text-base mb-1">
              {formatText(user?.role)}
            </Text>
            {user?.company_name && (
              <Text className="text-indigo-400 text-sm">
                {user.company_name}
              </Text>
            )}
          </View>

          {error ? (
            <View className="bg-red-950/40 rounded-2xl p-5 mb-4 border border-red-900">
              <View className="flex-row items-center mb-3">
                <Ionicons name="alert-circle-outline" size={24} color="#f87171" />
                <Text className="text-red-200 text-lg font-semibold ml-3">
                  Profile unavailable
                </Text>
              </View>
              <Text className="text-red-100 mb-4">{error}</Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={loadUser}
                  className="bg-red-600 px-4 py-3 rounded-xl"
                >
                  <Text className="text-white font-semibold">Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={clearAuthCache}
                  disabled={clearingCache}
                  className="bg-gray-800 px-4 py-3 rounded-xl"
                >
                  <Text className="text-white font-semibold">
                    {clearingCache ? "Clearing..." : "Clear Auth Cache"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
            <View className="flex-row items-center mb-4">
              <Ionicons name="person-circle-outline" size={24} color="#6366f1" />
              <Text className="text-white text-lg font-semibold ml-3">
                Contact Information
              </Text>
            </View>
            <View className="space-y-4">
              <ProfileField label="Full Name" value={formatText(user?.name)} />
              <ProfileField label="Email" value={formatText(user?.email)} />
              <ProfileField label="Phone" value={formatText(user?.phone)} />
              {user?.employee_id && (
                <ProfileField label="Employee ID" value={formatText(user.employee_id)} />
              )}
            </View>
          </View>

          <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
            <View className="flex-row items-center mb-4">
              <Ionicons name="cash-outline" size={24} color="#6366f1" />
              <Text className="text-white text-lg font-semibold ml-3">
                Pay Information
              </Text>
            </View>
            <View className="space-y-4">
              <ProfileField label="Hourly Rate" value={formatRate(user?.hourly_rate)} />
              <ProfileField label="Overtime Rate" value={formatRate(user?.overtime_rate)} />
            </View>
          </View>

          <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
            <View className="flex-row items-center mb-4">
              <Ionicons name="calendar-outline" size={24} color="#6366f1" />
              <Text className="text-white text-lg font-semibold ml-3">
                Holiday Information
              </Text>
            </View>
            <View className="space-y-4">
              <ProfileField
                label="Holiday Allowance"
                value={formatDays(user?.holiday_allowance)}
              />
              <ProfileField
                label="Remaining Holiday"
                value={formatDays(user?.holiday_remaining)}
                valueClassName="text-indigo-400 font-medium text-base"
              />
              {holidayAllowance > 0 && (
                <View className="mt-2">
                  <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${holidayPercent}%` }}
                    />
                  </View>
                  <Text className="text-gray-500 text-xs mt-1">
                    {Math.round(holidayPercent)}% remaining
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View className="bg-[#111827] rounded-2xl p-5 mb-4 shadow-lg border border-gray-800">
            <View className="flex-row items-center mb-4">
              <Ionicons name="information-circle-outline" size={24} color="#6366f1" />
              <Text className="text-white text-lg font-semibold ml-3">
                Account Information
              </Text>
            </View>
            <View className="space-y-4">
              <ProfileField label="Role" value={formatText(user?.role)} />
              {user?.company_id && (
                <ProfileField label="Company ID" value={formatText(user.company_id)} />
              )}
              {user?.created_at && (
                <ProfileField
                  label="Member Since"
                  value={new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                />
              )}
            </View>
          </View>

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
                <Text className="text-white font-medium ml-3 flex-1">
                  Change Password
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>
              <TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                <Ionicons name="create-outline" size={20} color="#9ca3af" />
                <Text className="text-white font-medium ml-3 flex-1">
                  Edit Profile
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearAuthCache}
                disabled={clearingCache}
                className="bg-gray-800 p-4 rounded-xl flex-row items-center"
              >
                <Ionicons name="trash-outline" size={20} color="#f87171" />
                <Text className="text-white font-medium ml-3 flex-1">
                  {clearingCache ? "Clearing Auth Cache..." : "Clear Auth Cache"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

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

function ProfileField({ label, value, valueClassName = "text-white font-medium text-base" }) {
  return (
    <View>
      <Text className="text-gray-400 text-sm mb-1">{label}</Text>
      <Text className={valueClassName}>{value}</Text>
    </View>
  );
}
