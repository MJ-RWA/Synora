import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Radio, 
  Users, 
  Sparkles, 
  LogIn, 
  LogOut, 
  Coffee, 
  Menu, 
  X, 
  LayoutDashboard,
  Cpu,
  Tv,
  Camera
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Notifications } from './Notifications';
import { WatchPartyModal } from './WatchPartyModal';
import { JoinPartyModal } from './JoinPartyModal';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeToggle } from './ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<'embed' | 'custom' | 'screen' | 'netflix' | 'live'>('embed');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="bg-black/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Main Nav */}
            <div className="flex items-center gap-6 lg:gap-8">
              <Link to="/" className="flex items-center gap-2.5 shrink-0">
                <span className="text-2xl sm:text-3xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
                  Synora
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                  Watch Party
                </span>
              </Link>
              
              <div className="hidden md:flex items-center gap-1">
                <Link 
                  to="/" 
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isActive('/') 
                      ? 'bg-emerald-500/15 text-emerald-400 dark:text-emerald-400 font-black' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio size={14} className="text-emerald-400 shrink-0" />
                  <span>{user ? 'Dashboard' : 'Home'}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setCreateModalTab('embed');
                    setIsCreateModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Sparkles size={14} className="text-emerald-400 shrink-0" />
                  <span>Create Room</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateModalTab('live');
                    setIsCreateModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all border border-red-500/20"
                  title="Broadcast Live Camera"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <Camera size={14} className="shrink-0" />
                  <span>Go Live</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <LogIn size={14} className="text-blue-400 shrink-0" />
                  <span>Join Room</span>
                </button>

                {user && (
                  <Link 
                    to="/friends" 
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isActive('/friends') 
                        ? 'bg-emerald-500/15 text-emerald-400 dark:text-emerald-400 font-black' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Users size={14} className="shrink-0" />
                    <span>Friends</span>
                  </Link>
                )}

                <Link 
                  to="/netflix" 
                  className={`hidden lg:flex px-3 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5 transition-all ${
                    isActive('/netflix') || isActive('/netflix-party')
                      ? 'bg-emerald-500/15 text-emerald-400 dark:text-emerald-400 font-black' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Tv size={14} className="shrink-0" />
                  <span>Netflix</span>
                </Link>

                <Link 
                  to="/how-it-works" 
                  className={`hidden xl:flex px-3 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5 transition-all ${
                    isActive('/how-it-works') 
                      ? 'bg-emerald-500/15 text-emerald-400 dark:text-emerald-400 font-black' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Cpu size={14} className="shrink-0" />
                  <span>How It Works</span>
                </Link>

                <Link 
                  to="/support" 
                  className={`hidden xl:flex px-3 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5 transition-all ${
                    isActive('/support') 
                      ? 'bg-emerald-500/15 text-emerald-400 dark:text-emerald-400 font-black' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Coffee size={14} className="shrink-0" />
                  <span>Support</span>
                </Link>
              </div>
            </div>

            {/* User Profile & Actions Bar */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Theme Toggle Button */}
              <ThemeToggle className="w-9 h-9 p-0 flex items-center justify-center shrink-0" />

              {/* PWA Install Button (desktop) */}
              <div className="hidden lg:block shrink-0">
                <PWAInstallButton variant="navbar" />
              </div>

              {user ? (
                <>
                  <div className="hidden sm:block h-5 w-px bg-white/10 shrink-0 mx-0.5" />

                  <Notifications />
                  
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      className="hidden xl:flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 transition-all text-[10px] font-black uppercase tracking-widest shrink-0"
                    >
                      <LayoutDashboard size={13} /> Admin
                    </Link>
                  )}

                  <Link 
                    to="/profile" 
                    className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white font-black shadow-md shadow-emerald-950/20 hover:scale-105 transition-all text-xs shrink-0"
                    title="Your Profile"
                    aria-label="Your Profile"
                  >
                    {user.displayName?.[0] || 'U'}
                  </Link>

                  <button 
                    type="button"
                    onClick={logout} 
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors shrink-0"
                    title="Logout"
                    aria-label="Logout"
                  >
                    <LogOut size={16} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <Link 
                    to="/login"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/20 shrink-0"
                  >
                    <LogIn size={14} /> Login
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              >
                {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/5 bg-black/95 overflow-hidden"
            >
              <div className="px-4 py-6 space-y-3">
                <Link
                  to="/"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
                    isActive('/') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <Radio size={18} /> {user ? 'App Dashboard' : 'Home'}
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setCreateModalTab('embed');
                    setIsMenuOpen(false);
                    setIsCreateModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-emerald-400 hover:bg-white/5 transition-all text-left"
                >
                  <Sparkles size={18} /> Create Watch Party
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateModalTab('live');
                    setIsMenuOpen(false);
                    setIsCreateModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all text-left"
                >
                  <Camera size={18} />
                  <div className="flex items-center gap-2">
                    <span>Go Live (Camera Party)</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsJoinModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-blue-400 hover:bg-white/5 transition-all text-left"
                >
                  <LogIn size={18} /> Join with Code or Link
                </button>

                {user && (
                  <Link
                    to="/friends"
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
                      isActive('/friends') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <Users size={18} /> Friends
                  </Link>
                )}

                <Link
                  to="/how-it-works"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
                    isActive('/how-it-works') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <Cpu size={18} /> How It Works
                </Link>

                <Link
                  to="/netflix"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
                    isActive('/netflix') || isActive('/netflix-party') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <Tv size={18} /> Netflix Party
                </Link>

                <Link
                  to="/support"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
                    isActive('/support') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <Coffee size={18} /> Support
                </Link>

                {user && isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-emerald-400 hover:bg-white/5 transition-all"
                  >
                    <LayoutDashboard size={18} /> Admin Dashboard
                  </Link>
                )}

                {/* Theme Mode Toggle in Mobile Menu */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-sm font-bold text-gray-300">Theme</span>
                  <ThemeToggle showLabel={true} />
                </div>

                {/* Mobile PWA Install Button */}
                <div className="pt-1 pb-1">
                  <PWAInstallButton variant="mobile" />
                </div>

                {user ? (
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-red-500 hover:bg-white/5 transition-all text-left"
                  >
                    <LogOut size={18} /> Logout
                  </button>
                ) : (
                  <div className="pt-2 border-t border-white/5">
                    <Link
                      to="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-bold bg-emerald-600 text-white shadow-lg transition-all"
                    >
                      <LogIn size={16} /> Login
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Persistent Modals */}
      <WatchPartyModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        defaultTab={createModalTab}
      />

      <JoinPartyModal 
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </>
  );
};
