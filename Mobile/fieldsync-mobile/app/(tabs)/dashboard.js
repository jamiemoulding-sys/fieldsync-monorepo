import { getTodayShift } from "../../utils/schedule";
import { getShifts } from "../../utils/shifts";
import { supabase } from "../../utils/supabase";
import { startShift, endShift, getActiveShift } from "../../utils/shiftsStorage";
import { startTracking, stopTracking } from "../../utils/locationTracking";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import API from "../../services/api";

export default function Dashboard() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);

  const [todayShift, setTodayShift] = useState(null);
  const [nextShift, setNextShift] = useState(null);
  const [nextHoliday, setNextHoliday] = useState(null);

  const [earnings, setEarnings] = useState(0);
  const [streak, setStreak] = useState(0);
  const [performance, setPerformance] = useState(100);

  const [insight, setInsight] = useState("");

  const [working, setWorking] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [currentShiftId, setCurrentShiftId] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const [locationId, setLocationId] = useState(null);

  const scale = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    if (loading) return;
    console.log("Dashboard fetch started");
    
    setLoading(true);

    try {
      const now = new Date();
      const nowISO = now.toISOString();

      const today = await getTodayShift();
      const history = await getShifts();

      setTodayShift(today);

      // Load local cached state temporarily during loading
      const localActiveShift = await getActiveShift();
      if (localActiveShift) {
        setCurrentShiftId(localActiveShift.id);
        setLocationId(localActiveShift.location_id);
        setWorking(true);
        setCheckedIn(true);
        setOnBreak(!!localActiveShift.break_started_at);
        
        if (localActiveShift.break_started_at) {
          const breakStart = new Date(localActiveShift.break_started_at);
          const elapsedSeconds = Math.floor((new Date() - breakStart) / 1000);
          setSeconds(elapsedSeconds);
        }
      }

      // Hydrate state from backend when online (replaces local state) - ONE TIME ONLY
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (token) {
          const { data: state } = await API.get('/shifts/state', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (state?.active_shift) {
            setCurrentShiftId(state.active_shift.id);
            setLocationId(state.active_shift.location_id);
            setWorking(true);
            setCheckedIn(true);
            setOnBreak(state.on_break || false);
            
            // Hydrate break timer from backend state
            if (state.on_break && state.active_shift.break_started_at) {
              const breakStart = new Date(state.active_shift.break_started_at);
              const elapsedSeconds = Math.floor((new Date() - breakStart) / 1000);
              setSeconds(elapsedSeconds);
            }
          } else {
            // Backend says no active shift, clear local state
            setCurrentShiftId(null);
            setLocationId(null);
            setWorking(false);
            setCheckedIn(false);
            setOnBreak(false);
            setSeconds(0);
          }
        }
      } catch (err) {
        console.log('Backend state sync failed, using local state:', err.message);
        // Don't retry - use local state and continue
      }

      const userRes = await supabase.auth.getUser();
      const user = userRes?.data?.user;

      if (user) {
        const { data: shifts } = await supabase
          .from("schedules")
          .select(`*, locations(name)`)
          .eq("user_id", user.id)
          .gte("start_time", nowISO)
          .order("start_time", { ascending: true })
          .limit(1);

        setNextShift(shifts?.[0] || null);

        const { data: holidays } = await supabase
          .from("holiday_requests")
          .select("*")
          .eq("user_id", user.id)
          .gte("start_date", nowISO.split("T")[0])
          .order("start_date", { ascending: true })
          .limit(1);

        setNextHoliday(holidays?.[0] || null);
      }

      // HOURS
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const weekShifts =
        history?.filter(
          (s) =>
            s.clock_in_time &&
            new Date(s.clock_in_time) > weekAgo
        ) || [];

      let hours = 0;
      weekShifts.forEach((s) => {
        if (!s.clock_out_time) return;

        hours +=
          (new Date(s.clock_out_time) -
            new Date(s.clock_in_time)) /
          3600000;
      });

      setEarnings(Math.round(hours * 10));

      // STREAK
      let currentStreak = 0;
      let checkDate = new Date();

      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().split("T")[0];

        const worked = history.some(
          (s) =>
            s.clock_in_time &&
            s.clock_in_time.startsWith(dateStr)
        );

        if (worked) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }

      setStreak(currentStreak);

      // PERFORMANCE
      let late = 0;
      let missed = 0;

      history.forEach((s) => {
        if (s.is_late) late++;
        if (!s.clock_in_time) missed++;
      });

      let score = 100 - late * 5 - missed * 10;
      if (score < 0) score = 0;

      setPerformance(score);

      // AI INSIGHT
      const shift = today || nextShift;

      let message = "✅ You're performing well";

      if (missed >= 2) message = "⚠️ Missed shifts detected";
      else if (late >= 3) message = "⚠️ Lateness trend building";
      else if (hours > 45) message = "⚠️ High workload this week";
      else if (currentStreak >= 5)
        message = "🔥 Strong work streak";

      if (shift?.locations) {
        const start = new Date(shift.start_time);
        const travelMinutes = 30;

        const leaveTime = new Date(
          start.getTime() - travelMinutes * 60000
        );

        message += ` • Leave by ${leaveTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      }

      setInsight(message);
      
      console.log("Dashboard fetch completed");
    } catch (err) {
      console.error("Dashboard fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    load();
  }, [load]);

  function getCountdown(shift) {
    if (!shift) return null;

    const diff = new Date(shift.start_time) - new Date();

    if (diff <= 0) return "Started";

    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    return `Starts in ${hrs}h ${mins}m`;
  }

  useEffect(() => {
    let interval;
    if (working) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [working]);

  function formatTime() {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }

  function pressIn() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }

  function pressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }

  async function handleMainAction() {
    if (loading || actionInProgress) return;

    setActionInProgress(true);

    if (!checkedIn) {
      setActionInProgress(false);
      return router.push("/(tabs)/clock-in");
    }

    if (!working) {
      const shift = await startShift(locationId || null);
      if (!shift) {
        setActionInProgress(false);
        return;
      }

      setCurrentShiftId(shift.id);
      setWorking(true);
      startTracking();
      setActionInProgress(false);
      return;
    }

    await endShift(currentShiftId);

    setWorking(false);
    setCheckedIn(false);
    setSeconds(0);
    setCurrentShiftId(null);

    stopTracking();
    setActionInProgress(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const shift = todayShift || nextShift;

    return (
    <View style={styles.screen}>
      {/* HEADER */}
      <View style={styles.fixedHeader}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logoLeft}
        />
        <Image
          source={require("../../assets/images/Zorvia.png")}
          style={styles.logoRight}
        />
      </View>

      {/* SCROLL */}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ height: 90 }} />

        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleMainAction}
            onPressIn={pressIn}
            onPressOut={pressOut}
            disabled={actionInProgress}
          >
            <Text style={styles.action}>
              {!checkedIn ? "Check In" : working ? "Clock Out" : "Start Shift"}
            </Text>

            {working && <Text style={styles.timer}>{formatTime()}</Text>}
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.performanceRow}>
          <View style={styles.performanceCard}>
            <Text style={styles.value}>£{earnings}</Text>
            <Text style={styles.label}>Earnings</Text>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.value}>🔥 {streak}</Text>
            <Text style={styles.label}>Streak</Text>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.value}>{performance}%</Text>
            <Text style={styles.label}>Score</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>AI Insight</Text>
          <Text style={styles.value}>{insight}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Next Shift</Text>

          {shift ? (
            <>
              <Text style={styles.title}>{shift.job_name}</Text>

              <Text style={styles.meta}>
                📍 {shift.locations?.name || "No location"}
              </Text>

              <Text style={styles.meta}>
                {new Date(shift.start_time).toLocaleString()}
              </Text>

              <Text style={styles.countdown}>
                {getCountdown(shift)}
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>No upcoming shift</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Next Holiday</Text>

          {nextHoliday ? (
            <Text style={styles.title}>
              {nextHoliday.start_date} → {nextHoliday.end_date}
            </Text>
          ) : (
            <Text style={styles.meta}>None booked</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 100,
    backgroundColor: "#020617",
  },

  logoLeft: {
    width: 200,
    height: 60,
    resizeMode: "contain",
  },

  logoRight: {
    width: 120,
    height: 40,
    resizeMode: "contain",
    opacity: 0.9,
  },

  button: {
    backgroundColor: "#0f172a",
    padding: 28,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#6366f1",
  },

  action: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
  },

  timer: {
    color: "#6366f1",
    marginTop: 8,
  },

  performanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },

  performanceCard: {
    backgroundColor: "#0f172a",
    padding: 18,
    borderRadius: 16,
    width: "31%",
    alignItems: "center",
  },

  card: {
    backgroundColor: "#0f172a",
    padding: 20,
    borderRadius: 18,
    marginBottom: 22,
  },

  value: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },

  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },

  label: {
    color: "#94a3b8",
    fontSize: 12,
  },

  meta: {
    color: "#cbd5e1",
    marginTop: 6,
    fontSize: 14,
  },

  countdown: {
    color: "#6366f1",
    marginTop: 8,
    fontWeight: "600",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
  },
});