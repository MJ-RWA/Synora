import React from 'react';
import { Radio } from 'lucide-react';

export const AppShellLoader: React.FC = () => {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/40">
          <Radio size={32} className="animate-pulse" />
        </div>
        <div className="absolute -inset-2 rounded-3xl bg-emerald-500/20 blur-xl -z-10 animate-pulse" />
      </div>
      
      <div className="space-y-2 max-w-xs">
        <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
          Synora
        </h2>
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-400">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Restoring session & sync...</span>
        </div>
      </div>
    </div>
  );
};
