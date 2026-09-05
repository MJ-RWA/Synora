import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { motion } from 'framer-motion';

export const FloatingSupport = () => {
  const navigate = useNavigate();

  return (
    <motion.button
      onClick={() => navigate('/support')}
      initial={{ scale: 1 }}
      animate={{ 
        scale: [1, 1.1, 1],
      }}
      transition={{ 
        duration: 2, 
        repeat: Infinity,
        ease: "easeInOut"
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-5 right-5 z-[9999] bg-[#ff813f] text-white px-4 py-3 md:px-5 md:py-3.5 rounded-full font-bold shadow-2xl flex items-center gap-2 transition-transform"
    >
      <Coffee size={20} className="md:w-6 md:h-6" />
      <span className="text-sm md:text-base">Support</span>
    </motion.button>
  );
};
