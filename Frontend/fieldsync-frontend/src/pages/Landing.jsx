import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Users,
  MapPinned,
  Shield,
  Clock3,
  Crown,
  Building2,
  Star,
  TrendingUp,
  Zap,
  Gem,
  Briefcase,
  BadgePoundSterling,
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  const stats = [
    { label: "Admin Hours Saved", value: "10+ / week" },
    { label: "Average Labour Saving", value: "18%" },
    { label: "Payroll Errors Reduced", value: "82%" },
    { label: "Fastest Rota Build", value: "< 5 mins" },
  ];

  const features = [
    {
      icon: <Clock3 size={18} />,
      title: "Live Attendance Control",
      text: "See who is clocked in, late, on break, absent or finished instantly.",
    },
    {
      icon: <Users size={18} />,
      title: "Smart Scheduling",
      text: "Create weekly rotas in minutes with clean visibility.",
    },
    {
      icon: <MapPinned size={18} />,
      title: "GPS Clock In",
      text: "Prevent fake clock-ins and verify exact site attendance.",
    },
    {
      icon: <BarChart3 size={18} />,
      title: "Real-Time Reports",
      text: "Track wages, overtime, labour cost and profitability live.",
    },
    {
      icon: <Shield size={18} />,
      title: "Secure Roles",
      text: "Admin, manager and employee permissions built in.",
    },
    {
      icon: <Zap size={18} />,
      title: "Everything Included",
      text: "No upsells. Every plan includes every feature.",
    },
  ];

  const pricing = [
    {
      name: "Starter",
      price: "£49",
      included: "5 staff included",
      extra: "+ £7 each extra employee",
      icon: <Users size={18} />,
      featured: false,
    },
    {
      name: "Pro",
      price: "£89",
      included: "15 staff included",
      extra: "+ £6 each extra employee",
      icon: <Crown size={18} />,
      featured: true,
    },
    {
      name: "Business",
      price: "£149",
      included: "30 staff included",
      extra: "+ £5 each extra employee",
      icon: <Building2 size={18} />,
      featured: false,
    },
  ];

  const included = [
    "Scheduling",
    "Clock In / Out",
    "GPS Tracking",
    "Holiday Manager",
    "Timesheets",
    "Tasks",
    "Announcements",
    "Reports",
    "Payroll Export",
    "Employee App",
    "Offline Mode",
    "Live Dashboard",
    "Unlimited Managers",
    "Notifications",
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-hidden">
      {/* BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-indigo-600/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-cyan-500/10 blur-3xl rounded-full" />
      </div>

      {/* NAVBAR */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img
            src="/logo192.png"
            alt="FieldSync"
            className="w-12 h-12 rounded-2xl shadow-xl"
          />

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              FieldSync
            </h1>
            <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
              Workforce OS
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 rounded-xl text-sm hover:bg-white/5"
          >
            Login
          </button>

          <button
            onClick={() => navigate("/signup")}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium shadow-lg shadow-indigo-500/20"
          >
            Start Free Trial
          </button>
        </div>
      </div>

      {/* HERO */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-28">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex px-4 py-2 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-xs mb-6">
              Trusted by growing UK companies
            </div>

            <h1 className="text-5xl md:text-7xl font-semibold leading-tight tracking-tight">
              Run your workforce
              <br />
              <span className="text-indigo-400">
                like a serious company
              </span>
            </h1>

            <p className="mt-6 text-lg text-gray-400 max-w-xl leading-relaxed">
              Scheduling, live attendance, payroll exports,
              holidays, reporting and workforce control in
              one premium platform.
            </p>

            <div className="mt-8 flex gap-4 flex-wrap">
              <button
                onClick={() => navigate("/signup")}
                className="px-7 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-medium flex items-center gap-2 shadow-xl shadow-indigo-500/20"
              >
                Start Free Trial
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => navigate("/login")}
                className="px-7 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10"
              >
                Login
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 text-sm">
              <MiniStat icon={<Clock3 size={16} />} text="Save 10+ admin hrs weekly" />
              <MiniStat icon={<BadgePoundSterling size={16} />} text="Reduce labour waste fast" />
              <MiniStat icon={<Users size={16} />} text="Scale teams with ease" />
              <MiniStat icon={<Shield size={16} />} text="Built for reliability" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl p-[1px] bg-gradient-to-b from-white/20 to-transparent"
          >
            <div className="bg-[#020617] border border-white/10 rounded-3xl p-6">
              <div className="grid grid-cols-2 gap-4">
                <Panel title="Clocked In" value="27" />
                <Panel title="Late Staff" value="2" />
                <Panel title="Sites Live" value="11" />
                <Panel title="Tasks Today" value="84" />
              </div>

              <div className="mt-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                <div className="flex items-center gap-2 text-emerald-300 text-sm">
                  <TrendingUp size={15} />
                  Efficiency up 19% this month
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* STATS */}
      <div className="relative z-10 border-y border-white/10 bg-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-3xl font-semibold">{item.value}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-semibold tracking-tight">
            Everything you need. Nothing extra to buy.
          </h2>

          <p className="text-gray-400 mt-4">
            Replace spreadsheets and multiple apps with one clean platform.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white/5 border border-white/10 p-6 hover:bg-white/[0.07] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                {item.icon}
              </div>

              <h3 className="font-medium text-lg">{item.title}</h3>

              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div className="relative z-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-semibold tracking-tight">
              Premium pricing. Full access included.
            </h2>

            <p className="text-gray-400 mt-4">
              No hidden upgrades • Cancel anytime • 14 day free trial
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl p-[1px] ${
                  plan.featured
                    ? "bg-gradient-to-b from-indigo-500/50 to-transparent"
                    : "bg-white/10"
                }`}
              >
                <div className="bg-[#020617] border border-white/10 rounded-3xl p-6 h-full">
                  <div className="flex items-center gap-2 text-indigo-400 text-sm">
                    {plan.icon}
                    {plan.name}
                  </div>

                  {plan.featured && (
                    <div className="mt-3 inline-flex px-3 py-1 rounded-full bg-indigo-500/10 text-xs text-indigo-300">
                      Most Popular
                    </div>
                  )}

                  <p className="text-5xl font-bold mt-5">
                    {plan.price}
                    <span className="text-base text-gray-400 font-normal">
                      /month
                    </span>
                  </p>

                  <p className="text-green-400 text-sm mt-3">
                    {plan.included}
                  </p>

                  <p className="text-gray-400 text-sm mt-1">
                    {plan.extra}
                  </p>

                  <div className="space-y-3 mt-6 text-sm text-gray-300">
                    {included.map((item) => (
                      <p key={item} className="flex gap-2">
                        <CheckCircle2
                          size={16}
                          className="text-green-400 mt-0.5"
                        />
                        {item}
                      </p>
                    ))}
                  </div>

                  <button
                    onClick={() => navigate("/signup")}
                    className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-medium"
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* VALUE */}
          <div className="mt-16 rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
            <Star className="mx-auto text-yellow-400 mb-4" size={24} />

            <h3 className="text-2xl font-semibold">
              Most businesses recover the monthly fee in time saved alone
            </h3>

            <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
              Reduce rota time, fix attendance issues faster, stop payroll
              mistakes and run your company with real control.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-4xl font-semibold">
          Ready to grow properly?
        </h2>

        <p className="text-gray-400 mt-4">
          Join businesses upgrading to a premium workforce system.
        </p>

        <button
          onClick={() => navigate("/signup")}
          className="mt-8 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-medium shadow-xl shadow-indigo-500/20"
        >
          Create Workspace
        </button>
      </div>
    </div>
  );
}

function Panel({ title, value }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <p className="text-xs text-gray-400">{title}</p>
      <h3 className="text-2xl font-semibold mt-2">{value}</h3>
    </div>
  );
}

function MiniStat({ icon, text }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-2 text-gray-300">
      {icon}
      <span>{text}</span>
    </div>
  );
}