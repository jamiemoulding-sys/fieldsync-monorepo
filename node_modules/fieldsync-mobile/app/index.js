import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../utils/supabase";

export default function Home() {
  const router = useRouter();

  const checkSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();

    if (data?.session) {
      router.replace("/(tabs)/dashboard");
    }
  }, [router]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>FieldSync</Text>

      <Text style={styles.subtitle}>Workforce & Field Tracking</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.buttonOutline}
        onPress={() => alert("Register coming soon")}
      >
        <Text style={styles.buttonOutlineText}>Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  logo: {
    fontSize: 36,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 10,
  },
  subtitle: {
    color: "#94a3b8",
    marginBottom: 40,
  },
  button: {
    width: "100%",
    backgroundColor: "#6366f1",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  buttonOutline: {
    width: "100%",
    borderColor: "#6366f1",
    borderWidth: 1,
    padding: 15,
    borderRadius: 12,
  },
  buttonOutlineText: {
    color: "#6366f1",
    textAlign: "center",
    fontWeight: "600",
  },
});
