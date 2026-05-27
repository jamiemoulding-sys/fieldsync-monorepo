import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SignInRequired from "../../components/SignInRequired";
import { dashboardAPI } from "../../services/api";
import { getActiveSessionToken, isAuthError } from "../../utils/authSession";

const coalesce = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const getShiftStart = (shift) => shift?.clock_in_time || shift?.start_time || shift?.date;
const getShiftEnd = (shift) => shift?.clock_out_time || shift?.end_time || shift?.finish_time;

const getLocationName = (shift) =>
  shift?.location?.name ||
  shift?.locations?.name ||
  shift?.location_name ||
  "Location TBC";

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const formatShortDate = (value) => {
  if (!value) return "--";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

const formatTime = (value) => {
  if (!value) return "--:--";

  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatSeconds = (seconds) => {
  const safeSeconds = Math.max(Number(seconds) || 0, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.round((safeSeconds % 3600) / 60);

  if (!hours && !minutes) return "0h";
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const getShiftSeconds = (shift) => {
  const start = getShiftStart(shift);
  const end = getShiftEnd(shift);
  if (!start || !end) return 0;

  const diff = new Date(end) - new Date(start);
  if (Number.isNaN(diff) || diff <= 0) return 0;

  return diff / 1000;
};

export default function Dashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [todayShift, setTodayShift] = useState(null);
  const [weekSchedule, setWeekSchedule] = useState([]);
  const [weekShifts, setWeekShifts] = useState([]);
  const [clockState, setClockState] = useState({ activeShift: null, onBreak: false });
  const [holidaySummary, setHolidaySummary] = useState({ allowance: 0, remaining: 0 });
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [noSession, setNoSession] = useState(false);

  const loadDashboard = useCallback(async ({ refreshing: isRefreshing = false } = {}) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setNoSession(false);

      const token = await getActiveSessionToken();
      if (!token) {
        setProfile(null);
        setTodayShift(null);
        setWeekSchedule([]);
        setWeekShifts([]);
        setClockState({ activeShift: null, onBreak: false });
        setNoSession(true);
        return;
      }

      const data = await dashboardAPI.getMobile();
      const user = data?.profile;

      if (!user) {
        setProfile(null);
        setNoSession(true);
        return;
      }

      setProfile(user);
      setTodayShift(data.today_shift || null);
      setWeekSchedule(data.week_schedule || []);
      setWeekShifts(data.week_shifts || []);
      setClockState({
        activeShift:
          data.clock_state?.activeShift ||
          data.clock_state?.active_shift ||
          null,
        onBreak:
          data.clock_state?.onBreak ||
          data.clock_state?.on_break ||
          false,
      });
      setHolidaySummary(data.holiday_summary || { allowance: 0, remaining: 0 });
      setAnnouncement(data.announcement || null);
    } catch (loadError) {
      if (isAuthError(loadError)) {
        setProfile(null);
        setNoSession(true);
        return;
      }
      setError(loadError.message || "Dashboard could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const weekSummary = useMemo(() => {
    const now = new Date();
    const completed = weekShifts.filter((shift) => getShiftEnd(shift));
    const completedSeconds = completed.reduce(
      (sum, shift) => sum + getShiftSeconds(shift),
      0
    );

    const upcoming = weekSchedule.filter((shift) => new Date(getShiftStart(shift)) >= now);
    const upcomingSeconds = upcoming.reduce(
      (sum, shift) => sum + getShiftSeconds(shift),
      0
    );

    const nextShift = [...weekSchedule]
      .filter((shift) => new Date(getShiftStart(shift)) >= now)
      .sort((a, b) => new Date(getShiftStart(a)) - new Date(getShiftStart(b)))[0];

    return {
      completedHours: formatSeconds(completedSeconds),
      upcomingHours: formatSeconds(upcomingSeconds),
      completedCount: completed.length,
      nextShift: nextShift || null,
    };
  }, [weekSchedule, weekShifts]);

  const clockLabel = clockState.activeShift
    ? clockState.onBreak
      ? "On break"
      : "Clocked in"
    : "Not clocked in";

  const firstName = coalesce(profile?.name, profile?.full_name, "there")
    .split(" ")[0];
  const companyLine = [profile?.role, profile?.company_name].filter(Boolean).join(" at ");

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
          <Text style={styles.loadingTitle}>Loading home</Text>
          <Text style={styles.loadingText}>Pulling together your day...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (noSession) {
    return <SignInRequired />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard({ refreshing: true })}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
      >
        <View style={styles.headerCard}>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.todayText}>{formatDate(new Date())}</Text>
          {companyLine ? (
            <View style={styles.rolePill}>
              <Ionicons name="business-outline" size={14} color="#a5b4fc" />
              <Text style={styles.roleText} numberOfLines={1}>
                {companyLine}
              </Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={28} color="#fecaca" />
            </View>
            <View style={styles.errorBody}>
              <Text style={styles.errorTitle}>Home unavailable</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadDashboard()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <TodayCard
          clockLabel={clockLabel}
          onClockIn={() => router.push("/(tabs)/clock-in")}
          shift={todayShift}
        />

        <WeekSummary summary={weekSummary} />

        <HolidaySummary summary={holidaySummary} />

        <QuickActions router={router} />

        <Announcements announcement={announcement} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TodayCard({ clockLabel, onClockIn, shift }) {
  const start = getShiftStart(shift);
  const end = getShiftEnd(shift);

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="calendar-outline" size={20} color="#a5b4fc" />
        </View>
        <Text style={styles.sectionTitle}>Today</Text>
      </View>

      {shift ? (
        <>
          <Text style={styles.shiftTitle} numberOfLines={2}>
            {shift.job_name || shift.title || "Scheduled Shift"}
          </Text>
          <InfoRow icon="location-outline" label="Location" value={getLocationName(shift)} />
          <View style={styles.metricGrid}>
            <MetricCard label="Start" value={formatTime(start)} icon="play-outline" />
            <MetricCard label="End" value={formatTime(end)} icon="stop-outline" />
            <MetricCard
              label="Total"
              value={formatSeconds(getShiftSeconds(shift))}
              icon="hourglass-outline"
              accent
            />
          </View>
        </>
      ) : (
        <EmptyInline
          icon="calendar-clear-outline"
          title="No scheduled shift today"
          text="Your next shift will still appear in the weekly summary."
        />
      )}

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: clockLabel === "Clocked in" ? "#22c55e" : "#f59e0b" },
          ]}
        />
        <Text style={styles.statusText}>{clockLabel}</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onClockIn}>
        <Ionicons name="log-in-outline" size={20} color="#ffffff" />
        <Text style={styles.primaryButtonText}>Clock In</Text>
      </TouchableOpacity>
    </View>
  );
}

