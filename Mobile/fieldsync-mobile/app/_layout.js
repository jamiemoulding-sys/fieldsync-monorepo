import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function Layout() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function getInitialSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSession(session);
    setLoading(false);
  }

  // 🔥 prevent blank screen forever if something fails
  if (loading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="login" />
        )}
      </Stack>
    </GestureHandlerRootView>
  );
}