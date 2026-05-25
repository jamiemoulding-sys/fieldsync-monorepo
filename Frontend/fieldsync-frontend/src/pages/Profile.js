// src/pages/Profile.js
// FINAL SIMPLE PRICING VERSION
// ✅ Nothing removed
// ✅ Keeps save profile logic
// ✅ Keeps logout
// ✅ Fixes wrong PRO badge
// ✅ Shows real current plan
// ✅ Shows trial correctly
// ✅ Cleaner subscription status
// ✅ Matches new all-features pricing model
// ✅ Full copy / paste ready

import {
  useMemo,
  useState,
  useEffect,
} from "react";

import { useAuth } from "../hooks/useAuth";
import { motion } from "framer-motion";
import { authAPI } from "../services/api";

import {
  User,
  Phone,
  Building2,
  Briefcase,
  Mail,
  Shield,
  Crown,
  Save,
  LogOut,
  CheckCircle2,
  Camera,
  Clock3,
  Loader2,
  CreditCard,
  Sparkles,
} from "lucide-react";

export default function Profile() {
  const {
    user,
    reloadUser,
    logout,
    plan,
    trialActive,
  } = useAuth();

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [company, setCompany] =
    useState("");

  const [jobTitle, setJobTitle] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [success, setSuccess] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const profile =
        await authAPI.me();

      if (!profile) return;

      setName(profile?.name || "");
      setPhone(profile?.phone || "");
      setJobTitle(
        profile?.job_title || ""
      );

      setCompany(
        profile?.company_name ||
          profile?.companyName ||
          ""
      );
    } catch (err) {
      console.error(err);

      setError(
        "Failed to load profile"
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    try {
      setSaving(true);
      setSuccess("");
      setError("");

      await authAPI.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        companyName: company.trim(),
      });

      await reloadUser?.();

      setSuccess(
        "Profile updated successfully"
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to save profile"
      );
    } finally {
      setSaving(false);
    }
  }

  const profileScore =
    useMemo(() => {
      return (
        [
          name,
          phone,
          company,
          jobTitle,
        ].filter(
          (x) =>
            x &&
            x.trim()
        ).length * 25
      );
    }, [
      name,
      phone,
      company,
      jobTitle,
    ]);

  const initials = (
    name ||
    user?.email ||
    "U"
  )
    .charAt(0)
    .toUpperCase();

  const planName =
    (
      plan ||
      user?.currentPlan ||
      "starter"
    ).toUpperCase();

  const statusText =
    user?.subscription_status ===
    "active"
      ? "ACTIVE"
      : trialActive
      ? "TRIAL"
      : "INACTIVE";

  if (loading) {
    return (
      <div className="text-gray-400 flex items-center gap-2">
        <Loader2
          size={16}
          className="animate-spin"
        />
        Loading profile...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* HERO */}
      <div className="rounded-3xl p-[1px] bg-gradient-to-r from-indigo-500/30 via-purple-500/20 to-transparent">

        <div className="bg-[#020617] border border-white/10 rounded-3xl p-6 md:p-8">

          <div className="flex justify-between gap-6 flex-wrap items-center">

            <div className="flex items-center gap-5">

              <div className="relative">

                <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-semibold">
                  {initials}
                </div>

                <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                  <Camera size={14} />
                </button>

              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-semibold">
                  {name ||
                    "Unnamed User"}
                </h1>

                <p className="text-gray-400 mt-1">
                  {user?.email}
                </p>

                <div className="flex gap-2 mt-3 flex-wrap">

                  <Badge
                    icon={
                      <Shield size={13} />
                    }
                    text={
                      user?.role?.toUpperCase() ||
                      "USER"
                    }
                  />

                  <Badge
                    icon={
                      <Crown size={13} />
                    }
                    text={`${planName} PLAN`}
                  />

                  {trialActive && (
                    <Badge
                      icon={
                        <Sparkles size={13} />
                      }
                      text="TRIAL ACTIVE"
                    />
                  )}

                </div>
              </div>

            </div>

            <div className="min-w-[260px]">

              <p className="text-sm text-gray-400">
                Profile Strength
              </p>

              <h2 className="text-4xl font-bold mt-2">
                {profileScore}%
              </h2>

              <div className="h-2 bg-white/5 rounded-full overflow-hidden mt-4">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{
                    width: `${profileScore}%`,
                  }}
                />
              </div>

              <p className="text-xs text-gray-500 mt-4 flex items-center gap-2">
                <Clock3 size={12} />
                Last Sign In:
                {" "}
                -
              </p>

            </div>

          </div>

        </div>

      </div>

      {success && (
        <Alert
          green
          text={success}
        />
      )}

      {error && (
        <Alert
          red
          text={error}
        />
      )}

      {/* SUBSCRIPTION */}
      <div className="grid md:grid-cols-3 gap-4">

        <ReadOnly
          icon={
            <CreditCard size={16} />
          }
          label="Current Plan"
          value={planName}
        />

        <ReadOnly
          icon={
            <Crown size={16} />
          }
          label="Status"
          value={statusText}
        />

        <ReadOnly
          icon={
            <Sparkles size={16} />
          }
          label="Features"
          value="All Features Included"
        />

      </div>

      {/* FORM */}
      <div className="grid md:grid-cols-2 gap-4">

        <Field
          icon={<User size={16} />}
          label="Full Name"
          value={name}
          onChange={setName}
          placeholder="Your full name"
        />

        <Field
          icon={<Phone size={16} />}
          label="Phone Number"
          value={phone}
          onChange={setPhone}
          placeholder="Phone number"
        />

        <Field
          icon={
            <Building2 size={16} />
          }
          label="Company Name"
          value={company}
          onChange={setCompany}
          placeholder="Company name"
        />

        <Field
          icon={
            <Briefcase size={16} />
          }
          label="Job Title"
          value={jobTitle}
          onChange={setJobTitle}
          placeholder="Owner / Manager / Staff"
        />

        <ReadOnly
          icon={<Mail size={16} />}
          label="Email"
          value={user?.email}
        />

        <ReadOnly
          icon={
            <Crown size={16} />
          }
          label="Access"
          value={
            trialActive
              ? "Trial Full Access"
              : "Paid Access"
          }
        />

      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 flex-wrap">

        <button
          onClick={saveProfile}
          disabled={saving}
          className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium flex items-center gap-2"
        >
          {saving ? (
            <Loader2
              size={16}
              className="animate-spin"
            />
          ) : (
            <Save size={16} />
          )}

          {saving
            ? "Saving..."
            : "Save Changes"}
        </button>

        <button
          onClick={logout}
          className="px-5 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-medium flex items-center gap-2"
        >
          <LogOut size={16} />
          Sign Out
        </button>

      </div>

    </div>
  );
}

