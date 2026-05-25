import React, { useState, useEffect } from 'react';
import { shiftAPI, locationAPI, taskAPI, uploadAPI } from '../services/api';

function Pricing() {
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      const res = await ApiService.getSubscriptionStatus();
      setSubscriptionStatus(res.subscriptionStatus);
    } catch {
      setError('Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
    try {
      setLoading(true);
      const res = await ApiService.updateSubscription({ plan });

      if (res.success) {
        setSuccess('Subscription updated!');
        loadBillingData();
      } else {
        setError(res.message);
      }
    } catch {
      setError('Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = subscriptionStatus?.plan || 'trial';

  const plans = [
    {
      id: 'trial',
      name: 'Starter',
      price: 'Free',
      subtitle: 'Perfect to get started',
      features: [
        'Up to 3 employees',
        'Time tracking',
        'Basic reporting'
      ],
      cta: 'Start Free',
      highlight: false
    },
    {
      id: 'standard',
      name: 'Pro',
      price: '£6',
      subtitle: 'per employee / month',
      features: [
        'Unlimited employees',
        'Advanced reporting',
        'Schedules & shifts',
        'Overtime alerts',
        'Holiday management',
        'Full team management'
      ],
      cta: 'Upgrade to Pro',
      highlight: true
    }
  ];

  if (loading) {
    return <div className="center-screen text-white">Loading pricing...</div>;
  }

  return (
    <div className="space-y-12">

      {/* HEADER */}
      <div className="text-center">
        <h1 className="heading-1">
          Simple, transparent pricing
        </h1>
        <p className="subtle-text mt-2">
          Built for growing teams. No contracts. No surprises.
        </p>
      </div>

      {/* MESSAGES */}
      {error && <div className="badge-error text-center">{error}</div>}
      {success && <div className="badge-success text-center">{success}</div>}

      {/* PLANS */}
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">

        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 border transition-all
                ${plan.highlight
                  ? 'bg-indigo-600/10 border-indigo-500/30 shadow-xl scale-[1.03]'
                  : 'bg-white/5 border-white/10'
                }
              `}
            >

              {/* BADGE */}
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              {/* PLAN NAME */}
              <h3 className="text-xl font-semibold text-white">
                {plan.name}
              </h3>

              <p className="text-gray-400 text-sm mt-1">
                {plan.subtitle}
              </p>

              {/* PRICE */}
              <div className="text-4xl font-bold mt-4 text-white">
                {plan.price}
              </div>

              {/* FEATURES */}
              <ul className="mt-6 space-y-2 text-sm text-gray-300">
                {plan.features.map((f, i) => (
                  <li key={i}>✔ {f}</li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isCurrent}
                className={`mt-8 w-full py-3 rounded-xl font-medium transition-all
                  ${isCurrent
                    ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                    : plan.highlight
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-black hover:bg-gray-200'
                  }
                `}
              >
                {isCurrent ? 'Current Plan' : plan.cta}
              </button>

            </div>
          );
        })}

      </div>

      {/* TRUST */}
      <div className="text-center text-sm text-gray-500">
        Trusted by teams managing employees, schedules, and performance with FieldSync.
      </div>

    </div>
  );
}

export default Pricing;