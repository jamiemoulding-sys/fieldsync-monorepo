import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { motion } from "framer-motion";
import {
  Crown,
  Check,
  ArrowLeft,
  Sparkles,
  Shield,
  BarChart3,
  Users,
  RefreshCw,
} from "lucide-react";

export default function Upgrade() {
  const navigate = useNavigate();
  const [loading, setLoading] =
    useState(false);

  const startCheckout = async () => {
    try {
      setLoading(true);

      const res = await api.post(
        "/billing/create-checkout-session"
      );

      if (!res.data?.url) {
        alert("Checkout unavailable");
        return;
      }

      window.location.href =
        res.data.url;

    } catch (err) {
      console.error(err);
      alert("Payment failed");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white px-6 py-10">

      <div className="max-w-6xl mx-auto space-y-8">

        {/* TOPBAR */}
        <div className="flex justify-between items-center">

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm flex items-center gap-2">
            <Crown size={14} />
            Upgrade Plan
          </div>

        </div>

        {/* HERO */}
        <div className="rounded-3xl p-[1px] bg-gradient-to-r from-indigo-500/40 via-purple-500/20 to-transparent">

          <div className="bg-[#020617] border border-white/10 rounded-3xl p-8 md:p-10">

            <div className="grid lg:grid-cols-2 gap-8 items-center">

              <div>
                <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                  Scale your workforce with
                  <span className="text-indigo-400">
                    {" "}Pro
                  </span>
                </h1>

                <p className="text-gray-400 mt-4 text-lg">
                  Unlock advanced tools,
                  automation, premium reports
                  and faster operations.
                </p>

                <div className="flex gap-3 mt-6 flex-wrap">
                  <MiniBadge
                    text="No setup fees"
                  />
                  <MiniBadge
                    text="Cancel anytime"
                  />
                  <MiniBadge
                    text="Secure billing"
                  />
                </div>

              </div>

              <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-8">

                <p className="text-gray-400 text-sm">
                  Starting at
                </p>

                <h2 className="text-6xl font-bold mt-2">
                  £6
                </h2>

                <p className="text-gray-400 mt-2">
                  per employee / month
                </p>

                <button
                  onClick={
                    startCheckout
                  }
                  disabled={loading}
                  className="w-full mt-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 font-semibold flex items-center justify-center gap-2 transition"
                >
                  {loading ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <Sparkles
                        size={16}
                      />
                      Start Subscription
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  Powered by Stripe
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* FEATURES */}
        <div className="grid md:grid-cols-3 gap-4">

          <Feature
            icon={<Users size={18} />}
            title="Unlimited Staff"
            text="Grow your team without restrictions."
          />

          <Feature
            icon={
              <BarChart3 size={18} />
            }
            title="Advanced Analytics"
            text="Track labour, trends and productivity."
          />

          <Feature
            icon={<Shield size={18} />}
            title="Priority Support"
            text="Faster assistance when needed."
          />

        </div>

        {/* BENEFITS */}
        <motion.div
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="rounded-3xl bg-[#020617] border border-white/10 p-8"
        >
          <h3 className="text-2xl font-semibold">
            Everything in Pro
          </h3>

          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {[
              "Unlimited employees",
              "Multiple locations",
              "Live workforce tracking",
              "Performance rankings",
              "Reports & exports",
              "Future premium features",
            ].map((item) => (
              <Benefit
                key={item}
                text={item}
              />
            ))}
          </div>

        </motion.div>

      </div>

    </div>
  );
}

/* COMPONENTS */

function Feature({
  icon,
  title,
  text,
}) {
  return (
    <div className="rounded-2xl bg-[#020617] border border-white/10 p-5">
      <div className="text-indigo-400">
        {icon}
      </div>

      <h3 className="font-medium mt-3">
        {title}
      </h3>

      <p className="text-sm text-gray-400 mt-2">
        {text}
      </p>
    </div>
  );
}

function Benefit({ text }) {
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
      <div className="w-7 h-7 rounded-full bg-green-500/15 text-green-400 flex items-center justify-center">
        <Check size={14} />
      </div>

      <span className="text-sm">
        {text}
      </span>
    </div>
  );
}

function MiniBadge({
  text,
}) {
  return (
    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
      {text}
    </div>
  );
}