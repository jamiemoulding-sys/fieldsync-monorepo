import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Component } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

class TabErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Screen unavailable</Text>
          <Text style={styles.errorText}>
            Please sign in again or restart FieldSync.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function TabLayout() {
  return (
    <TabErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#0B1220",
            borderTopColor: "#1f2937",
          },
          tabBarActiveTintColor: "#6366f1",
          tabBarInactiveTintColor: "#6b7280",
        }}
      >

      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="shifts"
        options={{
          title: "Shifts",
          tabBarIcon: ({ color }) => (
            <Ionicons name="time" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="clock-in"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="payslips"
        options={{
          title: "Payslips",
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="Profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={20} color={color} />
          ),
        }}
      />

      </Tabs>
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    padding: 24,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  errorText: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
});
