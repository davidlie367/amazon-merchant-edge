import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ExternalLink, Mail, CheckCircle } from 'lucide-react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubscribeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setIsSubscribed(true);
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 5000);
    }
  };

  const footerLinks = [
    {
      title: "Get to Know Us",
      links: ["Careers", "Blog", "About E-Commerce Hub", "Security & Auditing", "Platform Guidelines", "Review Integrity"]
    },
    {
      title: "Earn with Us",
      links: ["Browse Active Campaigns", "High-Payout Gigs", "Level Up Tiers", "Referral Commissions", "Verified Review Panel", "Leaderboard Rankings"]
    },
    {
      title: "Payout Channels",
      links: ["Wallet Balances", "Instant Cashout Portal", "PayPal Redemptions", "Crypto Rewards", "Transaction Ledger"]
    },
    {
      title: "Help & Support",
      links: ["FAQ Hub", "Your Account Console", "Active Tasks Support", "Verification Guidelines", "Anti-Abuse Rules", "Terms of Service", "Help Ticket Support"]
    }
  ];

  return (
    <footer className="bg-[#232F3E] text-white font-sans text-xs">
      
      {/* Back to top button (Operational & highly requested design accent!) */}
      <button
        onClick={scrollToTop}
        className="w-full bg-[#37475A] hover:bg-[#485769] py-4 text-center text-xs font-semibold tracking-wide transition duration-150 border-b border-white/5 flex items-center justify-center space-x-1 cursor-pointer"
      >
        <span>Back to top</span>
        <ChevronUp className="h-4 w-4" />
      </button>

      {/* Main Footer Links Structure */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 pb-12 border-b border-[#37475a]">
          {footerLinks.map((column, idx) => (
            <div key={idx} className="space-y-4 text-left">
              <h4 className="text-sm font-bold text-white tracking-wide">
                {column.title}
              </h4>
              <ul className="space-y-2.5">
                {column.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); }}
                      className="text-gray-300 hover:text-white hover:underline transition font-normal"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Sub-Footer: Newsletter Subscribe + Location/Currency selectors */}
        <div className="py-12 flex flex-col lg:flex-row items-center justify-between gap-8 border-b border-[#37475a] text-left">
          
          {/* Newsletter Box */}
          <div className="max-w-md space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
              <Mail className="h-4.5 w-4.5 text-amazon-gold" />
              <span>Subscribe to campaign newsletters</span>
            </h4>
            <p className="text-gray-300 leading-normal">
              Be the first to receive updates on upcoming high-payout review campaigns, exclusive multipliers, and platform upgrades.
            </p>

            <form onSubmit={handleSubscribeSubmit} className="pt-2 flex">
              <input
                type="email"
                required
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-white border border-transparent rounded-l-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amazon-gold text-xs font-medium"
              />
              <button
                type="submit"
                className="bg-amazon-gold hover:bg-[#f3a847] text-amazon-dark font-extrabold px-5 py-2 rounded-r-lg transition whitespace-nowrap cursor-pointer text-xs"
              >
                Subscribe
              </button>
            </form>

            {/* Newsletter feedback */}
            <AnimatePresence>
              {isSubscribed && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-green-400 font-semibold flex items-center space-x-1 pt-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Success! You have registered for E-Commerce Hub Updates.</span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Region and Logo controls */}
          <div className="flex flex-wrap items-center gap-4 text-gray-300 font-semibold">
            <div className="border border-[#37475a] hover:border-gray-300 px-3 py-1.5 rounded-sm cursor-pointer transition flex items-center space-x-1.5">
              <span>🌐 English</span>
            </div>
            <div className="border border-[#37475a] hover:border-gray-300 px-3 py-1.5 rounded-sm cursor-pointer transition flex items-center space-x-1.5">
              <span>$ USD - U.S. Dollar</span>
            </div>
            <div className="border border-[#37475a] hover:border-gray-300 px-3 py-1.5 rounded-sm cursor-pointer transition flex items-center space-x-1.5">
              <span>🇺🇸 United States</span>
            </div>
          </div>
        </div>

        {/* Bottom copyright segment */}
        <div className="pt-10 flex flex-col md:flex-row items-center justify-between text-gray-400 font-normal leading-relaxed text-center md:text-left space-y-4 md:space-y-0">
          <div className="flex items-center space-x-6">
            {/* Logo copy */}
            <span className="font-display text-xl font-extrabold text-white">
              amazon<span className="text-amazon-gold">ecommercehub</span>
            </span>
            <span className="hidden md:inline h-4 w-px bg-white/10" />
            <p>© 2026 Amazon E-Commerce Hub, Inc. or its affiliates. Designed with absolute precision inspired by Amazon UI.</p>
          </div>

          {/* Legal references */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <a href="#" className="hover:underline hover:text-white">Conditions of Use</a>
            <a href="#" className="hover:underline hover:text-white">Privacy Notice</a>
            <a href="#" className="hover:underline hover:text-white">Consumer Health Data Privacy Disclosure</a>
            <a href="#" className="hover:underline hover:text-white">Your Ads Privacy Choices</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
