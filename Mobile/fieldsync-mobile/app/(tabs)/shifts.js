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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getShifts } from "../../utils/shifts";

const PAGE_SIZE = 24;
const WEEK_START_DAY = 1;
const OVERTIME_THRESHOLD_HOURS = 40;

const toShiftDate = (shift) =>
  shift.clock_in_time || shift.start_time || shift.created_at || shift.date;

const toShiftEnd = (shift) => shift.clock_out_time || shift.end_time || shift.finish_time;

const getLocationName = (shift) =>
  shift.locations?.name || shift.location?.name || shift.location_name || "Unknown Location";

const getStatusLabel = (shift) => {
  const rawStatus = shift.status || shift.shift_status || shift.state;
  if (rawStatus) return String(rawStatus).replace(/_/g, " ");
  return toShiftEnd(shift) ? "Completed" : "In Progress";
};

const getStatus = (shift) => {
  const label = getStatusLabel(shift);
  const normalized = label.toLowerCase();

  if (normalized.includes("progress") || normalized.includes("active")) {
    return {
      text: "In Progress",
      color: "#fbbf24",
      background: "#422006",
      border: "#854d0e",
    };
  }

  if (normalized.includes("complete") || normalized.includes("approved")) {
    return {
      text: label.charAt(0).toUpperCase() + label.slice(1),
      color: "#86efac",
      background: "#052e16",
      border: "#166534",
    };
  }

  return {
    text: label.charAt(0).toUpperCase() + label.slice(1),
    color: "#a5b4fc",
    background: "#1e1b4b",
    border: "#3730a3",
  };
};

const atStartOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getWeekStart = (date = new Date(), weekStartDay = WEEK_START_DAY) => {
  const start = atStartOfDay(date);
  const diff = (start.getDay() - weekStartDay + 7) % 7;
  start.setDate(start.getDate() - diff);
  return start;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getRecentStart = () => addDays(getWeekStart(new Date()), -7).toISOString();

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

const formatSeconds = (seconds) => {
  const safeSeconds = Math.max(Number(seconds) || 0, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.round((safeSeconds % 3600) / 60);

  if (!hours && !minutes) return "0h";
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const formatDuration = (shift) => {
  const seconds = getDurationSeconds(shift);
  if (seconds === null) return !toShiftEnd(shift) ? "In progress" : "--";
  return formatSeconds(seconds);
};

const getOvertimeSeconds = (shift) => {
  const raw =
    shift.overtime_seconds ??
    shift.overtime_total_seconds ??
    shift.overtime_minutes ??
    shift.overtime_hours;

  if (raw === undefined || raw === null || raw === "") return null;

  const value = Number(raw);
  if (Number.isNaN(value)) return null;

  if (shift.overtime_minutes !== undefined) return value * 60;
  if (shift.overtime_hours !== undefined) return value * 3600;
  return value;
};

const getShiftTime = (shift) => {
  const date = toShiftDate(shift);
  if (!date) return 0;
  const time = new Date(date).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const mergeShiftPages = (current, incoming) => {
  const seen = new Set();

  return [...current, ...incoming]
    .filter((shift) => {
      const key = String(shift.id || `${toShiftDate(shift)}-${getLocationName(shift)}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => getShiftTime(b) - getShiftTime(a));
};

const getDateFilterRange = (filter) => {
  const now = new Date();
  const today = atStartOfDay(now);
  const weekStart = getWeekStart(now);
  const nextWeekStart = addDays(weekStart, 7);
  const previousWeekStart = addDays(weekStart, -7);

  if (filter === "today") return { start: today, end: addDays(today, 1) };
  if (filter === "thisWeek") return { start: weekStart, end: nextWeekStart };
  if (filter === "previousWeek") return { start: previousWeekStart, end: weekStart };
  if (filter === "older") return { start: null, end: previousWeekStart };

  return null;
};

const shiftMatchesDateFilter = (shift, filter) => {
  const range = getDateFilterRange(filter);
  if (!range) return true;

  const time = getShiftTime(shift);
  if (!time) return false;

  if (range.start && time < range.start.getTime()) return false;
  if (range.end && time >= range.end.getTime()) return false;
  return true;
};

const getRelativeSectionTitle = (shift) => {
  const time = getShiftTime(shift);
  if (!time) return "Older";

  const today = atStartOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const weekStart = getWeekStart(new Date());
  const previousWeekStart = addDays(weekStart, -7);

  if (time >= today.getTime() && time < tomorrow.getTime()) return "Today";
  if (time >= weekStart.getTime()) return "This Week";
  if (time >= previousWeekStart.getTime()) return "Previous Week";
  return "Older";
};

const sectionOrder = ["Today", "This Week", "Previous Week", "Older"];

const buildSections = (items) => {
  const grouped = items.reduce((groups, shift) => {
    const title = getRelativeSectionTitle(shift);
    return {
      ...groups,
      [title]: [...(groups[title] || []), shift],
    };
  }, {});

  return sectionOrder
    .filter((title) => grouped[title]?.length)
    .map((title) => ({
      title,
      total: formatSeconds(
        grouped[title].reduce((sum, shift) => sum + (getDurationSeconds(shift) || 0), 0)
      ),
      data: grouped[title],
    }));
};

const dateFilters = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This Week" },
  { key: "previousWeek", label: "Previous" },
  { key: "older", label: "Older" },
];

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const sheetAnim = useRef(new Animated.Value(0)).current;

  const loadRecentShifts = useCallback(
    async ({ refreshing: isRefreshing = false } = {}) => {
      try {
        if (isRefreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const data = await getShifts({
          from: getRecentStart(),
          limit: PAGE_SIZE,
          throwOnError: true,
        });

        setShifts(data || []);
        setHasMoreOlder(true);
      } catch (loadError) {
        setShifts([]);
        setError(loadError.message || "Shifts could not be loaded.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadRecentShifts();
  }, [loadRecentShifts]);

  const loadedStatusFilters = useMemo(() => {
    const labels = [...new Set(shifts.map((shift) => getStatus(shift).text))];
    return ["all", ...labels];
  }, [shifts]);

  const filteredShifts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return shifts.filter((shift) => {
      const location = getLocationName(shift).toLowerCase();
      const status = getStatus(shift).text;

      if (normalizedSearch && !location.includes(normalizedSearch)) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      return shiftMatchesDateFilter(shift, dateFilter);
    });
  }, [dateFilter, searchText, shifts, statusFilter]);

  const sections = useMemo(() => buildSections(filteredShifts), [filteredShifts]);

  const weekSummary = useMemo(() => {
    const start = getWeekStart(new Date());
    const end = addDays(start, 7);
    const weekShifts = shifts.filter((shift) => {
      const time = getShiftTime(shift);
      return time >= start.getTime() && time < end.getTime();
    });

    const completed = weekShifts.filter((shift) => toShiftEnd(shift));
    const totalSeconds = completed.reduce(
      (sum, shift) => sum + (getDurationSeconds(shift) || 0),
      0
    );

    const explicitOvertime = completed
      .map(getOvertimeSeconds)
      .filter((seconds) => seconds !== null);
    const overtimeSeconds = explicitOvertime.length
      ? explicitOvertime.reduce((sum, seconds) => sum + seconds, 0)
      : Math.max(totalSeconds - OVERTIME_THRESHOLD_HOURS * 3600, 0);

    return {
      completedCount: completed.length,
      overtime: formatSeconds(overtimeSeconds),
      total: formatSeconds(totalSeconds),
    };
  }, [shifts]);

  const loadOlderShifts = useCallback(async () => {
    if (loadingOlder || !hasMoreOlder) return;

    try {
      setLoadingOlder(true);
      setError("");

      const oldestShift = shifts[shifts.length - 1];
      const data = await getShifts({
        before: oldestShift ? toShiftDate(oldestShift) : getRecentStart(),
        limit: PAGE_SIZE,
        throwOnError: true,
      });

      setShifts((current) => mergeShiftPages(current, data || []));
      setHasMoreOlder((data || []).length === PAGE_SIZE);
    } catch (loadError) {
      setError(loadError.message || "Older shifts could not be loaded.");
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMoreOlder, loadingOlder, shifts]);

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

  const clearFilters = () => {
    setSearchText("");
    setDateFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchText || dateFilter !== "all" || statusFilter !== "all";

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
            onRefresh={() => loadRecentShifts({ refreshing: true })}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Recent work history</Text>
                <Text style={styles.title}>Shifts</Text>
              </View>
              <TouchableOpacity style={styles.refreshButton} onPress={() => loadRecentShifts()}>
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
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => loadRecentShifts()}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <WeeklySummary summary={weekSummary} />
            <FilterPanel
              dateFilter={dateFilter}
              dateFilters={dateFilters}
              loadedStatusFilters={loadedStatusFilters}
              searchText={searchText}
              setDateFilter={setDateFilter}
              setSearchText={setSearchText}
              setStatusFilter={setStatusFilter}
              statusFilter={statusFilter}
              onClear={clearFilters}
            />
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>Period</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.sectionHoursPill}>
              <Text style={styles.sectionHoursText}>{section.total}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => <ShiftCard shift={item} onPress={() => openShift(item)} />}
        ListEmptyComponent={
          !error ? (
            <EmptyState hasActiveFilters={!!hasActiveFilters} onClear={clearFilters} />
          ) : null
        }
        ListFooterComponent={
          <LoadOlderButton
            hasMoreOlder={hasMoreOlder}
            loadingOlder={loadingOlder}
            onPress={loadOlderShifts}
          />
        }
      />

      <ShiftSheet shift={selectedShift} sheetAnim={sheetAnim} onClose={closeShift} />
    </SafeAreaView>
  );
}

function WeeklySummary({ summary }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryIcon}>
          <Ionicons name="stats-chart-outline" size={24} color="#a5b4fc" />
        </View>
        <View style={styles.summaryTitleWrap}>
          <Text style={styles.summaryLabel}>Rolling week totals</Text>
          <Text style={styles.summarySubtitle}>Current work week from Monday</Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryMetric label="Hours" value={summary.total} />
        <SummaryMetric label="Overtime" value={summary.overtime} accent />
        <SummaryMetric label="Completed" value={String(summary.completedCount)} />
      </View>
    </View>
  );
}

function SummaryMetric({ label, value, accent = false }) {
  return (
    <View style={[styles.metricCard, accent && styles.metricCardAccent]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function FilterPanel({
  dateFilter,
  dateFilters,
  loadedStatusFilters,
  searchText,
  setDateFilter,
  setSearchText,
  setStatusFilter,
  statusFilter,
  onClear,
}) {
  return (
    <View style={styles.filterCard}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search site or location"
          placeholderTextColor="#64748b"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={19} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterHeader}>
        <Text style={styles.filterLabel}>Date</Text>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.chipRow}>
        {dateFilters.map((filter) => (
          <FilterChip
            key={filter.key}
            active={dateFilter === filter.key}
            label={filter.label}
            onPress={() => setDateFilter(filter.key)}
          />
        ))}
      </View>

      {loadedStatusFilters.length > 2 ? (
        <>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.chipRow}>
            {loadedStatusFilters.map((status) => (
              <FilterChip
                key={status}
                active={statusFilter === status}
                label={status === "all" ? "All" : status}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function FilterChip({ active, label, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
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

function EmptyState({ hasActiveFilters, onClear }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="calendar-clear-outline" size={44} color="#64748b" />
      <Text style={styles.emptyTitle}>
        {hasActiveFilters ? "No matching shifts" : "No recent shifts"}
      </Text>
      <Text style={styles.emptyText}>
        {hasActiveFilters
          ? "Adjust your filters or load older shifts to broaden the results."
          : "Recent shifts from this week and last week will appear here."}
      </Text>
      {hasActiveFilters ? (
        <TouchableOpacity style={styles.emptyButton} onPress={onClear}>
          <Text style={styles.emptyButtonText}>Clear filters</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function LoadOlderButton({ hasMoreOlder, loadingOlder, onPress }) {
  if (!hasMoreOlder) {
    return (
      <View style={styles.endCard}>
        <Text style={styles.endText}>No older shifts to load</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.loadOlderButton, loadingOlder && styles.loadOlderButtonDisabled]}
      onPress={onPress}
      disabled={loadingOlder}
      activeOpacity={0.78}
    >
      {loadingOlder ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <>
          <Ionicons name="download-outline" size={20} color="#ffffff" />
          <Text style={styles.loadOlderText}>Load Older Shifts</Text>
        </>
      )}
    </TouchableOpacity>
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
    backgroundColor: "#0f172a",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    marginBottom: 14,
  },

  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
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

  summaryTitleWrap: {
    flex: 1,
    minWidth: 0,
  },

  summaryLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  summarySubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
  },

  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#273449",
    padding: 12,
  },

  metricCardAccent: {
    backgroundColor: "#15173a",
    borderColor: "#3730a3",
  },

  metricLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  metricValue: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
  },

  metricValueAccent: {
    color: "#c7d2fe",
  },

  filterCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    marginBottom: 16,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#273449",
    paddingHorizontal: 12,
    marginBottom: 14,
  },

  searchInput: {
    flex: 1,
    minHeight: 44,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 10,
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  filterLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 9,
  },

  clearText: {
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 9,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },

  filterChip: {
    backgroundColor: "#111827",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273449",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  filterChipActive: {
    backgroundColor: "#1e1b4b",
    borderColor: "#6366f1",
  },

  filterChipText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "900",
  },

  filterChipTextActive: {
    color: "#c7d2fe",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },

  sectionLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },

  sectionHoursPill: {
    backgroundColor: "#111827",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273449",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  sectionHoursText: {
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

  emptyButton: {
    backgroundColor: "#6366f1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 16,
  },

  emptyButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  loadOlderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 6,
  },

  loadOlderButtonDisabled: {
    opacity: 0.7,
  },

  loadOlderText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginLeft: 8,
  },

  endCard: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingVertical: 14,
    marginTop: 6,
  },

  endText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
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
