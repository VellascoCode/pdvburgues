import React from 'react';
import { motion } from 'framer-motion';
import { FaHamburger, FaCoffee, FaBeer, FaIceCream, FaPizzaSlice, FaCocktail, FaUtensils, FaGlassWhiskey } from 'react-icons/fa';

export default function BgFood({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 pointer-events-none opacity-25 ${className}`}>
      <div className="grid grid-cols-8 gap-10 p-10 text-white/70">
        {Array.from({ length: 80 }).map((_, i) => (
          <motion.div
            key={i}
            className="flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: [0, 5, -5, 0] }}
            transition={{ duration: 8 + (i % 5), repeat: Infinity, delay: (i % 8) * 0.2, ease: 'easeInOut' }}
          >
            {(() => {
              const color = ['text-orange-400','text-yellow-400','text-rose-400','text-emerald-400','text-cyan-400'][i%5];
              const cls = `text-2xl ${color}`;
              const idx = i % 8;
              switch (idx) {
                case 0: return <FaHamburger className={cls} />;
                case 1: return <FaPizzaSlice className={cls} />;
                case 2: return <FaCoffee className={cls} />;
                case 3: return <FaBeer className={cls} />;
                case 4: return <FaGlassWhiskey className={cls} />;
                case 5: return <FaIceCream className={cls} />;
                case 6: return <FaCocktail className={cls} />;
                default: return <FaUtensils className={cls} />;
              }
            })()}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

