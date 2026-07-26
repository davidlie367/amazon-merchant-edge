import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ArrowRight, User, Mail, Lock, Key, Award, ArrowLeft } from 'lucide-react';
import { API_BASE } from '../config';

interface RegisterPageProps {
  onRegisterSuccess: (username: string, email: string) => void;
  onNavigateToLogin: () => void;
  onNavigateHome: () => void;
}

export default function RegisterPage({
  onRegisterSuccess,
  onNavigateToLogin,
  onNavigateHome,
}: RegisterPageProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [withdrawalPassword, setWithdrawalPassword] = useState('');
  const [confirmWithdrawal, setConfirmWithdrawal] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      setReferralCode(refParam.toUpperCase());
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validations
    if (!username.trim() || !email.trim() || !loginPassword || !withdrawalPassword) {
      setErrorMessage('Please fill in all mandatory fields.');
      return;
    }

    if (loginPassword.length < 8) {
      setErrorMessage('Login Password must be at least 8 characters.');
      return;
    }

    if (loginPassword !== confirmPassword) {
      setErrorMessage('Login passwords do not match.');
      return;
    }

    if (!/^\d{4}$/.test(withdrawalPassword)) {
      setErrorMessage('Withdrawal PIN must be exactly 4 digits.');
      return;
    }

    if (withdrawalPassword !== confirmWithdrawal) {
      setErrorMessage('Withdrawal PINs do not match.');
      return;
    }

    const normalizedReferralCode = referralCode.trim().toUpperCase();
    if (normalizedReferralCode && !/^[A-Z0-9]{6}$/.test(normalizedReferralCode)) {
      setErrorMessage('Referral code must be a 6-character alphanumeric invite code (e.g. XE6G22).');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password: loginPassword,
          withdrawalPassword: withdrawalPassword,
          referredBy: normalizedReferralCode
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Registration failed');
        return;
      }

      onRegisterSuccess(username.trim(), email.trim());
    } catch (err) {
      setErrorMessage('Server connection error. Please make sure the backend is active.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between font-sans">
      {/* Sleek Minimal Header */}
      <header className="bg-[#131921] py-4 px-6 flex items-center justify-between border-b border-gray-800 shadow-sm">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onNavigateHome}
            className="flex items-center space-x-1.5 text-xs font-semibold text-gray-300 hover:text-white transition bg-gray-850 hover:bg-gray-750 px-3 py-1.5 rounded-lg border border-gray-700 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-amazon-gold" />
            <span>Back to main page</span>
          </button>
          
          <button 
            onClick={onNavigateHome}
            className="hidden sm:flex font-display text-xl font-black tracking-tight text-white focus:outline-none cursor-pointer items-center space-x-1.5"
          >
            <span>Amazon</span><span className="text-amazon-gold">E-Commerce Hub</span>
          </button>
        </div>
        <button
          onClick={onNavigateToLogin}
          className="text-xs font-semibold text-gray-300 hover:text-amazon-gold transition"
        >
          Already have an account? Sign In
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-lg w-full p-6 sm:p-8 space-y-6"
        >
          <div className="text-center">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Create Reviewer Account</h1>
            <p className="text-xs text-gray-500 mt-1">Join the premier active verification and evaluation panel</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3.5 rounded text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Username & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <span>Username *</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  <span>Email *</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900"
                />
              </div>
            </div>

            {/* Login Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                  <Lock className="h-3.5 w-3.5 text-gray-400" />
                  <span>Login Password *</span>
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Min 8 chars"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Confirm Password *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900"
                />
              </div>
            </div>

            {/* Withdrawal PIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                  <Key className="h-3.5 w-3.5 text-gray-400" />
                  <span>Withdrawal PIN *</span>
                </label>
                <input
                  type="password"
                  required
                  value={withdrawalPassword}
                  onChange={(e) => setWithdrawalPassword(e.target.value)}
                  placeholder="4 digits"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Confirm Withdrawal PIN *</label>
                <input
                  type="password"
                  required
                  value={confirmWithdrawal}
                  onChange={(e) => setConfirmWithdrawal(e.target.value)}
                  placeholder="Confirm PIN"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900"
                />
              </div>
            </div>

            {/* Referral Code */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                <Award className="h-3.5 w-3.5 text-gray-400" />
                <span>Referral Invitation Code (Optional)</span>
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-char invite code if you have one"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900 font-mono tracking-wider"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-amazon-gold hover:bg-[#f3a847] active:bg-[#e29b3c] text-amazon-dark border border-[#a88734] font-black text-sm py-3 rounded-lg shadow-sm transition cursor-pointer text-center flex items-center justify-center space-x-2 mt-2"
            >
              <span>Register</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="h-px bg-gray-100 my-4 relative flex justify-center items-center">
            <span className="bg-white text-[10px] text-gray-400 px-3 absolute uppercase tracking-widest font-bold">Already a Panelist?</span>
          </div>

          <button
            onClick={onNavigateToLogin}
            className="w-full text-center bg-gray-50 hover:bg-gray-100 border border-gray-300 text-xs font-bold py-2.5 rounded-lg transition text-gray-700"
          >
            Sign in to your Panel
          </button>
        </motion.div>
      </main>

      {/* Sleek footer */}
      <footer className="bg-gray-100 py-6 text-center border-t border-gray-200">
        <p className="text-[11px] text-gray-500">© 2026 Amazon E-Commerce Hub. All rights reserved.</p>
      </footer>
    </div>
  );
}
