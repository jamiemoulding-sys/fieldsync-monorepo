import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getShifts } from "../../utils/shifts";

const toShiftDate = (shift) =>
  shift.clock_in_time || shift.start_time || shift.created_at || shift.date;

const toShiftEnd = (shift) => shift.clock_out_time || shift.end_time || shift.finish_time;

const getLocationName = (shift) =>
  shift.locations?.name || shift.location?.name || shift.location_name || "Unknown Location";

const getStatus = (shift) => {
  const rawStatus = shift.status || shift.shift_status || shift.state;

  if (rawStatus) {
    const label = String(rawStatus).replace(/_/g, " ");
    return {
      text: label.charAt(0).toUpperCase() + label.slice(1),
      color: "#a5b4fc",
      background: "#1e1b4b",
      border: "#3730a3",
    };
  }

  if (!toShiftEnd(shift)) {
    return {
      text: "In Progress",
      color: "#fbbf24",
      background: "#422006",
      border: "#854d0e",
    };
  }

  return {
    text: "Completed",
    color: "#86efac",
    background: "#052e16",
    border: "#166534",
  };
};

const formatDateKey = (value) => {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
};

const formatSectionTitle = (key) => {
  if (key === "unknown") return "Date unavailable";

  return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const formatShortDate = (value) => {
  if (!value) return "--";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "--:--";

  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDurationSeconds = (shift) => {
  const start = toShiftDate(shift);
  const end = toShiftEnd(shift);
  if (!start || !end) return null;

  const diff = new Date(end) - new Date(start);
  if (Number.isNaN(diff) || diff < 0) return null;

  return diff / 1000;
};

const formatDuration = (shift) => {
  const seconds = getDurationSeconds(shift);
  if (seconds === null) return !toShiftEnd(shift) ? "In progress" : "--";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const formatTotalHours = (shifts) => {
  const totalSeconds = shifts.reduce(
    (total, shift) => total + (getDurationSeconds(shift) || 0),
    0
  );

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (!hours && !minutes) return "0h";
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const sheetAnim = useRef(new Animated.Value(0)).current;

  const loadShifts = useCallback(async ({ refreshing: isRefreshing = false } = {}) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const data = await getShifts({ throwOnError: true });
      setShifts(data || []);
    } catch (loadError) {
      setShifts([]);
      setError(loadError.message || "Shifts could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const sections = useMemo(() => {
    const grouped = shifts.reduce((groups, shift) => {
      const key = formatDateKey(toShiftDate(shift));
      const current = groups[key] || [];
      return {
        ...groups,
        [key]: [...current, shift],
      };
    }, {});

    return Object.keys(grouped)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((key) => ({
        title: formatSectionTitle(key),
        total: formatTotalHours(grouped[key]),
        data: grouped[key],
      }));
  }, [shifts]);

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
    loadShifts({ refreshing: true });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
          <Text style={styles.loadingTitle}>Loading shifts</Text>
          <Text style={styles.loadingText}>Checking your recent work history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id || "shift"}-${index}`}
        style={styles.list}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Work history</Text>
                <Text style={styles.title}>Shifts</Text>
              </View>
              <TouchableOpacity style={styles.refreshButton} onPress={() => loadShifts()}>
                <Ionicons name="refresh-outline" size={22} color="#c7d2fe" />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <View style={styles.errorIcon}>
                  <Ionicons name="alert-circle-outline" size={28} color="#fecaca" />
                </View>
                <View style={styles.errorBody}>
                  <Text style={styles.errorTitle}>Shifts unavailable</Text>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={() => loadShifts()}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Ionicons name="time-outline" size={24} color="#a5b4fc" />
              </View>
              <View style={styles.summaryBody}>
                <Text style={styles.summaryLabel}>Total completed hours</Text>
                <Text style={styles.summaryValue}>{formatTotalHours(shifts)}</Text>
              </View>
              <View style={styles.summaryCount}>
                <Text style={styles.summaryCountValue}>{shifts.length}</Text>
                <Text style={styles.summaryCountLabel}>shifts</Text>
              </View>
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <View>
              <Text style={styles.dayLabel}>Shift date</Text>
              <Text style={styles.dayTitle}>{section.title}</Text>
            </View>
            <View style={styles.dayHoursPill}>
              <Text style={styles.dayHoursText}>{section.total}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => <ShiftCard shift={item} onPress={() => openShift(item)} />}
        ListEmptyComponent={!error ? <EmptyState /> : null}
      />

      <ShiftSheet shift={selectedShift} sheetAnim={sheetAnim} onClose={closeShift} />
    </SafeAreaView>
  );
}

function ShiftCard({ shift, onPress }) {
  const status = getStatus(shift);
  const start = toShiftDate(shift);
  const end = toShiftEnd(shift);

  return (
    <TouchableOpacity style={styles.shiftCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.cardTop}>
        <View style={styles.locationIcon}>
          <Ionicons name="location-outline" size={22} color="#a5b4fc" />
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.locationTitle} numberOfLines={1}>
            {getLocationName(shift)}
          </Text>
          <Text style={styles.cardDate}>{formatShortDate(start)}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: status.background,
              borderColor: status.border,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
            {status.text}
          </Text>
        </View>
      </View>

      <View style={styles.timeGrid}>
        <TimeBlock label="Start" value={formatTime(start)} icon="play-outline" />
        <TimeBlock label="End" value={formatTime(end)} icon="stop-outline" />
        <TimeBlock label="Total" value={formatDuration(shift)} icon="hourglass-outline" />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.tapHint}>View details</Text>
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      </View>
    </TouchableOpacity>
  );
}

function TimeBlock({ label, value, icon }) {
  return (
    <View style={styles.timeBlock}>
      <View style={styles.timeIcon}>
        <Ionicons name={icon} size={15} color="#94a3b8" />
      </View>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="calendar-clear-outline" size={44} color="#64748b" />
      <Text style={styles.emptyTitle}>No shifts yet</Text>
      <Text style={styles.emptyText}>
        Your shift history will appear here after you clock in and out.
      </Text>
    </View>
  );
}

function ShiftSheet({ shift, sheetAnim, onClose }) {
  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [460, 0],
  });

  if (!shift) return null;

  const status = getStatus(shift);
  const start = toShiftDate(shift);
  const end = toShiftEnd(shift);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>Shift details</Text>
              <Text style={styles.sheetLocation} numberOfLines={1}>
                {getLocationName(shift)}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.sheetStatus,
              {
                backgroundColor: status.background,
                borderColor: status.border,
              },
            ]}
          >
            <View style={[styles.sheetStatusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.sheetStatusText, { color: status.color }]}>
              {status.text}
            </Text>
          </View>

          <DetailRow icon="location-outline" label="Location" value={getLocationName(shift)} />
          <DetailRow icon="calendar-outline" label="Date" value={formatShortDate(start)} />
          <DetailRow icon="play-outline" label="Start time" value={formatTime(start)} />
          <DetailRow icon="stop-outline" label="End time" value={formatTime(end)} />
          <DetailRow
            icon="hourglass-outline"
            label="Total hours"
            value={formatDuration(shift)}
            highlight
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value, highlight = false }) {
  return (
    <View style={[styles.detailRow, highlight && styles.detailRowHighlight]}>
      <View style={[styles.detailIcon, highlight && styles.detailIconHighlight]}>
        <Ionicons name={icon} size={18} color="#a5b4fc" />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },

  list: {
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  eyebrow: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 2,
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
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

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    marginBottom: 18,
  },

  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1b4b",
    borderWidth: 1,
    borderColor: "#3730a3",
    marginRight: 13,
  },

  summaryBody: {
    flex: 1,
    minWidth: 0,
  },

  summaryLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  summaryValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 3,
  },

  summaryCount: {
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#273449",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  summaryCountValue: {
    color: "#c7d2fe",
    fontSize: 18,
    fontWeight: "900",
  },

  summaryCountLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },

  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },

  dayLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  dayTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },

  dayHoursPill: {
    backgroundColor: "#111827",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273449",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  dayHoursText: {
    color: "#c7d2fe",
    fontSize: 12,
    fontWeight: "900",
  },

  shiftCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    marginBottom: 12,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  locationIcon: {
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

  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  locationTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },

  cardDate: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },

  statusBadge: {
    maxWidth: 112,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },

  timeGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 15,
  },

  timeBlock: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 11,
  },

  timeIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    marginBottom: 8,
  },

  timeLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  timeValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    paddingTop: 13,
    marginTop: 14,
  },

  tapHint: {
    color: "#a5b4fc",
    fontSize: 13,
    fontWeight: "800",
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 28,
    marginTop: 6,
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

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2, 6, 23, 0.7)",
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
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 34,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sheetTitleWrap: {
    flex: 1,
    paddingRight: 14,
  },

  sheetTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
  },

  sheetLocation: {
    color: "#c7d2fe",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6,
  },

  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
  },

  sheetStatus: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },

  sheetStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 10,
  },

  sheetStatusText: {
    fontSize: 14,
    fontWeight: "900",
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 13,
    marginBottom: 9,
  },

  detailRowHighlight: {
    borderColor: "#3730a3",
    backgroundColor: "#15173a",
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

  detailIconHighlight: {
    backgroundColor: "#1e1b4b",
  },

  detailBody: {
    flex: 1,
    minWidth: 0,
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

  detailValueHighlight: {
    color: "#c7d2fe",
    fontSize: 16,
  },
});