function WeekSummary({ summary }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="stats-chart-outline" size={20} color="#a5b4fc" />
        </View>
        <Text style={styles.sectionTitle}>This Week</Text>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard label="Done" value={summary.completedHours} icon="checkmark-outline" />
        <MetricCard label="Upcoming" value={summary.upcomingHours} icon="time-outline" />
        <MetricCard
          label="Shifts"
          value={String(summary.completedCount)}
          icon="briefcase-outline"
          accent
        />
      </View>

      <View style={styles.nextShiftBox}>
        <Text style={styles.nextShiftLabel}>Next shift</Text>
        {summary.nextShift ? (
          <>
            <Text style={styles.nextShiftTitle} numberOfLines={1}>
              {getLocationName(summary.nextShift)}
            </Text>
            <Text style={styles.nextShiftMeta}>
              {formatShortDate(getShiftStart(summary.nextShift))} ·{" "}
              {formatTime(getShiftStart(summary.nextShift))} -{" "}
              {formatTime(getShiftEnd(summary.nextShift))}
            </Text>
          </>
        ) : (
          <Text style={styles.nextShiftMeta}>No more shifts scheduled this week</Text>
        )}
      </View>
    </View>
  );
}

function HolidaySummary({ summary }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="airplane-outline" size={20} color="#a5b4fc" />
        </View>
        <Text style={styles.sectionTitle}>Holiday</Text>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          label="Allowance"
          value={`${summary.allowance} days`}
          icon="calendar-number-outline"
        />
        <MetricCard
          label="Remaining"
          value={`${summary.remaining} days`}
          icon="sparkles-outline"
          accent
        />
      </View>
    </View>
  );
}

