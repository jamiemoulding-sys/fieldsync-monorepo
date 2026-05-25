import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import supabase from "../lib/supabase";

import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Check,
} from "lucide-react";

export default function Login() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");

  /* =====================================
     LOAD SAVED LOGIN
  ===================================== */

  useEffect(() => {
    const savedEmail =
      localStorage.getItem("remember_email");

    const savedRemember =
      localStorage.getItem("remember_me");

    if (savedRemember === "true") {
      setRemember(true);
      setEmail(savedEmail || "");
    }
  }, []);

  /* =====================================
     LOGIN
  ===================================== */

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!email || !password) {
      return setError(
        "Enter email and password"
      );
    }

    try {
      setLoading(true);

      /* SAVE REMEMBER ME */
      if (remember) {
        localStorage.setItem(
          "remember_email",
          email.trim()
        );

        localStorage.setItem(
          "remember_me",
          "true"
        );
      } else {
        localStorage.removeItem(
          "remember_email"
        );

        localStorage.setItem(
          "remember_me",
          "false"
        );
      }

      await login(
        email.trim(),
        password
      );
    } catch (err) {
      setError(
        err.message ||
          "Invalid login details"
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================
     RESET PASSWORD
  ===================================== */

  const handleForgotPassword =
    async () => {
      try {
        setError("");

        if (!email) {
          return setError(
            "Enter your email first"
          );
        }

        setResetLoading(true);

        const { error } =
          await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
              redirectTo:
                `${window.location.origin}/reset-password`,
            }
          );

        if (error) throw error;

        alert(
          "Password reset email sent"
        );
      } catch (err) {
        setError(
          err.message ||
            "Could not send reset email"
        );
      } finally {
        setResetLoading(false);
      }
    };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-6 relative overflow-hidden">

      {/* BG */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-transparent to-cyan-500/10" />

      <motion.div
        initial={{
          opacity: 0,
          y: 20,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        className="relative z-10 w-full max-w-md rounded-3xl p-[1px] bg-gradient-to-b from-white/15 to-transparent"
      >
        <div className="bg-[#020617]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-8">

          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-5">
              <ShieldCheck size={28} />
            </div>

            <h1 className="text-3xl font-semibold">
              Welcome Back
            </h1>

            <p className="text-sm text-gray-400 mt-2">
              Sign in to access your workspace
            </p>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* FORM */}
          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >
            {/* EMAIL */}
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-4 top-4 text-gray-500"
              />

              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* PASSWORD */}
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-4 top-4 text-gray-500"
              />

              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* REMEMBER + RESET */}
            <div className="flex items-center justify-between gap-4">

              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() =>
                    setRemember(
                      !remember
                    )
                  }
                  className={`w-5 h-5 rounded border flex items-center justify-center transition ${
                    remember
                      ? "bg-indigo-600 border-indigo-600"
                      : "border-white/20 bg-white/5"
                  }`}
                >
                  {remember && (
                    <Check
                      size={13}
                    />
                  )}
                </button>

                Remember me
              </label>

              <button
                type="button"
                onClick={
                  handleForgotPassword
                }
                disabled={
                  resetLoading
                }
                className="text-sm text-indigo-400 hover:text-indigo-300"
              >
                {resetLoading
                  ? "Sending..."
                  : "Forgot Password?"}
              </button>
            </div>

            {/* LOGIN */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <ArrowRight
                  size={16}
                />
              )}

              {loading
                ? "Signing In..."
                : "Login"}
            </button>
          </form>

          {/* FOOTER */}
          <div className="mt-6 text-center text-sm text-gray-400">
            Don’t have an account?{" "}

            <Link
              to="/signup"
              className="text-indigo-400 hover:text-indigo-300"
            >
              Create one
            </Link>
          </div>

        </div>
      </motion.div>
    </div>
  );
}