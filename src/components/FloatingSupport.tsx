import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { motion } from 'framer-motion';

export const FloatingSupport = () => {
  const navigate = useNavigate();

  return (
    <motion.button
      id="floating-support-btn"
      onClick={() => navigate('/support')}
      initial={{ scale: 1 }}
      animate={{ 
        scale: [1, 1.06, 1],
      }}
      transition={{ 
        duration: 2.5, 
        repeat: Infinity,
        ease: "easeInOut"
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Support Synora"
      className="fixed bottom-16 sm:bottom-6 left-3 sm:left-6 z-40 bg-[#ff813f] hover:bg-[#ff7125] text-white px-3.5 py-2.5 sm:px-5 sm:py-3.5 rounded-full font-bold shadow-2xl flex items-center gap-2 transition-all select-none border border-white/10"
    >
      <Coffee size={18} className="sm:w-5 sm:h-5 shrink-0" />
      <span className="text-xs sm:text-sm font-black tracking-wide">Support</span>
    </motion.button>
  );
};
