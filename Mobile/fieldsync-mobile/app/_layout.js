import { Stack } from "expo-router";
import { Component, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { isSupabaseConfigured, supabase } from "../utils/supabase";

class StartupErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("FieldSync startup error:", error?.message || error);
  }

  render() {
    if (this.state.error) {
      return (
        <StartupFallback
          title="FieldSync could not start"
          message="Please close and reopen the app. If this continues, contact support."
        />
      );
    }

    return this.props.children;
  }
}

function StartupFallback({ title, message, actionLabel, onAction }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.fallbackScreen}>
        <Text style={styles.fallbackTitle}>{title}</Text>
        <Text style={styles.fallbackMessage}>{message}</Text>
        {onAction ? (
          <TouchableOpacity style={styles.fallbackButton} onPress={onAction}>
            <Text style={styles.fallbackButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

function LayoutContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState("");

  async function getInitialSession() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
    } catch (error) {
      console.error("FieldSync initial session failed:", error?.message || error);
      setStartupError("Could not load your session. Please sign in again.");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStartupError("Missing Supabase configuration for this build.");
      setLoading(false);
      return undefined;
    }

    getInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="#ffffff" size="large" />
          <Text style={styles.loadingText}>Starting FieldSync</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (startupError) {
    return (
      <StartupFallback
        title="Startup check failed"
        message={startupError}
        actionLabel="Try Again"
        onAction={() => {
          setStartupError("");
          setLoading(true);
          getInitialSession();
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {session ? <Stack.Screen name="(tabs)" /> : <Stack.Screen name="login" />}
      </Stack>
    </GestureHandlerRootView>
  );
}

export default function Layout() {
  return (
    <StartupErrorBoundary>
      <LayoutContent />
    </StartupErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    padding: 24,
  },
  loadingText: {
    color: "#cbd5e1",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
  },
  fallbackScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    padding: 24,
  },
  fallbackTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  fallbackMessage: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: "center",
  },
  fallbackButton: {
    backgroundColor: "#6366f1",
    borderRadius: 14,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  fallbackButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
});
