import React from 'react';
import { motion } from 'motion/react';
import { Check, Clock, ShieldAlert } from 'lucide-react';

interface UnderReviewPageProps {
  username: string;
  onNavigateHome: () => void;
  onNavigateToLogin?: () => void;
}

export default function UnderReviewPage({
  username,
  onNavigateHome,
  onNavigateToLogin,
}: UnderReviewPageProps) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between font-sans">
      {/* Sleek Minimal Header */}
      <header className="bg-[#131921] py-4 px-6 flex items-center justify-between border-b border-gray-800 shadow-sm">
        <button 
          onClick={onNavigateHome}
          className="font-display text-xl font-black tracking-tight text-white focus:outline-none cursor-pointer flex items-center space-x-1.5"
        >
          <span>Amazon</span><span className="text-amazon-gold">E-Commerce Hub</span>
        </button>
        <span className="text-xs font-semibold text-amber-500 flex items-center space-x-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>Evaluation Status: Pending</span>
        </span>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-lg w-full p-6 sm:p-8 space-y-6 text-center"
        >
          {/* Pulsing Status Icon */}
          <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
            <Clock className="h-9 w-9 animate-spin" style={{ animationDuration: '3s' }} />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Application Under Review</h1>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
              Hello <span className="font-bold text-gray-900">{username}</span>! To maintain a highly premium verified panelist pool, our review team is currently evaluating your credentials and invite code. This security auditing process typically completes within 24 hours.
            </p>
          </div>
 
          {/* Secure Evaluation Pipeline Tracker */}
          <div className="bg-gray-50 rounded-xl border border-gray-150 p-4 text-left space-y-3.5 max-w-md mx-auto">
            <p className="text-[10px] font-mono font-extrabold text-gray-400 uppercase tracking-widest border-b border-gray-200/80 pb-1.5">
              SECURE AUTHORIZATION PIPELINE
            </p>
            
            {/* Steps */}
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span className="flex items-center space-x-2.5">
                <span className="h-5 w-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[10px] font-black">✓</span>
                <span>Referral Invite Code</span>
              </span>
              <span className="text-green-600 font-extrabold text-[10px] uppercase font-mono bg-green-50 px-2 py-0.5 rounded border border-green-150">
                Verified
              </span>
            </div>
 
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span className="flex items-center space-x-2.5">
                <span className="h-5 w-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[10px] font-black">✓</span>
                <span>Security & Proxy IP Check</span>
              </span>
              <span className="text-green-600 font-extrabold text-[10px] uppercase font-mono bg-green-50 px-2 py-0.5 rounded border border-green-150">
                Passed
              </span>
            </div>
 
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span className="flex items-center space-x-2.5">
                <span className="h-5 w-5 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-[10px] font-black animate-pulse">⏳</span>
                <span>Compliance Review</span>
              </span>
              <span className="text-amber-500 font-extrabold text-[10px] uppercase font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-150 animate-pulse">
                In Progress
              </span>
            </div>
          </div>
 
          <div className="pt-6 border-t border-gray-100 space-y-3">
            <p className="text-[10px] font-mono font-bold text-gray-400 tracking-wider">
              COMPLIANCE TEAM AUDIT
            </p>
            <p className="text-[10px] text-gray-400 leading-normal max-w-xs mx-auto">
              Our review team will audit and process your registration. New accounts are processed in up to 24 hours.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={onNavigateHome}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg border border-gray-300 transition-colors cursor-pointer"
              >
                Back to Home
              </button>
              {onNavigateToLogin && (
                <button
                  onClick={onNavigateToLogin}
                  className="px-5 py-2 bg-[#131921] hover:bg-black text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Back to Login
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </main>

      {/* Sleek footer */}
      <footer className="bg-gray-100 py-6 text-center border-t border-gray-200">
        <p className="text-[11px] text-gray-500">© 2026 Amazon E-Commerce Hub. All rights reserved.</p>
      </footer>
    </div>
  );
}
