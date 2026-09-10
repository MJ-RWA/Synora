import React from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOffline } = useOnlineStatus();

  if (isOnline && !wasOffline) {
    return null;
  }

  if (!isOnline) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-32px)] flex items-center gap-2.5 rounded-xl bg-[#141a23] border border-amber-500/40 px-3.5 py-2 text-xs font-medium text-amber-300 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-2 duration-300 backdrop-blur-md"
      >
        <WifiOff size={15} className="text-amber-400 shrink-0 animate-pulse" />
        <span>You are offline. Reconnecting to watch party network...</span>
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-32px)] flex items-center gap-2.5 rounded-xl bg-[#141a23] border border-emerald-500/40 px-3.5 py-2 text-xs font-medium text-emerald-300 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-2 duration-300 backdrop-blur-md"
      >
        <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
        <span>Connection restored. Back online.</span>
      </div>
    );
  }

  return null;
};
