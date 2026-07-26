import React from 'react';
import { motion } from 'motion/react';
import { Search, CreditCard, Truck, Gift, ChevronRight } from 'lucide-react';
import { Step } from '../../types';

interface HowItWorksProps {
  steps: Step[];
}

export default function HowItWorks({ steps }: HowItWorksProps) {
  
  // Icon mapper helper
  const renderIcon = (name: string) => {
    const classProps = "h-6 w-6 text-amazon-blue";
    switch (name) {
      case 'Search':
        return <Search className={classProps} />;
      case 'CreditCard':
        return <CreditCard className={classProps} />;
      case 'Truck':
        return <Truck className={classProps} />;
      case 'Gift':
        return <Gift className={classProps} />;
      default:
        return <Search className={classProps} />;
    }
  };

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-amazon-light font-sans relative overflow-hidden border-b border-gray-100">
      {/* Background circle blobs */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-[#146eb4]/5 rounded-full blur-3xl pointer-events-none -ml-40" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amazon-gold/5 rounded-full blur-3xl pointer-events-none -mr-40" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
        
        {/* Title Content */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-bold text-amazon-blue uppercase tracking-widest font-mono">Streamlined Earning</span>
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-amazon-dark tracking-tight">
            How Your Earning Flow Works
          </h2>
          <p className="text-sm text-gray-500">
            A simple, secure, and transparent process designed to let you write honest product reviews and cash out instantly.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="relative">
          
          {/* Connector Line (hidden on mobile, visible on desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-0.5 border-t-2 border-dashed border-gray-300 -translate-y-10 z-0" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, idx) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -8 }}
                className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col justify-between h-full relative group"
              >
                <div>
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-12 w-12 rounded-xl bg-[#e7f3fc] flex items-center justify-center group-hover:bg-[#146eb4]/10 transition-colors">
                      {renderIcon(step.iconName)}
                    </div>
                    <span className="text-4xl font-display font-extrabold text-gray-200 group-hover:text-amazon-blue/20 transition-colors">
                      {step.number}
                    </span>
                  </div>

                  {/* Step Text Details */}
                  <div className="space-y-2">
                    <h3 className="text-base font-extrabold text-amazon-dark">
                      {step.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Mobile progress helper arrow */}
                <div className="hidden lg:group-hover:flex absolute -right-4 top-1/2 -translate-y-4 h-8 w-8 bg-white border border-gray-100 rounded-full items-center justify-center shadow-md text-amazon-gold z-20 pointer-events-none transition duration-200">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Reviewer Callout Banner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-16 bg-white border border-gray-200/80 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between shadow-sm space-y-6 md:space-y-0 text-left"
        >
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex h-12 w-12 bg-amazon-gold/20 rounded-full items-center justify-center text-amazon-blue flex-shrink-0">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-800">Ready to supercharge your remote earnings?</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-lg leading-relaxed">
                Connect your accounts and gain elite reviewer status. Level up your reviewer tier to unlock premium campaigns with 2x payout multipliers.
              </p>
            </div>
          </div>
          <a
            href="#categories"
            className="w-full md:w-auto bg-amazon-gold hover:bg-[#f3a847] text-amazon-dark font-extrabold text-xs px-6 py-3 rounded-lg shadow-sm transition text-center whitespace-nowrap cursor-pointer"
          >
            Explore Live Campaigns
          </a>
        </motion.div>

      </div>
    </section>
  );
}
