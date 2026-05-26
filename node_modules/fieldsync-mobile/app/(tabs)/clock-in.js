import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { getDistance } from "../../utils/geofence";
import {
  isTrackingActive,
  pingCurrentLocation,
  startTracking,
  stopTracking,
} from "../../utils/locationTracking";
import { getTodayShift } from "../../utils/schedule";
import { getCurrentUser } from "../../utils/session";

const GEOFENCE_BUFFER_METERS = 10;

const coalesce = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const getShiftStart = (shift) => shift?.start_time || shift?.date;
const getShiftEnd = (shift) => shift?.end_time || shift?.finish_time;

const getLocation = (shift) => shift?.location || shift?.locations || null;

const getLocationName = (shift) =>
  getLocation(shift)?.name || shift?.location_name || "Location TBC";

const getLocationLatitude = (location) => coalesce(location?.latitude, location?.lat);
const getLocationLongitude = (location) => coalesce(location?.longitude, location?.lng);
const getLocationRadius = (location) =>
  Number(coalesce(location?.radius, location?.geofence_radius, location?.radius_meters, 100));

const formatDate = (date) =>
  date.toLocaleDateString("en-GB", {
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

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(Number(seconds) || 0, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${secs}s`;
};

const getShiftHours = (shift) => {
  const start = getShiftStart(shift);
  const end = getShiftEnd(shift);
  if (!start || !end) return "0h";

  const diff = new Date(end) - new Date(start);
  if (Number.isNaN(diff) || diff <= 0) return "0h";

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.round((diff % 3600000) / 60000);

  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const normalizeRouteStops = (shift) => {
  const candidates = [
    shift?.route_locations,
    shift?.route,
    shift?.path,
    ...(shift?.tasks || []).map((task) => task.route_locations),
  ];

  const stops = candidates
    .flatMap((candidate) => {
      if (!candidate) return [];
      if (Array.isArray(candidate)) return candidate;

      try {
        const parsed = typeof candidate === "string" ? JSON.parse(candidate) : candidate;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
    .filter(Boolean);

  return stops;
};

export default function ClockIn() {
  const [user, setUser] = useState(null);
  const [shift, setShift] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState("undetermined");
  const [trackingActive, setTrackingActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const foregroundSubscription = useRef(null);

  const location = getLocation(shift);
  const routeStops = useMemo(() => normalizeRouteStops(shift), [shift]);

  const geofence = useMemo(() => {
    if (!location || !currentLocation) {
      return {
        distance: null,
        inside: false,
        radius: location ? getLocationRadius(location) : null,
      };
    }

    const latitude = getLocationLatitude(location);
    const longitude = getLocationLongitude(location);
    const radius = getLocationRadius(location);
    const distance = getDistance(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      latitude,
      longitude
    );

    return {
      distance,
      inside: distance <= radius + GEOFENCE_BUFFER_METERS,
      radius,
    };
  }, [currentLocation, location]);

  const elapsedSeconds = activeShift?.clock_in_time
    ? Math.floor((currentTime - new Date(activeShift.clock_in_time)) / 1000)
    : 0;

  const loadClockIn = useCallback(async ({ refreshing: isRefreshing = false } = {}) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [profile, todayShift, permission] = await Promise.all([
        getCurrentUser(),
        getTodayShift(),
        Location.getForegroundPermissionsAsync(),
      ]);

      setUser(profile);
      setShift(todayShift || null);
      setPermissionStatus(permission.status);

      try {
        const { data } = await API.get("/shifts/state");
        setActiveShift(data?.active_shift || null);
      } catch (stateError) {
        setError(stateError.message || "Could not load clock-in state.");
      }

      if (permission.status === "granted") {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation(position);
      }

      setTrackingActive(await isTrackingActive());
    } catch (loadError) {
      setError(loadError.message || "Clock-in screen could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadClockIn();
  }, [loadClockIn]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function syncTracking() {
      if (loading) return;

      if (!activeShift || !user) {
        await stopTracking();
        setTrackingActive(false);
        return;
      }

      const started = await startTracking({
        shiftId: activeShift.id,
        userId: user.id,
        companyId: user.company_id,
      });

      setTrackingActive(started);
    }

    syncTracking();
  }, [activeShift, loading, user]);

  useEffect(() => {
    async function startForegroundPings() {
      if (!activeShift || permissionStatus !== "granted") {
        if (foregroundSubscription.current) {
          foregroundSubscription.current.remove();
          foregroundSubscription.current = null;
        }
        return;
      }

      if (foregroundSubscription.current) return;

      foregroundSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 15000,
          distanceInterval: 15,
        },
        (position) => {
          setCurrentLocation(position);
          pingCurrentLocation(position.coords);
        }
      );
    }

    startForegroundPings();

    return () => {
      if (foregroundSubscription.current) {
        foregroundSubscription.current.remove();
        foregroundSubscription.current = null;
      }
    };
  }, [activeShift, permissionStatus]);

  async function requestLocationPermission() {
    const permission = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(permission.status);

    if (permission.status !== "granted") {
      setError("Location permission is required to verify site clock-in.");
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setCurrentLocation(position);
    setError("");
    return position;
  }

  async function getVerifiedPosition() {
    if (permissionStatus !== "granted") {
      return await requestLocationPermission();
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setCurrentLocation(position);
    return position;
  }

  async function handleClockIn() {
    if (actionLoading || activeShift) return;

    if (!shift || !location) {
      Alert.alert("No assigned site", "There is no site shift available to clock into.");
      return;
    }

    const latitude = getLocationLatitude(location);
    const longitude = getLocationLongitude(location);
    const radius = getLocationRadius(location);

    if (latitude == null || longitude == null || !radius) {
      Alert.alert("Location incomplete", "This assigned site is missing geofence settings.");
      return;
    }

    try {
      setActionLoading(true);

      const position = await getVerifiedPosition();
      if (!position) return;

      const distance = getDistance(
        position.coords.latitude,
        position.coords.longitude,
        latitude,
        longitude
      );

      if (distance > radius + GEOFENCE_BUFFER_METERS) {
        Alert.alert(
          "Outside allowed area",
          `You are ${Math.round(distance)}m from ${location.name}. The allowed radius is ${Math.round(radius)}m.`
        );
        return;
      }

      const response = await API.post("/shifts/clock-in", {
        location_id: location.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        shift_type: "scheduled",
        verified: true,
      });

      const nextShift = response.data?.shift || response.data;
      setActiveShift(nextShift);

      const started = await startTracking({
        shiftId: nextShift.id,
        userId: user.id,
        companyId: user.company_id,
      });
      setTrackingActive(started);

      await pingCurrentLocation(position.coords);
    } catch (clockInError) {
      const message =
        clockInError.response?.data?.error ||
        clockInError.response?.data?.message ||
        clockInError.message ||
        "Clock in failed.";
      Alert.alert("Clock in failed", message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClockOut() {
    if (actionLoading || !activeShift) return;

    try {
      setActionLoading(true);

      const position =
        permissionStatus === "granted"
          ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          : null;

      if (position) setCurrentLocation(position);

      await API.post("/shifts/clock-out", {
        clock_out_lat: position?.coords.latitude,
        clock_out_lng: position?.coords.longitude,
      });

      await stopTracking();
      setTrackingActive(false);
      setActiveShift(null);
    } catch (clockOutError) {
      const message =
        clockOutError.response?.data?.error ||
        clockOutError.response?.data?.message ||
        clockOutError.message ||
        "Clock out failed.";
      Alert.alert("Clock out failed", message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
          <Text style={styles.loadingTitle}>Loading clock in</Text>
          <Text style={styles.loadingText}>Checking shift, location and tracking state...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const insideText =
    geofence.distance === null
      ? "Location check pending"
      : geofence.inside
        ? "Inside geofence"
        : "Outside geofence";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClockIn({ refreshing: true })}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
      >
        <View style={styles.headerCard}>
          <Text style={styles.dateText}>{formatDate(currentTime)}</Text>
          <Text style={styles.clockText}>
            {currentTime.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </Text>
          <View style={styles.privacyPill}>
            <Ionicons
              name={activeShift ? "radio-outline" : "shield-checkmark-outline"}
              size={15}
              color={activeShift ? "#86efac" : "#a5b4fc"}
            />
            <Text style={styles.privacyText}>
              {activeShift ? "Location tracking is active" : "Tracking starts only after clock-in"}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={24} color="#fecaca" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <SectionHeader icon="briefcase-outline" title="Assigned Shift" />
          {shift ? (
            <>
              <Text style={styles.shiftTitle}>{shift.job_name || shift.title || "Scheduled Shift"}</Text>
              <InfoRow icon="location-outline" label="Site" value={getLocationName(shift)} />
              <View style={styles.metricGrid}>
                <Metric label="Start" value={formatTime(getShiftStart(shift))} />
                <Metric label="End" value={formatTime(getShiftEnd(shift))} />
                <Metric label="Total" value={getShiftHours(shift)} accent />
              </View>
            </>
          ) : (
            <EmptyInline
              icon="calendar-clear-outline"
              title="No assigned shift today"
              text="Clock-in requires an assigned site shift with geofence data."
            />
          )}
        </View>

        <View style={styles.card}>
          <SectionHeader icon="navigate-outline" title="Geofence" />
          <View style={styles.geofenceStatus}>
            <View
              style={[
                styles.geofenceDot,
                {
                  backgroundColor:
                    geofence.distance === null ? "#f59e0b" : geofence.inside ? "#22c55e" : "#ef4444",
                },
              ]}
            />
            <View style={styles.geofenceBody}>
              <Text style={styles.geofenceTitle}>{insideText}</Text>
              <Text style={styles.geofenceText}>
                {geofence.distance === null
                  ? "Enable location to calculate distance from the assigned site."
                  : `${Math.round(geofence.distance)}m away · radius ${Math.round(geofence.radius || 0)}m`}
              </Text>
            </View>
          </View>
          {permissionStatus !== "granted" ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={requestLocationPermission}>
              <Ionicons name="locate-outline" size={19} color="#c7d2fe" />
              <Text style={styles.secondaryButtonText}>Enable Location Check</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <SectionHeader icon="map-outline" title="Route / Path" />
          {routeStops.length ? (
            routeStops.map((stop, index) => (
              <View key={`${stop.id || stop.name || index}`} style={styles.routeStop}>
                <View style={styles.routeIndex}>
                  <Text style={styles.routeIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.routeText} numberOfLines={2}>
                  {stop.name || stop.address || `Stop ${index + 1}`}
                </Text>
              </View>
            ))
          ) : (
            <EmptyInline
              icon="git-branch-outline"
              title="No route assigned"
              text="Backend route/path fields are not currently available for this shift."
            />
          )}
        </View>

        <View style={styles.card}>
          <SectionHeader icon="pulse-outline" title="Current Status" />
          <View style={styles.statusGrid}>
            <StatusItem
              label="Clock"
              value={activeShift ? "Clocked in" : "Clocked out"}
              active={!!activeShift}
            />
            <StatusItem
              label="Elapsed"
              value={activeShift ? formatDuration(elapsedSeconds) : "0m 0s"}
              active={!!activeShift}
            />
            <StatusItem
              label="Tracking"
              value={trackingActive ? "Active" : "Off"}
              active={trackingActive}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, activeShift && styles.clockOutButton]}
          onPress={activeShift ? handleClockOut : handleClockIn}
          disabled={actionLoading || (!activeShift && (!shift || !location))}
          activeOpacity={0.82}
        >
          {actionLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons
                name={activeShift ? "log-out-outline" : "log-in-outline"}
                size={24}
                color="#ffffff"
              />
              <Text style={styles.primaryButtonText}>
                {activeShift ? "Clock Out" : "Clock In"}
              </Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#a5b4fc" />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
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

function Metric({ label, value, accent = false }) {
  return (
    <View style={[styles.metric, accent && styles.metricAccent]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatusItem({ label, value, active }) {
  return (
    <View style={[styles.statusItem, active && styles.statusItemActive]}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, active && styles.statusValueActive]}>{value}</Text>
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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 36,
    backgroundColor: "#020617",
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
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 20,
    marginBottom: 16,
  },

  dateText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "800",
  },

  clockText: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    marginTop: 6,
  },

  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273449",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },

  privacyText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 7,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3f1018",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    padding: 14,
    marginBottom: 16,
  },

  errorText: {
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    marginLeft: 10,
    flex: 1,
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

  metric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 11,
  },

  metricAccent: {
    borderColor: "#3730a3",
    backgroundColor: "#15173a",
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

  geofenceStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14,
  },

  geofenceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },

  geofenceBody: {
    flex: 1,
  },

  geofenceTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  geofenceText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },

  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3730a3",
    paddingVertical: 14,
    marginTop: 12,
  },

  secondaryButtonText: {
    color: "#c7d2fe",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
  },

  routeStop: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 12,
    marginBottom: 8,
  },

  routeIndex: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1b4b",
    marginRight: 10,
  },

  routeIndexText: {
    color: "#c7d2fe",
    fontSize: 13,
    fontWeight: "900",
  },

  routeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },

  statusGrid: {
    flexDirection: "row",
    gap: 9,
  },

  statusItem: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 11,
  },

  statusItemActive: {
    backgroundColor: "#052e16",
    borderColor: "#166534",
  },

  statusLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  statusValue: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },

  statusValueActive: {
    color: "#86efac",
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    borderRadius: 18,
    paddingVertical: 18,
    marginBottom: 16,
  },

  clockOutButton: {
    backgroundColor: "#dc2626",
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginLeft: 10,
  },

  missingCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#273449",
    padding: 14,
  },

  missingTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  missingText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
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
