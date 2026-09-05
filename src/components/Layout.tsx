import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { FloatingSupport } from './FloatingSupport';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallButton } from './PWAInstallButton';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isWatchRoom = location.pathname.startsWith('/watchparty') || 
                      location.pathname.startsWith('/watch-party') || 
                      location.pathname.startsWith('/room');

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30">
      {/* Network connectivity monitor */}
      <OfflineIndicator />

      {/* Hide sticky Navbar on mobile during watch party so the video player can dock cleanly at top-0 */}
      <div className={isWatchRoom ? 'hidden md:block' : ''}>
        <Navbar />
      </div>
      <main className={`relative ${isWatchRoom ? 'pt-0' : 'pt-4 md:pt-0'}`}>
        {children}
      </main>
      {/* Hide FloatingSupport in watch room to prevent blocking mobile chat input */}
      {!isWatchRoom && <FloatingSupport />}
      
      {/* Hide footer in watch room to allow fluid chat scrolling */}
      {!isWatchRoom && (
        <footer className="bg-black border-t border-white/5 py-12 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              <div className="col-span-2 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
                    Synora
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                    Watch Party
                  </span>
                </div>
                <p className="text-gray-400 max-w-sm text-sm leading-relaxed">
                  The real-time social Watch Party platform. Synchronize video playback, chat with friends, talk over crystal-clear voice chat, and share your screen together.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white">Platform</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><Link to="/" className="hover:text-emerald-400 transition-colors">Live Rooms</Link></li>
                  <li><Link to="/friends" className="hover:text-emerald-400 transition-colors">Friends</Link></li>
                  <li><Link to="/profile" className="hover:text-emerald-400 transition-colors">My Profile</Link></li>
                  <li><Link to="/support" className="hover:text-emerald-400 transition-colors font-bold text-emerald-400">Support</Link></li>
                  <li><PWAInstallButton variant="footer" /></li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white">Legal & Safety</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><Link to="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</Link></li>
                  <li><Link to="/terms" className="hover:text-emerald-400 transition-colors">Terms of Service</Link></li>
                  <li><Link to="/dmca" className="hover:text-emerald-400 transition-colors">DMCA Guidelines</Link></li>
                  <li><Link to="/support" className="hover:text-emerald-400 transition-colors">Contact Support</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/5 mt-12 pt-8 text-center text-xs text-gray-500">
              © {new Date().getFullYear()} Synora Watch Party. Built for synchronized social co-watching.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
