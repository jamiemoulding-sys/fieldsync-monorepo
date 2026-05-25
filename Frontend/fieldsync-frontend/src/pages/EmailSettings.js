import React, { useState, useEffect } from 'react';
import HomeButton from '../components/HomeButton';

function EmailSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [emailSettings, setEmailSettings] = useState({
    enableInvitationEmails: true,
    enableWelcomeEmails: true,
    enablePasswordResetEmails: true,
    enableNotificationEmails: true,
    emailFromName: '',
    emailFromAddress: ''
  });

  useEffect(() => {
    loadEmailSettings();
  }, []);

  const loadEmailSettings = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

      const settings = {
        enableInvitationEmails: true,
        enableWelcomeEmails: true,
        enablePasswordResetEmails: true,
        enableNotificationEmails: true,
        emailFromName: currentUser.companyName || 'Workforce Management',
        emailFromAddress: process.env.REACT_APP_FROM_EMAIL || 'noreply@workforce.com'
      };

      setEmailSettings(settings);
    } catch (error) {
      console.error('Failed to load email settings:', error);
      setError('Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Simulate save
      await new Promise(resolve => setTimeout(resolve, 800));

      setSuccess('Email settings saved (local only)');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading email settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📧 Email Settings</h1>
            <p className="text-gray-600 mt-2">
              Email handling is managed by Supabase (no SendGrid needed)
            </p>
          </div>
          <HomeButton />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        <div className="space-y-6">

          {/* Email Preferences */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Preferences</h2>

            {[
              ['Invitation Emails', 'enableInvitationEmails'],
              ['Welcome Emails', 'enableWelcomeEmails'],
              ['Password Reset Emails', 'enablePasswordResetEmails'],
              ['Notification Emails', 'enableNotificationEmails']
            ].map(([label, key]) => (
              <div key={key} className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <input
                  type="checkbox"
                  checked={emailSettings[key]}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, [key]: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </div>
            ))}
          </div>

          {/* Sender Settings */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sender Info</h2>

            <div className="space-y-4">
              <input
                type="text"
                value={emailSettings.emailFromName}
                onChange={(e) =>
                  setEmailSettings({ ...emailSettings, emailFromName: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="From Name"
              />

              <input
                type="email"
                value={emailSettings.emailFromAddress}
                onChange={(e) =>
                  setEmailSettings({ ...emailSettings, emailFromAddress: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="From Email"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
            Supabase handles authentication emails automatically (password reset, verification, etc).
            Custom email sending has been disabled.
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default EmailSettings;
