import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, User, Lock, ArrowLeft } from 'lucide-react';
import { API_BASE } from '../config';

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
  onNavigateToRegister: () => void;
  onNavigateHome: () => void;
  defaultUsername?: string;
}

export default function LoginPage({
  onLoginSuccess,
  onNavigateToRegister,
  onNavigateHome,
  defaultUsername = ''
}: LoginPageProps) {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginInput.trim() || !password) {
      setErrorMessage('Please enter both your credentials.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginInput, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Authentication failed');
        return;
      }

      localStorage.setItem('reviewer_auth_token', data.token);
      onLoginSuccess(data.user.username);
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
          onClick={onNavigateToRegister}
          className="text-xs font-semibold text-gray-300 hover:text-amazon-gold transition"
        >
          Become a Reviewer
        </button>
      </header>

      {/* Main Form Area */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-sm w-full p-6 sm:p-8 space-y-6"
        >
          <div className="text-center">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Sign In</h1>
            <p className="text-xs text-gray-500 mt-1">Access your secure panelist workstation</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3.5 rounded text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span>Username or Email</span>
              </label>
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Enter username or email"
                className="w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
                  <Lock className="h-3.5 w-3.5 text-gray-400" />
                  <span>Password</span>
                </label>
                <a href="#" className="text-[10px] text-amazon-blue hover:underline font-semibold">Forgot?</a>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amazon-gold focus:border-amazon-gold text-gray-900"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#F7CA00] hover:bg-[#E2B600] active:bg-[#CBA300] text-amazon-dark border border-[#a88734] font-black text-xs py-3 rounded-lg shadow-sm transition cursor-pointer text-center flex items-center justify-center space-x-2"
            >
              <span>Sign In</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="h-px bg-gray-100 my-4 relative flex justify-center items-center">
            <span className="bg-white text-[10px] text-gray-400 px-3 absolute uppercase tracking-widest font-bold">New to E-Commerce Hub?</span>
          </div>

          <button
            onClick={onNavigateToRegister}
            className="w-full text-center bg-gray-50 hover:bg-gray-100 border border-gray-300 text-xs font-bold py-3 rounded-lg transition text-gray-700"
          >
            Create your account
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
