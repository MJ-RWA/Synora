import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Coffee, Copy, Check, Bitcoin, Heart, ArrowRight } from 'lucide-react';

export const Support = () => {
  const [copied, setCopied] = useState(false);
  const btcAddress = "bc1q5hs9xucu6krrskjum6rpwaml0mv3ajhuxq5ww4r";

  const copyAddress = () => {
    navigator.clipboard.writeText(btcAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 bg-black">
      <div className="max-w-2xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/10 rounded-full mb-6">
            <Heart className="text-emerald-500 w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Support this site ❤️</h1>
          <p className="text-gray-400 text-lg">
            If you enjoy using this platform and want to help keep it running, consider supporting us. 
            Your donations help cover server costs and development.
          </p>
        </motion.div>

        <div className="grid gap-8">
          {/* Bitcoin Support Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 shadow-2xl backdrop-blur-sm"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                <Bitcoin className="text-orange-500 w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Donate with Bitcoin</h2>
                <p className="text-gray-500 text-sm">Fast and secure crypto donation</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-8">
              {/* QR Code */}
              <div className="bg-white p-4 rounded-2xl shadow-xl">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${btcAddress}`}
                  alt="Bitcoin QR Code"
                  className="w-48 h-48"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Address Display */}
              <div className="w-full space-y-3">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">
                  Bitcoin Address
                </label>
                <div className="flex items-center gap-2 p-4 bg-black/40 border border-white/10 rounded-2xl group">
                  <code className="flex-1 text-emerald-500 font-mono text-sm break-all">
                    {btcAddress}
                  </code>
                  <button 
                    onClick={copyAddress}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all active:scale-95"
                    title="Copy Address"
                  >
                    {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                  </button>
                </div>
                {copied && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-emerald-500 text-xs font-bold"
                  >
                    Address copied to clipboard!
                  </motion.p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Buy Me A Coffee Style Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-emerald-600 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-emerald-900/20"
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Coffee className="text-white w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">Buy me a coffee</h3>
                <p className="text-emerald-100/70">Support the developer directly</p>
              </div>
            </div>
            <button className="px-8 py-4 bg-white text-emerald-600 font-black rounded-2xl hover:bg-emerald-50 transition-all shadow-xl flex items-center gap-2 group">
              Support Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* Footer Info */}
          <p className="text-center text-gray-600 text-sm">
            Thank you for being part of our community. 
            Every contribution helps us grow.
          </p>
        </div>
      </div>
    </div>
  );
};