/* COMPONENTS */

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <motion.div
      whileHover={{
        y: -3,
      }}
      className="rounded-2xl p-[1px] bg-gradient-to-b from-white/10 to-transparent"
    >
      <div className="bg-[#020617] border border-white/10 rounded-2xl p-4">

        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
          {icon}
          {label}
        </div>

        <input
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value
            )
          }
          placeholder={
            placeholder
          }
          className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
        />

      </div>
    </motion.div>
  );
}

function ReadOnly({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-2xl p-[1px] bg-gradient-to-b from-white/10 to-transparent">
      <div className="bg-[#020617] border border-white/10 rounded-2xl p-4">

        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
          {icon}
          {label}
        </div>

        <p className="text-white text-sm">
          {value || "-"}
        </p>

      </div>
    </div>
  );
}

function Badge({
  icon,
  text,
}) {
  return (
    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs flex items-center gap-2">
      {icon}
      {text}
    </div>
  );
}

function Alert({
  text,
  red,
  green,
}) {
  return (
    <div
      className={`rounded-2xl p-4 text-sm flex items-center gap-2 border ${
        red
          ? "bg-red-500/10 border-red-500/30 text-red-300"
          : "bg-green-500/10 border-green-500/30 text-green-300"
      }`}
    >
      <CheckCircle2 size={16} />
      {text}
    </div>
  );
}
