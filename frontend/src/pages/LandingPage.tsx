import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Categories from '../components/landing/Categories';
import HowItWorks from '../components/landing/HowItWorks';
import Stats from '../components/landing/Stats';
import Testimonials from '../components/landing/Testimonials';
import Footer from '../components/landing/Footer';
import { mockProducts, mockTestimonials, steps, stats } from '../data';
import { Product, Testimonial } from '../types';

interface LandingPageProps {
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  showToast: (msg: string) => void;
}

export default function LandingPage({
  onNavigateToLogin,
  onNavigateToRegister,
  showToast,
}: LandingPageProps) {
  
  // When user clicks "Start Review Task" or "Claim Task" on the landing page
  const handleSelectProduct = (product: Product | null) => {
    showToast("Authentication required! Please register an account or sign in to claim this campaign.");
    onNavigateToRegister();
  };

  const handleAddReview = (newReview: Testimonial) => {
    showToast("Please register or sign in to submit a verified user review.");
    onNavigateToRegister();
  };

  const featuredLaunchProducts = mockProducts.slice(0, 2);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-amazon-gold/30 flex flex-col relative">
      
      {/* Premium Multi-functional Amazon Navbar */}
      <Navbar
        products={mockProducts}
        walletBalance={0}
        pendingBalance={0}
        completedTasks={0}
        reviewerTier="Bronze Reviewer"
        withdrawHistory={[]}
        onWithdraw={() => {}}
        onSelectProduct={handleSelectProduct}
        onOpenLogin={onNavigateToLogin}
        onOpenRegister={onNavigateToRegister}
        isLoggedIn={false}
        onLogout={() => {}}
        username=""
      />

      {/* Main Sections */}
      <div className="flex-1">
        {/* Visual Hero Highlights */}
        <Hero 
          featuredProducts={featuredLaunchProducts}
          onSelectProduct={handleSelectProduct}
          onOpenRegister={onNavigateToRegister}
        />

        {/* Minimalist Categories Catalog */}
        <Categories 
          products={mockProducts}
          onSelectProduct={handleSelectProduct}
        />

        {/* Dynamic Workflow Steps */}
        <HowItWorks steps={steps} />

        {/* Global Stats Line */}
        <Stats stats={stats} />

        {/* User Reviews & Feedback */}
        <Testimonials 
          testimonials={mockTestimonials} 
          onAddReview={handleAddReview}
        />
      </div>

      {/* Footer layout */}
      <Footer />
    </div>
  );
}
