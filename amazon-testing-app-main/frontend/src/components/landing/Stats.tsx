import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Stat } from '../../types';

interface StatsProps {
  stats: Stat[];
}

export default function Stats({ stats }: StatsProps) {
  return (
    <section id="stats" className="py-16 md:py-20 bg-[#232f3e] text-white font-sans relative overflow-hidden">
      {/* Decorative dark background patterns */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amazon-blue/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <CounterCard key={idx} stat={stat} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Sub-component to manage clean individual counts and animations on scroll
function CounterCard({ stat, index }: { stat: Stat; index: number; key?: any }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    // Extract target number
    const isPercent = stat.value.includes('%');
    const isStar = stat.value.includes('★');
    const isPlus = stat.value.includes('+');
    
    // Clean string to get numeric value
    let numStr = stat.value.replace(/[^0-9.]/g, '');
    let target = parseFloat(numStr);
    
    if (isNaN(target)) {
      setDisplayValue(stat.value);
      return;
    }

    let duration = 1200; // ms
    let frameRate = 1000 / 60; // 60fps
    let totalFrames = Math.round(duration / frameRate);
    let frame = 0;

    const timer = setInterval(() => {
      frame++;
      let progress = frame / totalFrames;
      // Ease out quad
      let easeProgress = progress * (2 - progress);
      let currentVal = target * easeProgress;

      if (frame >= totalFrames) {
        clearInterval(timer);
        setDisplayValue(stat.value);
      } else {
        if (isPercent) {
          setDisplayValue(`${currentVal.toFixed(1)}%`);
        } else if (isStar) {
          setDisplayValue(`${currentVal.toFixed(1)}★`);
        } else if (isPlus) {
          if (target > 1000000) {
            setDisplayValue(`${(currentVal / 1000000).toFixed(1)}M+`);
          } else {
            setDisplayValue(`${Math.floor(currentVal)}+`);
          }
        } else {
          setDisplayValue(Math.floor(currentVal).toString());
        }
      }
    }, frameRate);

    return () => clearInterval(timer);
  }, [isInView, stat.value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-2 border-r border-white/10 last:border-0 pr-4"
    >
      <span className="text-4xl lg:text-5xl font-display font-black text-amazon-gold tracking-tight">
        {displayValue}
      </span>
      <h3 className="text-sm font-bold text-gray-100 tracking-wide">
        {stat.label}
      </h3>
      <p className="text-xs text-gray-300 leading-relaxed font-normal max-w-xs">
        {stat.description}
      </p>
    </motion.div>
  );
}
