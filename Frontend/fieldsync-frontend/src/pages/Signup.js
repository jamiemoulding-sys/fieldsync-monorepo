// src/pages/Signup.js
// FULL FIXED MASTER TRIAL VERSION
// ✅ 14 day trial on every signup
// ✅ correct billing values
// ✅ production ready
// ✅ no fake free plan
// ✅ ready for App.js lock system

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import supabase from "../lib/supabase";

import {
  Mail,
  Lock,
  Building2,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
  });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    });
  }

  function validPassword(pw) {
    return (
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[0-9]/.test(pw)
    );
  }

  async function handleSignup(e) {
    e.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    const email =
      form.email.trim().toLowerCase();

    const company =
      form.companyName.trim();

    if (
      !email ||
      !form.password ||
      !form.confirmPassword ||
      !company
    ) {
      return setError(
        "Please fill all fields"
      );
    }

    if (
      !validPassword(
        form.password
      )
    ) {
      return setError(
        "Password must be 8+ chars, include capital + number"
      );
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      return setError(
        "Passwords do not match"
      );
    }

    try {
      setLoading(true);

      const {
        data,
        error,
      } =
        await supabase.auth.signUp(
          {
            email,
            password:
              form.password,
            options: {
              emailRedirectTo:
                window.location
                  .origin +
                "/accept-invite",
            },
          }
        );

      if (error) throw error;

      const authUser =
        data?.user;

      if (!authUser) {
        throw new Error(
          "Could not create account"
        );
      }

      await new Promise((r) =>
        setTimeout(r, 1200)
      );

      await supabase.auth.getSession();

      const trialEnd =
        new Date(
          Date.now() +
            14 *
              24 *
              60 *
              60 *
              1000
        ).toISOString();

      const {
        data: companyRow,
        error:
          companyError,
      } =
        await supabase
          .from("companies")
          .insert({
            name: company,
            owner_id:
              authUser.id,

            is_pro: false,

            current_plan:
              "trial",

            subscription_status:
              "trialing",

            trial_ends_at:
              trialEnd,
          })
          .select()
          .single();

      if (companyError)
        throw companyError;

      const {
        error:
          profileError,
      } =
        await supabase
          .from("users")
          .insert({
            id: authUser.id,
            email,
            name: "Owner",
            role: "admin",
            phone: "",
            job_title:
              "Owner",
            company_id:
              companyRow.id,
          });

      if (profileError)
        throw profileError;

      setSuccess(
        "Workspace created • 14 day trial started"
      );

      setTimeout(() => {
        navigate("/login");
      }, 1800);
    } catch (err) {
      setError(
        err?.message ||
          "Signup failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-6">

      <motion.div
        initial={{
          opacity: 0,
          y: 20,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        className="w-full max-w-md rounded-3xl p-[1px] bg-gradient-to-b from-white/15 to-transparent"
      >
        <div className="bg-[#020617] border border-white/10 rounded-3xl p-8">

          <div className="text-center mb-8">

            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-5">
              <Sparkles size={28} />
            </div>

            <h1 className="text-3xl font-semibold">
              Create Workspace
            </h1>

            <p className="text-sm text-gray-400 mt-3">
              Start your 14 day full access trial
            </p>

          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 text-green-400 text-sm flex items-center gap-2">
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}

          <form
            onSubmit={
              handleSignup
            }
            className="space-y-4"
          >
            <Input
              icon={
                <Mail size={16} />
              }
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={
                handleChange
              }
            />

            <Input
              icon={
                <Lock size={16} />
              }
              type="password"
              name="password"
              placeholder="Password"
              value={
                form.password
              }
              onChange={
                handleChange
              }
            />

            <Input
              icon={
                <Lock size={16} />
              }
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={
                form.confirmPassword
              }
              onChange={
                handleChange
              }
            />

            <Input
              icon={
                <Building2 size={16} />
              }
              type="text"
              name="companyName"
              placeholder="Company Name"
              value={
                form.companyName
              }
              onChange={
                handleChange
              }
            />

            <button
              type="submit"
              disabled={
                loading
              }
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl flex items-center justify-center gap-2 font-medium"
            >
              {loading ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <ArrowRight size={16} />
              )}

              {loading
                ? "Creating..."
                : "Start Free Trial"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            Already have account?{" "}
            <Link
              to="/login"
              className="text-indigo-400"
            >
              Login
            </Link>
          </div>

        </div>
      </motion.div>

    </div>
  );
}

function Input({
  icon,
  ...props
}) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-4 text-gray-500">
        {icon}
      </div>

      <input
        {...props}
        required
        className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-indigo-500"
      />
    </div>
  );
}