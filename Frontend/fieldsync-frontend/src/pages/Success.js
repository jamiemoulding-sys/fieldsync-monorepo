import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ArrowRight,
  LayoutDashboard,
  CreditCard,
  Sparkles,
  Crown,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";

export default function Success() {
  const navigate = useNavigate();

  const [daysLeft, setDaysLeft] =
    useState(14);

  useEffect(() => {
    const timer =
      setInterval(() => {
        setDaysLeft((prev) =>
          prev > 1
            ? prev - 1
            : 14
        );
      }, 86400000);

    return () =>
      clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-6 relative overflow-hidden">

      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] bg-green-500/10 blur-3xl rounded-full" />

        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 blur-3xl rounded-full" />
      </div>

      <motion.div
        initial={{
          opacity: 0,
          y: 25,
          scale: 0.98,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        transition={{
          duration: 0.4,
        }}
        className="relative z-10 w-full max-w-2xl rounded-3xl p-[1px] bg-gradient-to-b from-white/15 to-transparent"
      >
        <div className="bg-[#020617]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center">

          {/* ICON */}
          <div className="w-20 h-20 rounded-3xl bg-green-500/10 text-green-400 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2
              size={38}
            />
          </div>

          {/* STATUS */}
          <div className="inline-flex px-4 py-1 rounded-full bg-green-500/10 text-green-300 text-xs mb-5">
            Trial Activated
          </div>

          {/* TITLE */}
          <h1 className="text-4xl font-semibold tracking-tight">
            Welcome To Premium
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed max-w-xl mx-auto mt-4">
            Your 14 day full access
            trial has started.
            All premium features
            are now unlocked.
          </p>

          {/* PLAN BOX */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8">

            <InfoCard
              icon={
                <CalendarDays
                  size={18}
                />
              }
              title="Trial Remaining"
              value={`${daysLeft} Days`}
            />

            <InfoCard
              icon={
                <Crown
                  size={18}
                />
              }
              title="Current Plan"
              value="Premium"
            />

            <InfoCard
              icon={
                <ShieldCheck
                  size={18}
                />
              }
              title="Status"
              value="Active"
            />

          </div>

          {/* FEATURES */}
          <div className="grid sm:grid-cols-3 gap-3 mt-8">

            <Feature text="Reports & analytics" />

            <Feature text="Unlimited staff tools" />

            <Feature text="Priority support" />

          </div>

          {/* TRUST */}
          <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 mt-8 text-sm text-indigo-200">
            No payment taken today.
            You can cancel anytime
            during trial.
          </div>

          {/* ACTIONS */}
          <div className="grid sm:grid-cols-2 gap-4 mt-8">

            <button
              onClick={() =>
                navigate(
                  "/dashboard"
                )
              }
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition font-medium flex items-center justify-center gap-2"
            >
              <LayoutDashboard
                size={18}
              />
              Go To Dashboard
            </button>

            <button
              onClick={() =>
                navigate(
                  "/billing"
                )
              }
              className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition font-medium flex items-center justify-center gap-2"
            >
              <CreditCard
                size={18}
              />
              Manage Billing
            </button>

          </div>

          {/* FOOTER */}
          <button
            onClick={() =>
              navigate(
                "/dashboard"
              )
            }
            className="mt-6 text-sm text-gray-400 hover:text-white transition inline-flex items-center gap-2"
          >
            Continue to workspace
            <ArrowRight
              size={15}
            />
          </button>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-indigo-300">
            <Sparkles
              size={14}
            />
            Premium access unlocked
          </div>

        </div>
      </motion.div>

    </div>
  );
}

/* COMPONENTS */

function Feature({
  text,
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-300 text-center">
      {text}
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="text-indigo-400 flex justify-center mb-2">
        {icon}
      </div>

      <p className="text-xs text-gray-400">
        {title}
      </p>

      <h3 className="text-lg font-semibold mt-1">
        {value}
      </h3>
    </div>
  );
}