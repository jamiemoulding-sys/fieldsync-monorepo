
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function JoinCompany() {
  const { joinCompany, createCompany } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleJoin = async () => {
    setError('');
    setSuccess('');

    const res = await joinCompany(code);

    if (!res.success) {
      setError(res.error);
    } else {
      setSuccess('Joined company!');
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  const handleCreate = async () => {
    setError('');
    setSuccess('');

    const res = await createCompany(companyName);

    if (!res.success) {
      setError(res.error);
    } else {
      setSuccess('Company created!');
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white p-4">

      <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur rounded-2xl p-8 space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">Join Company</h1>

          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-400 hover:text-white"
          >
            Skip
          </button>
        </div>

        {/* ERROR / SUCCESS */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* JOIN */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Enter join code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <button
            onClick={handleJoin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-medium transition"
          >
            Join Company
          </button>
        </div>

        {/* DIVIDER */}
        <div className="text-center text-gray-500 text-sm">or</div>

        {/* CREATE */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <button
            onClick={handleCreate}
            className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-medium transition"
          >
            Create Company
          </button>
        </div>

      </div>
    </div>
  );
}


export default JoinCompany;