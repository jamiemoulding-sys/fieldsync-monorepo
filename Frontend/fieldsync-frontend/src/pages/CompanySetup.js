import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function CompanySetup() {
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!companyName) return;

    setLoading(true);

    try {
      const res = await api.post('/companies/create-company', {
        name: companyName,
      });

      // ✅ update token with companyId
      localStorage.setItem('token', res.data.token);

      navigate('/dashboard');

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-6">

      <div className="w-full max-w-md">

        {/* LOGO / BRAND */}
        <div className="text-center mb-10">
          <h1 className="text-xl font-semibold tracking-tight">
            ⚡ FieldSync
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Workforce Management Platform
          </p>
        </div>

        {/* CARD */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 backdrop-blur">

          <h2 className="text-xl font-semibold mb-2">
            Create your workspace
          </h2>

          <p className="text-gray-400 text-sm mb-6">
            This is where your team, tasks, and operations will live.
          </p>

          {/* INPUT */}
          <input
            type="text"
            placeholder="e.g. ACME Ltd"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="
              w-full px-4 py-3 rounded-xl
              bg-white/5 border border-white/10
              text-white placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-indigo-500
              transition
            "
          />

          {/* BUTTON */}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="
              w-full mt-5 py-3 rounded-xl
              bg-indigo-600 hover:bg-indigo-500
              text-white font-medium
              transition disabled:opacity-50
            "
          >
            {loading ? 'Creating workspace...' : 'Continue →'}
          </button>

        </div>

        {/* FOOTER TRUST LINE */}
        <p className="text-center text-xs text-gray-600 mt-6">
          You can change your company details anytime
        </p>

      </div>

    </div>
  );
}

export default CompanySetup;