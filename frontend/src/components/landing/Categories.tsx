import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, ClipboardCheck, ArrowRight, Filter } from 'lucide-react';
import { Product } from '../../types';

interface CategoriesProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export default function Categories({ products, onSelectProduct }: CategoriesProps) {
  const [selectedCategory, setSelectedCategory] = useState('All Gigs');
  const categories = ['All Gigs', 'Amazon Gigs', 'Alibaba Gigs', 'Shopify Gigs'];

  const filteredProducts = selectedCategory === 'All Gigs'
    ? products
    : products.filter(p => `${p.platform} Gigs` === selectedCategory);

  return (
    <section id="categories" className="py-12 md:py-16 bg-white font-sans border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        
        {/* Simplified Premium Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 space-y-4 md:space-y-0">
          <div className="text-left">
            <h2 className="text-2xl font-black text-[#131921] tracking-tight">
              Active Evaluation Gigs
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-md">
              Select an active launch campaign. Complete the feedback evaluation to claim instant credit.
            </p>
          </div>

          {/* Clean filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#131921] text-white shadow-sm'
                    : 'bg-[#F3F4F6] text-gray-600 hover:bg-gray-200 border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Minimalists Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              whileHover={{ y: -3 }}
              className="bg-white rounded-xl border border-gray-100 hover:border-amazon-gold shadow-xs hover:shadow-sm transition duration-200 flex flex-col overflow-hidden text-left"
            >
              {/* Product Image Box */}
              <div className="relative bg-[#F8F9FA] h-48 flex items-center justify-center p-6 border-b border-gray-100">
                <img
                  src={product.image}
                  alt={product.title}
                  className="max-h-full max-w-full object-contain rounded-md"
                  referrerPolicy="no-referrer"
                />
                
                {/* Brand Badge */}
                <span className="absolute top-3 left-3 bg-[#131921] text-white font-black text-[9px] tracking-wider uppercase px-2 py-0.5 rounded shadow-xs">
                  {product.platform}
                </span>

                {/* Rating */}
                <div className="absolute bottom-3 left-3 flex items-center space-x-1 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md border border-gray-200/50 text-[10px] font-bold text-amazon-gold">
                  <Star className="h-3 w-3 fill-current text-amazon-gold" />
                  <span className="text-gray-700">{product.rating}</span>
                </div>
              </div>

              {/* Minimal Card Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <h3 
                    onClick={() => onSelectProduct(product)}
                    className="text-xs font-bold text-gray-900 hover:text-amazon-blue line-clamp-1 leading-tight cursor-pointer"
                  >
                    {product.title}
                  </h3>
                  <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed font-normal">
                    {product.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider font-extrabold leading-none">Task Reward</span>
                    <span className="text-base font-mono font-extrabold text-green-600 mt-0.5">
                      +${product.payout.toFixed(2)} USD
                    </span>
                  </div>
                  
                  <button
                    onClick={() => onSelectProduct(product)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#F7CA00] hover:bg-[#E2B600] active:bg-[#CBA300] border border-[#a88734] rounded-lg text-[10px] font-black text-amazon-dark shadow-xs transition cursor-pointer"
                  >
                    <span>Claim Task</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
