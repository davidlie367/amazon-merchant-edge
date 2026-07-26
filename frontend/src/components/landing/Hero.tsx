import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { Product } from '../../types';

interface HeroProps {
  featuredProducts: Product[];
  onSelectProduct: (product: Product) => void;
  onOpenRegister: () => void;
}

export default function Hero({
  featuredProducts,
  onSelectProduct,
  onOpenRegister
}: HeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState('Charcoal Black');
  const [tickerIndex, setTickerIndex] = useState(0);

  const liveActivities = [
    { user: "sarah_j***", platform: "Amazon", task: "Review Approved", reward: "+$2.80", time: "just now" },
    { user: "marcus_c***", platform: "Alibaba", task: "Task Submitted", reward: "+$4.80", time: "30s ago" },
    { user: "elena_r***", platform: "Shopify", task: "Review Approved", reward: "+$2.50", time: "1m ago" },
    { user: "alex_w***", platform: "Amazon", task: "Instant Cashout", reward: "$45.00 via PayPal", time: "2m ago" },
    { user: "liam_k***", platform: "Shopify", task: "Tier Upgraded", reward: "Platinum Tier", time: "3m ago" },
    { user: "clara_m***", platform: "Alibaba", task: "Campaign Completed", reward: "+$3.10", time: "5m ago" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % liveActivities.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeProduct = featuredProducts[activeIndex % featuredProducts.length];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % featuredProducts.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + featuredProducts.length) % featuredProducts.length);
  };

  const colors = ['Charcoal Black', 'Nimbus White', 'Oasis Blue'];

  return (
    <section className="relative w-full bg-linear-to-b from-[#f8fafd] via-white to-white overflow-hidden py-12 md:py-20 font-sans border-b border-gray-100">
      {/* Decorative backdrop gradients for elegant design */}
      <div className="absolute top-0 right-0 w-120 h-120 bg-[#146eb4]/5 rounded-full blur-3xl pointer-events-none -mr-40 -mt-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amazon-gold/5 rounded-full blur-3xl pointer-events-none -ml-40 -mb-20" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Left Column - Text Content */}
          <div className="lg:col-span-7 space-y-6 text-left">

            {/* Earning Platform Badge */}
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center space-x-2 bg-[#fff7e6] border border-amazon-gold/20 px-3 py-1.5 rounded-full text-xs font-bold text-amazon-dark"
            >
              <span className="bg-amazon-gold text-amazon-dark font-black px-1.5 py-0.5 rounded text-xxs uppercase">Earn Cash</span>
              <span>Review products, get paid!</span>
            </motion.div>

            {/* Display Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-amazon-dark tracking-tight leading-tight"
            >
              Get Paid to Review <br />
              <span className="bg-gradient-to-r from-amazon-blue to-amazon-gold bg-clip-text text-transparent">E-Commerce Goods</span>
            </motion.h1>

            {/* Descriptive Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-gray-600 max-w-xl font-normal leading-relaxed"
            >
              Partner with Amazon, Alibaba, and Shopify. Write honest reviews for newly launched consumer products, help brands optimize listings, and earn real-time payouts credited straight to your digital wallet.
            </motion.p>

            {/* Call To Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-2"
            >
              <button
                onClick={onOpenRegister}
                className="bg-amazon-blue hover:bg-[#115a95] text-white font-bold text-sm px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer group"
              >
                <span>Register Active Reviewer Panel</span>
                <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#categories"
                className="bg-white hover:bg-gray-50 text-amazon-dark border border-gray-300 font-semibold text-sm px-8 py-4 rounded-xl shadow-sm hover:shadow-md text-center transition"
              >
                View Earning Tasks
              </a>
            </motion.div>

            {/* Core Pillars / Trust Elements */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200/80 max-w-lg text-left"
            >
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-green-50 rounded-lg text-green-600 flex-shrink-0">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 leading-none">Instant Payouts</p>
                  <p className="text-xxs text-gray-500 mt-0.5">Withdraw within 5 mins</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-50 rounded-lg text-amazon-blue flex-shrink-0">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 leading-none">100% Verified</p>
                  <p className="text-xxs text-gray-500 mt-0.5">Real products & tasks</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-amber-50 rounded-lg text-amazon-gold flex-shrink-0">
                  <Star className="h-4.5 w-4.5 animate-bounce" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 leading-none">Multiplier Tiers</p>
                  <p className="text-xxs text-gray-500 mt-0.5">Up to 1.5x earnings boost</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Premium Product Stage Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-0 bg-[#f0f4f8]/50 border border-gray-100 rounded-3xl -rotate-1 scale-102 pointer-events-none" />
            <div className="relative bg-white rounded-3xl border border-gray-200/80 p-6 shadow-xl flex flex-col items-center">

              {/* Product Badge Header */}
              <div className="w-full flex justify-between items-center pb-4 border-b border-gray-100 mb-6">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-bold text-amazon-blue bg-blue-50 px-2 py-0.5 rounded">Featured Launch</span>
                  {activeProduct.isBestSeller && (
                    <span className="text-xxs font-extrabold text-amazon-dark bg-amazon-gold px-1.5 py-0.5 rounded">Best Seller</span>
                  )}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={handlePrev}
                    className="p-1.5 rounded-full hover:bg-gray-100 border border-gray-200 transition text-gray-600"
                    aria-label="Previous featured product"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-1.5 rounded-full hover:bg-gray-100 border border-gray-200 transition text-gray-600"
                    aria-label="Next featured product"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Product Image Stage */}
              <div className="relative w-full h-64 flex items-center justify-center overflow-hidden mb-6 group">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeProduct.id}
                    src={activeProduct.image}
                    alt={activeProduct.title}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.3 }}
                    className="max-h-full max-w-full object-contain rounded-xl drop-shadow-xl"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>
              </div>

              {/* Product Details Block */}
              <div className="w-full text-left space-y-3">
                <h3 className="text-base font-bold text-amazon-dark line-clamp-1 leading-tight hover:text-amazon-blue transition cursor-pointer" onClick={() => onSelectProduct(activeProduct)}>
                  {activeProduct.title}
                </h3>

                {/* Rating */}
                <div className="flex items-center space-x-1.5">
                  <div className="flex text-amazon-gold">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < Math.floor(activeProduct.rating) ? 'fill-current' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-amazon-blue hover:underline cursor-pointer">
                    {activeProduct.reviewsCount.toLocaleString()} ratings
                  </span>
                </div>

                {/* Pricing / Prime Line */}
                <div className="flex items-baseline justify-between pt-1">
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-gray-400 font-bold uppercase leading-none">Review Reward:</span>
                    <span className="text-2xl font-mono font-black text-green-600 mt-1">
                      +${activeProduct.payout ? activeProduct.payout.toFixed(2) : '3.50'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="inline-block text-[9px] font-extrabold text-[#FF9900] bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {activeProduct.platform} Task
                    </span>
                  </div>
                </div>

                {/* Product Price Info */}
                <div className="pt-2 flex items-center space-x-3 text-xxs font-semibold text-gray-500">
                  <span className="bg-gray-100 px-2 py-0.5 rounded">Product Price: ${activeProduct.price ? activeProduct.price.toFixed(2) : '99.99'}</span>
                </div>

                {/* Action Row */}
                <div className="flex space-x-2.5 pt-4">
                  <button
                    onClick={() => onSelectProduct(activeProduct)}
                    className="flex-1 bg-[#F7CA00] hover:bg-[#E2B600] active:bg-[#CBA300] text-amazon-dark font-extrabold text-xs py-3 rounded-lg shadow-sm border border-[#a88734] transition cursor-pointer text-center flex items-center justify-center space-x-1.5"
                  >
                    <span>Start Review Task</span>
                  </button>
                  <button
                    onClick={() => onSelectProduct(activeProduct)}
                    className="px-4 bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700 font-bold text-xs py-3 rounded-lg transition"
                  >
                    Details
                  </button>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
