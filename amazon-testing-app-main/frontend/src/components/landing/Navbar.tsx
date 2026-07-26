import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  MapPin,
  Menu,
  X,
  ChevronDown,
  User,
  ArrowRight,
  Wallet,
  ArrowDownToLine,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Product } from '../../types';

interface NavbarProps {
  products: Product[];
  walletBalance: number;
  pendingBalance: number;
  completedTasks: number;
  reviewerTier: string;
  withdrawHistory: Array<{ id: string; date: string; amount: number; method: string; status: 'Completed' | 'Pending' }>;
  onWithdraw: (amount: number, method: string) => void;
  onSelectProduct: (product: Product) => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  isLoggedIn: boolean;
  onLogout: () => void;
  username: string;
}

export default function Navbar({
  products,
  walletBalance,
  pendingBalance,
  completedTasks,
  reviewerTier,
  withdrawHistory,
  onWithdraw,
  onSelectProduct,
  onOpenLogin,
  onOpenRegister,
  isLoggedIn,
  onLogout,
  username,
}: NavbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Gigs');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [userLocation, setUserLocation] = useState('United States');
  const [tempLocation, setTempLocation] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  // Cashout internal states
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('PayPal');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const categories = ['All Gigs', 'Amazon Gigs', 'Alibaba Gigs', 'Shopify Gigs'];

  const filteredSuggestions = searchQuery.trim() === ''
    ? []
    : products.filter(p =>
      (selectedCategory === 'All Gigs' || `${p.platform} Gigs` === selectedCategory) &&
      p.title.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempLocation.trim()) {
      setUserLocation(tempLocation);
      setIsLocationModalOpen(false);
    }
  };

  const handleSuggestionClick = (product: Product) => {
    onSelectProduct(product);
    setSearchQuery('');
    setShowSearchSuggestions(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full shadow-md bg-amazon-dark text-white font-sans">
        {/* Top bar (Amazon Primary header) */}
        <div className="mx-auto flex flex-col lg:flex-row h-auto lg:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 py-3 lg:py-0 gap-3 lg:gap-0">
          {/* Logo and Mobile controls (Row 1 on mobile) */}
          <div className="flex w-full lg:w-auto items-center justify-between lg:justify-start lg:space-x-6">
            {/* Logo */}
            <a href="#" className="flex items-center group relative py-1 px-2 border border-transparent hover:border-white rounded-sm transition">
              <span className="font-display text-xl font-extrabold tracking-tight">
                amazon<span className="text-amazon-gold">ecommercehub</span>
              </span>
              <div className="absolute -bottom-1.5 left-2 right-2 h-2 text-amazon-gold opacity-90 group-hover:opacity-100 transition">
                {/* SVG smile shape */}
                <svg className="w-full h-1.5" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M5 2 Q 50 12 95 2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <polygon points="95,2 91,-1 90,4" fill="currentColor" />
                </svg>
              </div>
            </a>

            {/* Delivery address (Desktop only) */}
            <button
              onClick={() => {
                setTempLocation(userLocation);
                setIsLocationModalOpen(true);
              }}
              className="hidden lg:flex items-center space-x-1.5 py-1 px-2 border border-transparent hover:border-white rounded-sm text-left transition cursor-pointer"
            >
              <MapPin className="h-5 w-5 text-gray-300" />
              <div className="text-xs">
                <p className="text-gray-300 font-normal leading-tight font-mono">Proxy IP IPSEC</p>
                <p className="font-bold leading-tight line-clamp-1 text-amazon-gold">{userLocation}</p>
              </div>
            </button>

            {/* Mobile Actions and Hamburger (Row 1 right-side on mobile) */}
            <div className="lg:hidden flex items-center space-x-2">
              {!isLoggedIn ? (
                <>
                  <button
                    onClick={onOpenLogin}
                    className="bg-transparent hover:bg-white/10 text-white border border-white/30 font-bold text-xs px-2.5 py-1.5 rounded-lg transition duration-200 cursor-pointer"
                  >
                    Login
                  </button>
                  <button
                    onClick={onOpenRegister}
                    className="bg-gradient-to-r from-[#f7ca00] to-[#f0c14b] hover:from-[#e2b600] hover:to-[#e79e3b] text-amazon-dark border border-[#a88734] font-extrabold text-xs px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition duration-200 cursor-pointer"
                  >
                    Get Started
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsWalletOpen(true)}
                  className="relative flex items-center space-x-1.5 py-1 px-2.5 bg-white/5 rounded-lg border border-white/15"
                >
                  <Wallet className="h-5 w-5 text-amazon-gold" />
                  <span className="text-xs font-black text-white">${walletBalance.toFixed(2)}</span>
                </button>
              )}

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 hover:bg-white/10 rounded transition ml-1"
              >
                {isMobileMenuOpen ? <X className="h-5.5 w-5.5" /> : <Menu className="h-5.5 w-5.5" />}
              </button>
            </div>
          </div>

          {/* Expanded Search Bar */}
          <div className="relative w-full lg:mx-4 flex lg:flex-1 lg:max-w-xl">
            <div className="flex w-full items-center bg-white rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-amazon-gold text-gray-900 shadow-sm">
              <div className="relative inline-block text-left bg-gray-100 border-r border-gray-300 h-10">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-full px-3 text-xs bg-transparent cursor-pointer font-bold text-gray-700 hover:text-black hover:bg-gray-200 outline-none pr-8 appearance-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>
              <input
                type="text"
                placeholder="Search active review campaigns..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchSuggestions(true);
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 outline-none font-medium"
              />
              <button className="h-10 px-5 bg-amazon-gold hover:bg-[#f3a847] text-amazon-dark flex items-center justify-center transition cursor-pointer">
                <Search className="h-5 w-5 font-bold" />
              </button>
            </div>

            {/* Search Suggestions Dropdown */}
            <AnimatePresence>
              {showSearchSuggestions && filteredSuggestions.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSearchSuggestions(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-11 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-20 text-gray-800 py-1 overflow-hidden"
                  >
                    {filteredSuggestions.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSuggestionClick(product)}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-gray-100 text-left transition"
                      >
                        <img
                          src={product.image}
                          alt={product.title}
                          className="h-9 w-9 object-cover rounded border border-gray-200 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-xs font-semibold text-amazon-dark line-clamp-1">{product.title}</p>
                          <p className="text-xxs text-gray-500 font-mono">${product.price.toFixed(2)}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Items */}
          <div className="hidden lg:flex items-center space-x-6 text-sm font-semibold">
            {/* Login Account Trigger */}
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  onOpenLogin();
                }
              }}
              className="flex flex-col text-left py-1 px-2 border border-transparent hover:border-white rounded-sm transition cursor-pointer"
            >
              <span className="text-xs font-normal text-gray-300">
                {isLoggedIn ? `Hello, ${username}` : 'Hello, Sign in'}
              </span>
              <span className="flex items-center space-x-0.5">
                <span>Account & Lists</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </button>

            {/* Completed Tasks Counter */}
            {isLoggedIn && (
              <div className="flex flex-col text-left text-gray-300 py-1 px-2 border border-transparent hover:border-white rounded-sm transition cursor-default">
                <span className="text-xs font-normal text-gray-400">Completed</span>
                <span className="font-bold flex items-center space-x-1">
                  <span className="text-amazon-gold font-black">{completedTasks}</span>
                  <span>Tasks</span>
                </span>
              </div>
            )}

            {/* Auth CTA Trigger */}
            <div className="flex items-center space-x-2">
              {!isLoggedIn ? (
                <>
                  <button
                    onClick={onOpenLogin}
                    className="bg-transparent hover:bg-white/10 text-white border border-white/30 font-bold text-xs px-3.5 py-1.5 rounded-lg transition duration-200 cursor-pointer"
                  >
                    Login
                  </button>
                  <button
                    onClick={onOpenRegister}
                    className="bg-gradient-to-r from-[#f7ca00] to-[#f0c14b] hover:from-[#e2b600] hover:to-[#e79e3b] text-amazon-dark border border-[#a88734] font-extrabold text-xs px-4 py-1.5 rounded-lg shadow-sm hover:shadow-md transition duration-200 cursor-pointer"
                  >
                    Get Started
                  </button>
                </>
              ) : (
                <button
                  onClick={onLogout}
                  className="bg-transparent hover:bg-white/10 text-white border border-gray-400 font-medium text-xs px-3.5 py-1.5 rounded-full transition cursor-pointer"
                >
                  Log Out
                </button>
              )}
            </div>

            {/* ZonWallet Earning Payout Hub Trigger */}
            {isLoggedIn && (
              <button
                onClick={() => setIsWalletOpen(true)}
                className="relative flex items-center space-x-2 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg transition cursor-pointer"
              >
                <div className="relative">
                  <Wallet className="h-5 w-5 text-amazon-gold" />
                  <span className="absolute -top-1.5 -right-1 bg-green-500 text-white text-[8px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center">
                    ✓
                  </span>
                </div>
                <div className="text-left leading-none">
                  <p className="text-[10px] text-gray-400">ZonWallet</p>
                  <p className="text-sm font-black text-white mt-0.5">${walletBalance.toFixed(2)}</p>
                </div>
              </button>
            )}
          </div>

        </div>

        {/* Mobile Delivery & Greeting Bar */}
        <div className="lg:hidden bg-[#1f2a37] px-4 py-2 flex items-center justify-between text-[10px] border-t border-white/5">
          <button
            onClick={() => {
              setTempLocation(userLocation);
              setIsLocationModalOpen(true);
            }}
            className="flex items-center space-x-1.5 text-gray-300 hover:text-white transition cursor-pointer"
          >
            <MapPin className="h-3.5 w-3.5 text-amazon-gold flex-shrink-0" />
            <span className="font-mono text-gray-400">Proxy IP:</span>
            <span className="font-bold text-amazon-gold line-clamp-1">{userLocation}</span>
          </button>
          <div className="text-gray-300 flex items-center space-x-1 flex-shrink-0">
            <span>{isLoggedIn ? `Hello, ${username}` : 'Hello, Sign in'}</span>
            <ChevronDown className="h-3 w-3 text-gray-450" />
          </div>
        </div>

        {/* Sub navbar (Amazon sub-bar) */}
        <div className="bg-amazon-navy text-xs py-2 px-4 sm:px-6 border-t border-white/5">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <div className="flex items-center space-x-4 overflow-x-auto no-scrollbar py-0.5 font-medium w-full">
              <button className="flex items-center space-x-1.5 text-white hover:text-amazon-orange transition cursor-pointer flex-shrink-0 font-bold">
                <Menu className="h-4.5 w-4.5" />
                <span>Live Gigs</span>
              </button>
              <a href="#categories" className="hover:text-amazon-orange transition flex-shrink-0 text-gray-300 hover:text-white">Review Board</a>
              <a href="#how-it-works" className="hover:text-amazon-orange transition flex-shrink-0 text-gray-300 hover:text-white">Earning Flow</a>
              <a href="#stats" className="hover:text-amazon-orange transition flex-shrink-0 text-gray-300 hover:text-white">Earnings Ledger</a>
              <a href="#testimonials" className="hover:text-amazon-orange transition flex-shrink-0 text-gray-300 hover:text-white">Community Reviews</a>
              <a href="#" onClick={onOpenLogin} className="hover:text-amazon-orange transition flex-shrink-0 text-gray-300 hover:text-white">Leaderboard</a>
              <a href="#" onClick={onOpenLogin} className="hover:text-amazon-orange transition flex-shrink-0 text-gray-300 hover:text-white">FAQ Hub</a>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Wallet & Cashout Drawer */}
      <AnimatePresence>
        {isWalletOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWalletOpen(false)}
              className="fixed inset-0 bg-black z-50"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col h-full font-sans text-gray-900"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 bg-amazon-dark text-white">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-5 w-5 text-amazon-gold animate-pulse" />
                  <h2 className="text-sm font-extrabold tracking-wide">Amazon E-Commerce Hub</h2>
                </div>
                <button
                  onClick={() => setIsWalletOpen(false)}
                  className="p-1 hover:bg-white/15 rounded-full transition text-gray-300 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Wallet Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Balance Stats Card */}
                <div className="bg-amazon-navy rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10 text-white pointer-events-none">
                    <Wallet className="h-32 w-32" />
                  </div>

                  <p className="text-xxs uppercase tracking-wider text-gray-400 font-bold">Available Balance</p>
                  <div className="flex items-baseline mt-1 space-x-1.5">
                    <span className="text-3xl font-display font-black text-amazon-gold">${walletBalance.toFixed(2)}</span>
                    <span className="text-xxs text-green-400 font-mono font-bold">Ready to Cash Out</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10 text-center">
                    <div>
                      <p className="text-[10px] text-gray-400">Pending</p>
                      <p className="text-xs font-mono font-bold mt-0.5 text-amber-300">${pendingBalance.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Completed</p>
                      <p className="text-xs font-bold mt-0.5 text-white">{completedTasks} Reviews</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Multiplier</p>
                      <p className="text-xs font-bold mt-0.5 text-green-400">{reviewerTier === 'Gold Reviewer' ? '1.3x' : reviewerTier === 'Platinum Reviewer' ? '1.5x' : '1.1x'}</p>
                    </div>
                  </div>
                </div>

                {/* Level Tier indicator */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-2.5">
                  <span className="text-lg">🏆</span>
                  <div className="text-left leading-normal">
                    <p className="text-xs font-bold text-gray-900">Tier Status: {reviewerTier}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">You are earning an extra bonus multiplier on all reviews from Alibaba and Shopify!</p>
                  </div>
                </div>

                {/* Withdrawal Panel */}
                <div className="border border-gray-200 rounded-2xl p-4.5 bg-gray-50 space-y-4">
                  <div className="flex items-center space-x-1.5 border-b border-gray-200 pb-2">
                    <ArrowDownToLine className="h-4.5 w-4.5 text-amazon-blue" />
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Request Cashout</h3>
                  </div>

                  {withdrawSuccess ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-4 space-y-3 bg-white border border-green-200 rounded-xl p-4"
                    >
                      <div className="h-10 w-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                        ✓
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-gray-900">Cashout Submitted!</p>
                        <p className="text-xxs text-gray-500 mt-1">Your funds are being transferred to your {withdrawMethod} account. Transfers usually complete in under 5 minutes.</p>
                      </div>
                      <button
                        onClick={() => {
                          setWithdrawSuccess(false);
                          setWithdrawAmount('');
                        }}
                        className="text-xxs font-bold text-amazon-blue hover:underline"
                      >
                        New Cashout
                      </button>
                    </motion.div>
                  ) : (
                    <div className="space-y-3.5">
                      {withdrawError && (
                        <div className="text-xxs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start space-x-1">
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span>{withdrawError}</span>
                        </div>
                      )}

                      {/* Cashout Method Selector */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Payout Gateway</label>
                        <div className="grid grid-cols-4 gap-2">
                          {['PayPal', 'Stripe', 'Payoneer', 'USDT'].map((method) => (
                            <button
                              type="button"
                              key={method}
                              onClick={() => {
                                setWithdrawMethod(method);
                                setWithdrawError('');
                              }}
                              className={`py-1.5 text-xxs font-extrabold rounded-lg border text-center transition-all ${withdrawMethod === method
                                  ? 'bg-amazon-blue text-white border-transparent shadow-xs'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                }`}
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cashout Amount Input */}
                      <div className="space-y-1.5 text-left">
                        <div className="flex justify-between items-baseline">
                          <label className="text-[10px] font-extrabold text-gray-500 uppercase">Amount (Min. $1.00)</label>
                          <button
                            onClick={() => {
                              setWithdrawAmount(walletBalance.toFixed(2));
                              setWithdrawError('');
                            }}
                            className="text-xxs font-extrabold text-amazon-blue hover:underline"
                          >
                            Use Max
                          </button>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 font-mono text-xs font-bold">$</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={withdrawAmount}
                            onChange={(e) => {
                              setWithdrawAmount(e.target.value);
                              setWithdrawError('');
                            }}
                            className="w-full pl-7 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amazon-blue text-gray-900 font-mono font-bold"
                          />
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => {
                          const amt = parseFloat(withdrawAmount);
                          if (isNaN(amt) || amt <= 0) {
                            setWithdrawError('Please enter a valid cashout amount.');
                            return;
                          }
                          if (amt < 1) {
                            setWithdrawError('Minimum payout threshold is $1.00 USD.');
                            return;
                          }
                          if (amt > walletBalance) {
                            setWithdrawError(`Insufficient balance! Your active wallet balance is $${walletBalance.toFixed(2)}.`);
                            return;
                          }
                          onWithdraw(amt, withdrawMethod);
                          setWithdrawSuccess(true);
                          setWithdrawError('');
                        }}
                        className="w-full bg-amazon-gold hover:bg-[#f3a847] text-amazon-dark font-extrabold text-xs py-3 rounded-xl shadow-md transition flex items-center justify-center space-x-1.5"
                      >
                        <DollarSign className="h-4 w-4" />
                        <span>Withdraw to {withdrawMethod}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* History list */}
                <div className="space-y-2.5 text-left">
                  <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Transaction History</h4>
                  <div className="space-y-2">
                    {withdrawHistory.map((historyItem) => (
                      <div key={historyItem.id} className="flex items-center justify-between p-3 border border-gray-150 rounded-xl bg-white hover:shadow-xs transition">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                            <span className="text-xs">💰</span>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-800">Paid to {historyItem.method}</p>
                            <p className="text-[10px] text-gray-400">{historyItem.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono font-extrabold text-gray-900">-${historyItem.amount.toFixed(2)}</p>
                          <span className={`inline-block text-[8px] font-extrabold px-1.5 py-0.5 rounded-full mt-1 ${historyItem.status === 'Completed'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                            {historyItem.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="bg-gray-50 border-t border-gray-200 p-4 text-center">
                <p className="text-[10px] text-gray-500 font-medium flex items-center justify-center space-x-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span>Secure payout ledger validated by anti-fraud protocols</span>
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Location Selector Modal */}
      <AnimatePresence>
        {isLocationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLocationModalOpen(false)}
              className="fixed inset-0 bg-black"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-sm w-full z-10 font-sans text-gray-900 border border-gray-200"
            >
              <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-900">Choose your location</h3>
                <button
                  onClick={() => setIsLocationModalOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-200 transition text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleLocationSubmit} className="p-5 space-y-4">
                <p className="text-xs text-gray-500 leading-normal">
                  Delivery options and speeds vary by destination. Enter your city or country below to update availability.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">City / Country / Postal Code</label>
                  <input
                    type="text"
                    required
                    value={tempLocation}
                    onChange={(e) => setTempLocation(e.target.value)}
                    placeholder="e.g. London, UK"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amazon-orange text-gray-900 font-medium"
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-amazon-orange hover:bg-[#e68a00] text-amazon-dark text-xs font-bold py-2.5 rounded-lg shadow-sm transition"
                  >
                    Apply Address
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-45"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed left-0 top-0 bottom-0 w-4/5 max-w-sm bg-amazon-dark text-white z-45 flex flex-col pt-16 font-sans"
            >
              <div className="flex items-center space-x-3 px-6 py-5 bg-amazon-navy border-b border-white/10">
                <div className="p-2 bg-white/10 rounded-full">
                  <User className="h-6 w-6 text-amazon-orange" />
                </div>
                <div>
                  <p className="text-sm font-bold">{isLoggedIn ? `Welcome, ${username}` : 'Welcome Guest'}</p>
                  {isLoggedIn ? (
                    <button onClick={() => { setIsMobileMenuOpen(false); onLogout(); }} className="text-xxs text-amazon-orange hover:underline font-bold">Sign Out of Account</button>
                  ) : (
                    <button onClick={() => { setIsMobileMenuOpen(false); onOpenLogin(); }} className="text-xxs text-amazon-orange hover:underline font-bold">Sign In to Account</button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-sm">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase">App Navigation</h3>
                  <div className="flex flex-col space-y-1.5">
                    <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-amazon-orange transition font-semibold">Live Gigs</a>
                    <a href="#categories" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-amazon-orange transition font-semibold">Review Board</a>
                    <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-amazon-orange transition font-semibold">Earning Flow</a>
                    <a href="#stats" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-amazon-orange transition font-semibold">Earnings Ledger</a>
                    <a href="#testimonials" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-amazon-orange transition font-semibold">Community Reviews</a>
                    <a href="#" onClick={() => { setIsMobileMenuOpen(false); if (!isLoggedIn) onOpenLogin(); }} className="py-2 hover:text-amazon-orange transition font-semibold">Leaderboard</a>
                    <a href="#" onClick={() => { setIsMobileMenuOpen(false); if (!isLoggedIn) onOpenLogin(); }} className="py-2 hover:text-amazon-orange transition font-semibold">FAQ Hub</a>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase">Deliver To</h3>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsLocationModalOpen(true);
                    }}
                    className="flex items-center space-x-2 text-left bg-white/5 p-3 rounded-lg w-full cursor-pointer"
                  >
                    <MapPin className="h-5 w-5 text-amazon-orange" />
                    <div>
                      <p className="text-xxs text-gray-400">Current Destination</p>
                      <p className="text-xs font-bold">{userLocation}</p>
                    </div>
                  </button>
                </div>

                {!isLoggedIn && (
                  <div className="pt-2">
                    <button
                      onClick={() => { setIsMobileMenuOpen(false); onOpenRegister(); }}
                      className="w-full bg-amazon-orange text-amazon-dark font-extrabold text-xs py-3 rounded-xl shadow-md text-center flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>Get Started Today</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
