import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'mobile' | 'footer';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside an installed PWA, do not show install controls
  if (isInstalled) {
    return null;
  }

  // If browser does not support install prompt and is not iOS, keep UI clean
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleClick = () => {
    if (isInstallable) {
      install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'navbar' && (
        <button
          type="button"
          onClick={handleClick}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all ${className}`}
          title="Install Synora as an App"
          aria-label="Install Synora App"
        >
          <Download size={14} className="text-emerald-400" />
          <span>Install App</span>
        </button>
      )}

      {variant === 'mobile' && (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all ${className}`}
          aria-label="Install Synora App"
        >
          <div className="flex items-center gap-2">
            <Download size={15} className="text-emerald-400" />
            <span>Install Synora App</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded-md">
            PWA
          </span>
        </button>
      )}

      {variant === 'footer' && (
        <button
          type="button"
          onClick={handleClick}
          className={`text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors ${className}`}
          aria-label="Install Synora App"
        >
          <Download size={13} />
          <span>Install App</span>
        </button>
      )}

      {/* Non-intrusive iOS Safari Add to Home Screen Instructions Modal */}
      {showIOSGuide && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowIOSGuide(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-[#0e131b] border border-white/10 p-6 shadow-2xl text-white relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-black">
                <Download size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Install Synora</h3>
                <p className="text-xs text-gray-400">Add to iPhone or iPad Home Screen</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="p-1.5 rounded-lg bg-white/10 text-emerald-400 shrink-0">
                  <Share size={16} />
                </div>
                <div>
                  <span className="font-semibold text-white">Step 1: </span>
                  Tap the <strong className="text-white">Share</strong> button in your Safari navigation bar at the bottom.
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="p-1.5 rounded-lg bg-white/10 text-emerald-400 shrink-0">
                  <PlusSquare size={16} />
                </div>
                <div>
                  <span className="font-semibold text-white">Step 2: </span>
                  Scroll down the share sheet and tap <strong className="text-white">Add to Home Screen</strong>.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