function QuickActions({ router }) {
  const actions = [
    { icon: "log-in-outline", label: "Clock In", route: "/(tabs)/clock-in" },
    { icon: "calendar-outline", label: "Schedule", route: "/(tabs)/schedule" },
    { icon: "time-outline", label: "Shifts", route: "/(tabs)/shifts" },
    { icon: "document-text-outline", label: "Payslips", route: "/(tabs)/payslips" },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="apps-outline" size={20} color="#a5b4fc" />
        </View>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>

      <View style={styles.actionsGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionButton}
            onPress={() => router.push(action.route)}
            activeOpacity={0.78}
          >
            <View style={styles.actionIcon}>
              <Ionicons name={action.icon} size={20} color="#c7d2fe" />
            </View>
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Announcements({ announcement }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="megaphone-outline" size={20} color="#a5b4fc" />
        </View>
        <Text style={styles.sectionTitle}>Announcements</Text>
      </View>

      {announcement ? (
        <View style={styles.announcementBox}>
          <Text style={styles.announcementTitle} numberOfLines={2}>
            {announcement.title}
          </Text>
          <Text style={styles.announcementText} numberOfLines={4}>
            {announcement.message}
          </Text>
        </View>
      ) : (
        <EmptyInline
          icon="chatbox-ellipses-outline"
          title="No announcements"
          text="Company updates will appear here when posted."
        />
      )}
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
        <Ionicons name={icon} size={16} color={accent ? "#c7d2fe" : "#94a3b8"} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function EmptyInline({ icon, title, text }) {
  return (
    <View style={styles.emptyInline}>
      <Ionicons name={icon} size={34} color="#64748b" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
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
    paddingHorizontal: 18,
    paddingTop: 14,
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
    fontWeight: "900",
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
    marginBottom: 16,
  },

  greeting: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },

  todayText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
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
    paddingVertical: 7,
    marginTop: 14,
    maxWidth: "100%",
  },

  roleText: {
    color: "#c7d2fe",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6,
    textTransform: "capitalize",
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

  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },

  retryText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  card: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    marginBottom: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
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
    marginRight: 11,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  shiftTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 13,
    marginBottom: 12,
  },

  infoIcon: {
    width: 36,
    height: 36,
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
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  infoValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 3,
  },

  metricGrid: {
    flexDirection: "row",
    gap: 9,
  },

  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 11,
  },

  metricCardAccent: {
    borderColor: "#3730a3",
    backgroundColor: "#15173a",
  },

  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    marginBottom: 8,
  },

  metricLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  metricValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
  },

  metricValueAccent: {
    color: "#c7d2fe",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 12,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },

  statusText: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "800",
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 12,
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginLeft: 8,
  },

  nextShiftBox: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 13,
    marginTop: 12,
  },

  nextShiftLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  nextShiftTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },

  nextShiftMeta: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  actionButton: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 13,
  },

  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1b4b",
    borderWidth: 1,
    borderColor: "#3730a3",
    marginBottom: 10,
  },

  actionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  announcementBox: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14,
  },

  announcementTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  announcementText: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },

  emptyInline: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 18,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },

  emptyText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    textAlign: "center",
  },
});
