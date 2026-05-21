import { Ionicons } from "@expo/vector-icons";
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser } from "../../utils/session";
import { supabase } from "../../utils/supabase";

const todayKey = new Date().toISOString().slice(0, 10);

const calendarTheme = {
  backgroundColor: "#0f172a",
  calendarBackground: "#0f172a",
  textSectionTitleColor: "#94a3b8",
  selectedDayBackgroundColor: "#6366f1",
  selectedDayTextColor: "#ffffff",
  todayTextColor: "#a5b4fc",
  dayTextColor: "#e5e7eb",
  textDisabledColor: "#475569",
  monthTextColor: "#ffffff",
  arrowColor: "#a5b4fc",
  dotColor: "#6366f1",
  selectedDotColor: "#ffffff",
  textDayFontWeight: "700",
  textMonthFontWeight: "900",
  textDayHeaderFontWeight: "800",
};

const toDateKey = (value) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const formatTime = (value) => {
  if (!value) return "--:--";

  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getShiftStart = (shift) => shift.start_time || shift.date;
const getShiftEnd = (shift) => shift.end_time || shift.finish_time;

const getBreakMinutes = (shift) => {
  const minutes =
    shift.break_minutes ??
    shift.break_duration ??
    shift.break_duration_minutes ??
    null;

  if (minutes !== null && minutes !== undefined) {
    return Number(minutes) || 0;
  }

  return Math.round(Number(shift.total_break_seconds || 0) / 60);
};

const getShiftHours = (shift) => {
  const start = getShiftStart(shift);
  const end = getShiftEnd(shift);

  if (!start || !end) return 0;

  const diff = new Date(end) - new Date(start);
  if (Number.isNaN(diff) || diff <= 0) return 0;

  return diff / 3600000;
};

const formatHours = (hours) => {
  if (!hours) return "0h";

  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);

  if (!whole) return `${minutes}m`;
  if (!minutes) return `${whole}h`;

  return `${whole}h ${minutes}m`;
};

const getPaidHours = (shift) =>
  Math.max(getShiftHours(shift) - getBreakMinutes(shift) / 60, 0);

const getShiftTitle = (shift) =>
  shift.job_name || shift.title || shift.role || shift.job_title || "Scheduled Shift";

const getLocationName = (shift) =>
  shift.location?.name || shift.locations?.name || shift.location_name || "Location TBC";

const getShiftNotes = (shift) =>
  shift.notes || shift.note || shift.description || shift.instructions || "No notes added";

export default function Schedule() {
  const [shifts, setShifts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [currentMonth, setCurrentMonth] = useState(todayKey);
  const [selectedShift, setSelectedShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const sheetAnim = useRef(new Animated.Value(0)).current;

  const loadSchedule = useCallback(async ({ refreshing: isRefreshing = false } = {}) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const user = await getCurrentUser();
      if (!user) {
        setShifts([]);
        setError("No active session. Please sign in again.");
        return;
      }

      const { data: schedules, error: scheduleError } = await supabase
        .from("schedules")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", user.company_id)
        .order("start_time", { ascending: true });

      if (scheduleError) throw scheduleError;

      const { data: locations, error: locationError } = await supabase
        .from("locations")
        .select("*")
        .eq("company_id", user.company_id);

      if (locationError) throw locationError;

      const merged = (schedules || []).map((shift) => ({
        ...shift,
        location:
          (locations || []).find((location) => location.id === shift.location_id) ||
          null,
      }));

      setShifts(merged);
    } catch (loadError) {
      setShifts([]);
      setError(loadError.message || "Schedule could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const shiftsByDate = useMemo(() => {
    return shifts.reduce((groups, shift) => {
      const key = toDateKey(getShiftStart(shift));
      if (!key) return groups;

      return {
        ...groups,
        [key]: [...(groups[key] || []), shift],
      };
    }, {});
  }, [shifts]);

  const selectedShifts = shiftsByDate[selectedDate] || [];

  const markedDates = useMemo(() => {
    const marks = {};

    Object.keys(shiftsByDate).forEach((date) => {
      marks[date] = {
        marked: true,
        dotColor: "#6366f1",
      };
    });

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: "#6366f1",
      selectedTextColor: "#ffffff",
    };

    return marks;
  }, [selectedDate, shiftsByDate]);

  const openShift = (shift) => {
    setSelectedShift(shift);
    sheetAnim.setValue(0);

    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const closeShift = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setSelectedShift(null));
  };

  const onRefresh = () => {
    loadSchedule({ refreshing: true });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
          <Text style={styles.loadingTitle}>Loading schedule</Text>
          <Text style={styles.loadingText}>Finding your upcoming shifts...</Text>
        </View>
      </SafeAreaView>
    );
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
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Schedule</Text>
            <Text style={styles.title}>Your month</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadSchedule()}>
            <Ionicons name="refresh-outline" size={22} color="#c7d2fe" />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={28} color="#fecaca" />
            </View>
            <View style={styles.errorBody}>
              <Text style={styles.errorTitle}>Schedule unavailable</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadSchedule()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.calendarCard}>
          <CalendarBoundary>
            <Calendar
              current={currentMonth}
              markedDates={markedDates}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              onMonthChange={(month) => setCurrentMonth(month.dateString)}
              enableSwipeMonths
              firstDay={1}
              hideExtraDays={false}
              style={styles.calendar}
              theme={calendarTheme}
            />
          </CalendarBoundary>
        </View>

        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.dayLabel}>Selected date</Text>
            <Text style={styles.dayTitle}>{formatDate(selectedDate)}</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{selectedShifts.length}</Text>
          </View>
        </View>

        {selectedShifts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-clear-outline" size={42} color="#64748b" />
            <Text style={styles.emptyTitle}>No shifts scheduled</Text>
            <Text style={styles.emptyText}>
              Shifts for this day will appear here when they are published.
            </Text>
          </View>
        ) : (
          selectedShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} onPress={() => openShift(shift)} />
          ))
        )}
      </ScrollView>

      <ShiftSheet shift={selectedShift} sheetAnim={sheetAnim} onClose={closeShift} />
    </SafeAreaView>
  );
}

class CalendarBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.calendarFallback}>
          <Ionicons name="calendar-clear-outline" size={42} color="#64748b" />
          <Text style={styles.fallbackTitle}>Calendar unavailable</Text>
          <Text style={styles.fallbackText}>
            Pull to refresh or use the selected date details below.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

function ShiftCard({ shift, onPress }) {
  return (
    <TouchableOpacity style={styles.shiftCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.shiftTop}>
        <View style={styles.shiftIcon}>
          <Ionicons name="briefcase-outline" size={22} color="#a5b4fc" />
        </View>
        <View style={styles.shiftMain}>
          <Text style={styles.shiftTitle} numberOfLines={1}>
            {getShiftTitle(shift)}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color="#94a3b8" />
            <Text style={styles.locationText} numberOfLines={1}>
              {getLocationName(shift)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </View>

      <View style={styles.shiftMetaRow}>
        <MetaPill icon="time-outline" text={`${formatTime(getShiftStart(shift))} - ${formatTime(getShiftEnd(shift))}`} />
        <MetaPill icon="hourglass-outline" text={formatHours(getShiftHours(shift))} />
      </View>
    </TouchableOpacity>
  );
}

function MetaPill({ icon, text }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={14} color="#a5b4fc" />
      <Text style={styles.metaPillText}>{text}</Text>
    </View>
  );
}

function ShiftSheet({ shift, sheetAnim, onClose }) {
  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

  if (!shift) return null;

  const breakMinutes = getBreakMinutes(shift);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetEyebrow}>Shift details</Text>
              <Text style={styles.sheetTitle}>{getShiftTitle(shift)}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={28} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <DetailRow icon="location-outline" label="Location" value={getLocationName(shift)} />
          <DetailRow icon="calendar-outline" label="Date" value={formatDate(getShiftStart(shift))} />
          <DetailRow
            icon="time-outline"
            label="Time"
            value={`${formatTime(getShiftStart(shift))} - ${formatTime(getShiftEnd(shift))}`}
          />
          <DetailRow icon="hourglass-outline" label="Total hours" value={formatHours(getShiftHours(shift))} />
          <DetailRow icon="pause-circle-outline" label="Break duration" value={`${breakMinutes}m`} />
          <DetailRow icon="cash-outline" label="Total paid hours" value={formatHours(getPaidHours(shift))} />
          <DetailRow icon="document-text-outline" label="Notes" value={getShiftNotes(shift)} multiline />
        </Animated.View>
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value, multiline = false }) {
  return (
    <View style={[styles.detailRow, multiline && styles.detailRowTop]}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color="#a5b4fc" />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
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
    fontWeight: "900",
  },

  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  eyebrow: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
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

  calendarCard: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 18,
    overflow: "hidden",
  },

  calendar: {
    borderRadius: 18,
  },

  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  dayLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  dayTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },

  countPill: {
    minWidth: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1b4b",
    borderWidth: 1,
    borderColor: "#3730a3",
  },

  countText: {
    color: "#c7d2fe",
    fontSize: 16,
    fontWeight: "900",
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 28,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 14,
  },

  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },

  calendarFallback: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 320,
    padding: 24,
  },

  fallbackTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },

  fallbackText: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },

  shiftCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    marginBottom: 12,
  },

  shiftTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  shiftIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#273449",
    marginRight: 12,
  },

  shiftMain: {
    flex: 1,
    minWidth: 0,
  },

  shiftTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  locationText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 5,
    flex: 1,
  },

  shiftMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273449",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  metaPillText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 5,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2, 6, 23, 0.68)",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  sheet: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },

  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#334155",
    marginBottom: 16,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  sheetTitleWrap: {
    flex: 1,
    paddingRight: 14,
  },

  sheetEyebrow: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  sheetTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },

  closeButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14,
    marginBottom: 10,
  },

  detailRowTop: {
    alignItems: "flex-start",
  },

  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    marginRight: 12,
  },

  detailBody: {
    flex: 1,
  },

  detailLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  detailValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    marginTop: 3,
  },
});
