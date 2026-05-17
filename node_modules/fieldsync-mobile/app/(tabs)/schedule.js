import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { useEffect, useState, useRef, useCallback } from "react";
import { Calendar } from "react-native-calendars";
import { supabase } from "../../utils/supabase";
import { getCurrentUser } from "../../utils/session";

export default function Schedule() {
  const [view, setView] = useState("month");
  const [shifts, setShifts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState(true);
  const expandAnim = useRef(new Animated.Value(1)).current;

  // 🔥 HOLIDAY STATE
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reason, setReason] = useState("");

  const loadSchedule = useCallback(async () => {
    if (loading) return;
    console.log("Schedule fetch started");
    
    try {
      setLoading(true);

      const user = await getCurrentUser();
      if (!user) return;

      const { data: shiftsData } = await supabase
        .from("schedules")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", user.company_id);

      const { data: locationsData } = await supabase
        .from("locations")
        .select("*")
        .eq("company_id", user.company_id);

      const merged = shiftsData.map((shift) => {
        const location = locationsData?.find(
          (l) => l.id === shift.location_id
        );

        return {
          ...shift,
          location,
        };
      });

      setShifts(merged);
      console.log("Schedule fetch completed");
    } catch (err) {
      console.error("Schedule fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  /* =========================
     HOLIDAY SUBMIT (FIXED)
  ========================= */
  async function submitHoliday() {
    const user = await getCurrentUser();
    if (!user) return;

    if (!startDate || !endDate) {
      alert("Select dates");
      return;
    }

    const { error } = await supabase.from("holiday_requests").insert([
      {
        user_id: user.id,
        company_id: user.company_id,
        start_date: startDate,
        end_date: endDate,
        status: "pending",
        type: "holiday",
        reason: reason || null,
        half_day: false,
      },
    ]);

    if (error) {
      console.log(error);
      alert("Failed to submit");
      return;
    }

    setShowModal(false);
    setStartDate(null);
    setEndDate(null);
    setReason("");

    alert("Holiday request sent");
  }

  /* =========================
     HELPERS
  ========================= */
  function getDateKey(date) {
    return date.split("T")[0];
  }

  function getShiftsForDay(date) {
    return shifts.filter(
      (s) => getDateKey(s.start_time) === date
    );
  }

  function getWeekDates() {
    const base = selectedDate ? new Date(selectedDate) : new Date();

    const start = new Date(base);
    start.setDate(base.getDate() - base.getDay());

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  function getMarkedDates() {
    const marks = {};

    shifts.forEach((shift) => {
      const date = getDateKey(shift.start_time);

      marks[date] = {
        marked: true,
        dotColor: "#6366f1",
      };
    });

    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] || {}),
        selected: true,
        selectedColor: "#6366f1",
      };
    }

    return marks;
  }

  function toggleExpand() {
    Animated.timing(expandAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();

    setExpanded(!expanded);
  }

  const height = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 260],
  });

  /* =========================
     UI
  ========================= */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.meta}>Loading schedule...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule</Text>

      {/* VIEW SWITCH */}
      <View style={styles.switch}>
        {["month", "week", "list"].map((v) => (
          <TouchableOpacity
            key={v}
            style={[
              styles.switchBtn,
              view === v && styles.activeBtn,
            ]}
            onPress={() => setView(v)}
          >
            <Text style={styles.switchText}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* MONTH */}
      {view === "month" && (
        <Calendar
          markedDates={getMarkedDates()}
          onDayPress={(d) => setSelectedDate(d.dateString)}
          style={styles.calendar}
          theme={{
            calendarBackground: "#020617",
            dayTextColor: "#fff",
            monthTextColor: "#fff",
            arrowColor: "#6366f1",
          }}
        />
      )}

      {/* WEEK */}
      {view === "week" && (
        <View style={styles.week}>
          {getWeekDates().map((date) => (
            <TouchableOpacity
              key={date}
              style={[
                styles.weekDay,
                selectedDate === date && styles.activeDay,
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={styles.weekText}>
                {date.slice(8, 10)}
              </Text>

              {getShiftsForDay(date).length > 0 && (
                <View style={styles.dot} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* LIST */}
      {view === "list" && (
        <ScrollView>
          {shifts.map((shift) => (
            <View key={shift.id} style={styles.shiftCard}>
              <Text style={styles.shiftTitle}>
                {shift.job_name || "Shift"}
              </Text>

              <Text style={styles.meta}>
                📍 {shift.location?.name || "Unknown"}
              </Text>

              <Text style={styles.meta}>
                {new Date(shift.start_time).toLocaleString()}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* DAY DETAILS */}
      {selectedDate && view !== "list" && (
        <>
          <TouchableOpacity onPress={toggleExpand}>
            <Text style={styles.dayTitle}>
              {selectedDate}
            </Text>
          </TouchableOpacity>

          <Animated.View style={{ height, overflow: "hidden" }}>
            {getShiftsForDay(selectedDate).length === 0 ? (
              <Text style={styles.meta}>
                No shifts for this day
              </Text>
            ) : (
              getShiftsForDay(selectedDate).map((shift) => (
                <View key={shift.id} style={styles.shiftCard}>
                  <Text style={styles.shiftTitle}>
                    {shift.job_name || "Shift"}
                  </Text>

                  <Text style={styles.meta}>
                    📍 {shift.location?.name || "Unknown"}
                  </Text>

                  <Text style={styles.meta}>
                    {new Date(
                      shift.start_time
                    ).toLocaleTimeString()}{" "}
                    -{" "}
                    {new Date(
                      shift.end_time
                    ).toLocaleTimeString()}
                  </Text>
                </View>
              ))
            )}
          </Animated.View>
        </>
      )}

      {/* 🔥 HOLIDAY BUTTON (RESTORED) */}
      <TouchableOpacity
        style={styles.holidayBtn}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.holidayText}>
          Request Holiday
        </Text>
      </TouchableOpacity>

      {/* 🔥 HOLIDAY MODAL */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalBox}>
            <Calendar
              onDayPress={(d) => {
                if (!startDate) return setStartDate(d.dateString);
                if (!endDate) return setEndDate(d.dateString);
                setStartDate(d.dateString);
                setEndDate(null);
              }}
              markedDates={{
                [startDate]: {
                  selected: true,
                  selectedColor: "#22c55e",
                },
                [endDate]: {
                  selected: true,
                  selectedColor: "#ef4444",
                },
              }}
            />

            <Text style={styles.selected}>
              From: {startDate || "-"}
            </Text>
            <Text style={styles.selected}>
              To: {endDate || "-"}
            </Text>

            <TextInput
              placeholder="Reason (optional)"
              placeholderTextColor="#64748b"
              style={styles.input}
              value={reason}
              onChangeText={setReason}
            />

            <TouchableOpacity onPress={submitHoliday}>
              <Text style={styles.submit}>Submit</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
    paddingTop: 80,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 20,
  },

  switch: {
    flexDirection: "row",
    marginBottom: 20,
  },

  switchBtn: {
    padding: 10,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: "#0f172a",
  },

  activeBtn: {
    backgroundColor: "#6366f1",
  },

  switchText: {
    color: "#fff",
  },

  calendar: {
    borderRadius: 12,
  },

  week: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  weekDay: {
    padding: 10,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    alignItems: "center",
    width: 40,
  },

  activeDay: {
    backgroundColor: "#6366f1",
  },

  weekText: {
    color: "#fff",
  },

  dot: {
    width: 6,
    height: 6,
    backgroundColor: "#6366f1",
    borderRadius: 3,
    marginTop: 4,
  },

  dayTitle: {
    color: "#fff",
    marginTop: 20,
    fontWeight: "700",
  },

  shiftCard: {
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },

  shiftTitle: {
    color: "#fff",
    fontWeight: "700",
  },

  meta: {
    color: "#64748b",
    marginTop: 4,
  },

  holidayBtn: {
    backgroundColor: "#6366f1",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
  },

  holidayText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },

  modal: {
    flex: 1,
    backgroundColor: "#000000aa",
    justifyContent: "center",
    padding: 20,
  },

  modalBox: {
    backgroundColor: "#0f172a",
    padding: 20,
    borderRadius: 16,
  },

  selected: {
    color: "#fff",
    marginTop: 10,
  },

  input: {
    backgroundColor: "#020617",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },

  submit: {
    color: "#4ade80",
    marginTop: 15,
    fontWeight: "700",
  },

  cancel: {
    color: "#f87171",
    marginTop: 10,
  },
});