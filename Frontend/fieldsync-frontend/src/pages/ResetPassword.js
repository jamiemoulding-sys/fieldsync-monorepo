import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import supabase from "../lib/supabase";

import {
  Lock,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] =
    useState("");

  const [confirm, setConfirm] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [ready, setReady] =
    useState(false);

  /* =====================================
     RESTORE SESSION FROM EMAIL LINK
  ===================================== */

  useEffect(() => {
    const boot = async () => {
      try {
        const hash =
          window.location.hash;

        if (
          hash &&
          hash.includes(
            "access_token"
          )
        ) {
          const params =
            new URLSearchParams(
              hash.replace(
                "#",
                ""
              )
            );

          const access_token =
            params.get(
              "access_token"
            );

          const refresh_token =
            params.get(
              "refresh_token"
            );

          if (
            access_token &&
            refresh_token
          ) {
            await supabase.auth.setSession(
              {
                access_token,
                refresh_token,
              }
            );
          }
        }

        setReady(true);
      } catch {
        setReady(true);
      }
    };

    boot();
  }, []);

  /* =====================================
     RESET PASSWORD
  ===================================== */

  const handleReset =
    async () => {
      try {
        if (
          !password ||
          !confirm
        ) {
          return alert(
            "Fill all fields"
          );
        }

        if (
          password.length <
          6
        ) {
          return alert(
            "Minimum 6 characters"
          );
        }

        if (
          password !==
          confirm
        ) {
          return alert(
            "Passwords do not match"
          );
        }

        setLoading(true);

        const {
          error,
        } =
          await supabase.auth.updateUser(
            {
              password,
            }
          );

        if (error)
          throw error;

        alert(
          "Password updated"
        );

        navigate(
          "/login"
        );
      } catch (err) {
        alert(
          err.message ||
            "Reset failed"
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-6 relative overflow-hidden">

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

          <div className="text-center mb-8">

            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-5">
              <ShieldCheck size={28} />
            </div>

            <h1 className="text-3xl font-semibold">
              Reset Password
            </h1>

            <p className="text-sm text-gray-400 mt-2">
              Choose a secure new password
            </p>

          </div>

          {!ready ? (
            <div className="text-center py-8 text-gray-400">
              Loading...
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Lock
                  size={16}
                  className="absolute left-4 top-4 text-gray-500"
                />

                <input
                  type="password"
                  placeholder="New Password"
                  value={
                    password
                  }
                  onChange={(e) =>
                    setPassword(
                      e.target
                        .value
                    )
                  }
                  className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="relative mb-6">
                <Lock
                  size={16}
                  className="absolute left-4 top-4 text-gray-500"
                />

                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={
                    confirm
                  }
                  onChange={(e) =>
                    setConfirm(
                      e.target
                        .value
                    )
                  }
                  className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={
                  handleReset
                }
                disabled={
                  loading
                }
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
                  ? "Saving..."
                  : "Update Password"}
              </button>
            </>
          )}

        </div>
      </motion.div>

    </div>
  );
}