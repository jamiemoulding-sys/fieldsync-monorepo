import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
          <Text style={styles.loadingTitle}>Loading profile</Text>
          <Text style={styles.loadingText}>Checking your secure session...</Text>
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
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
      >
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={2}>
                {formatText(user?.name)}
              </Text>
              <View style={styles.rolePill}>
                <Ionicons name="briefcase-outline" size={14} color="#a5b4fc" />
                <Text style={styles.roleText} numberOfLines={1}>
                  {formatText(user?.role)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.companyRow}>
            <Ionicons name="business-outline" size={18} color="#94a3b8" />
            <Text style={styles.companyText} numberOfLines={1}>
              {formatText(user?.company_name)}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={28} color="#fecaca" />
            </View>
            <View style={styles.errorBody}>
              <Text style={styles.errorTitle}>Profile unavailable</Text>
              <Text style={styles.errorText}>{error}</Text>
              <View style={styles.errorActions}>
                <TouchableOpacity style={styles.retryButton} onPress={loadUser}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.errorClearButton}
                  onPress={clearAuthCache}
                  disabled={clearingCache}
                >
                  <Text style={styles.errorClearText}>
                    {clearingCache ? "Clearing..." : "Clear cache"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        <SectionCard title="Contact" icon="person-circle-outline">
          <InfoRow icon="mail-outline" label="Email" value={formatText(user?.email)} />
          <InfoRow icon="call-outline" label="Phone" value={formatText(user?.phone)} />
        </SectionCard>

        <SectionCard title="Pay" icon="cash-outline">
          <View style={styles.metricGrid}>
            <MetricCard
              label="Hourly Rate"
              value={formatRate(user?.hourly_rate)}
              icon="time-outline"
            />
            <MetricCard
              label="Overtime Rate"
              value={formatRate(user?.overtime_rate)}
              icon="trending-up-outline"
            />
          </View>
        </SectionCard>

        <SectionCard title="Holiday" icon="calendar-outline">
          <View style={styles.metricGrid}>
            <MetricCard
              label="Allowance"
              value={formatDays(user?.holiday_allowance)}
              icon="calendar-number-outline"
            />
            <MetricCard
              label="Remaining"
              value={formatDays(user?.holiday_remaining)}
              icon="sparkles-outline"
              accent
            />
          </View>
          {holidayAllowance > 0 ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Holiday balance</Text>
                <Text style={styles.progressValue}>{Math.round(holidayPercent)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${holidayPercent}%` }]} />
              </View>
            </View>
          ) : null}
        </SectionCard>

        <SectionCard title="Account" icon="settings-outline">
          <ActionRow
            icon="lock-closed-outline"
            title="Change Password"
            subtitle="Manage your sign-in credentials"
          />
          <ActionRow
            icon="trash-outline"
            title={clearingCache ? "Clearing Auth Cache..." : "Clear Auth Cache"}
            subtitle="Remove stale local session data"
            iconColor="#f87171"
            onPress={clearAuthCache}
            disabled={clearingCache}
          />
          <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#a5b4fc" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#94a3b8" />
      </View>
      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MetricCard({ label, value, icon, accent = false }) {
  return (
    <View style={[styles.metricCard, accent && styles.metricCardAccent]}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={18} color={accent ? "#c4b5fd" : "#94a3b8"} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionRow({ icon, title, subtitle, onPress, disabled, iconColor = "#94a3b8" }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#64748b" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },

  scroll: {
    flex: 1,
    backgroundColor: "#020617",
  },

  content: {
    flexGrow: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#020617",
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    marginBottom: 20,
  },

  loadingTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },

  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },

  headerCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    borderWidth: 1,
    borderColor: "#818cf8",
    marginRight: 16,
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },

  headerText: {
    flex: 1,
    minWidth: 0,
  },

  name: {
    color: "#ffffff",
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
  },

  rolePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1b4b",
    borderWidth: 1,
    borderColor: "#3730a3",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    maxWidth: "100%",
  },

  roleText: {
    color: "#c7d2fe",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
    textTransform: "capitalize",
  },

  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  companyText: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 10,
    flex: 1,
  },

  card: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 18,
    marginBottom: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#273449",
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 12,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 10,
  },

  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    marginRight: 12,
  },

  infoBody: {
    flex: 1,
    minWidth: 0,
  },

  infoLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  infoValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 3,
  },

  metricGrid: {
    flexDirection: "row",
    gap: 12,
  },

  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  metricCardAccent: {
    borderColor: "#3730a3",
    backgroundColor: "#15173a",
  },

  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    marginBottom: 12,
  },

  metricLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },

  metricValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 5,
  },

  metricValueAccent: {
    color: "#c4b5fd",
  },

  progressBlock: {
    marginTop: 16,
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  progressLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },

  progressValue: {
    color: "#a5b4fc",
    fontSize: 13,
    fontWeight: "900",
  },

  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: "#020617",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#6366f1",
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 10,
  },

  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    marginRight: 12,
  },

  actionBody: {
    flex: 1,
    minWidth: 0,
  },

  actionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  actionSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 3,
  },

  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },

  signOutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 8,
  },

  disabled: {
    opacity: 0.6,
  },

  errorCard: {
    flexDirection: "row",
    backgroundColor: "#3f1018",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    padding: 16,
    marginBottom: 16,
  },

  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7f1d1d",
    marginRight: 12,
  },

  errorBody: {
    flex: 1,
    minWidth: 0,
  },

  errorTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  errorText: {
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  errorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  retryButton: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  retryText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  errorClearButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },

  errorClearText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
