import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Radio, 
  Users, 
  Sparkles, 
  LogIn, 
  User, 
  LogOut, 
  Coffee, 
  Menu, 
  X, 
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Notifications } from './Notifications';
import { WatchPartyModal } from './WatchPartyModal';
import { JoinPartyModal } from './JoinPartyModal';
import { PWAInstallButton } from './PWAInstallButton';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <span className="text-xl lg:text-2xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
                  Synora
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                  Watch Party
                </span>
              </Link>
              
              <div className="hidden md:flex items-center gap-1">
                <Link 
                  to="/" 
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isActive('/') 
                      ? 'bg-emerald-600/10 text-emerald-400' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio size={15} className="text-emerald-400" />
                  Live Rooms
                </Link>

                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Sparkles size={15} className="text-emerald-400" />
                  Create Room
                </button>

                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <LogIn size={15} className="text-blue-400" />
                  Join Room
                </button>

                {user && (
                  <Link 
                    to="/friends" 
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      isActive('/friends') 
                        ? 'bg-emerald-600/10 text-emerald-400' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Users size={15} />
                    Friends
                  </Link>
                )}

                <Link 
                  to="/support" 
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isActive('/support') 
                      ? 'bg-emerald-600/10 text-emerald-400' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Coffee size={15} />
                  Support
                </Link>
              </div>
            </div>

            {/* User Profile & Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* PWA Install Button (desktop) */}
              <div className="hidden sm:block">
                <PWAInstallButton variant="navbar" />
              </div>

              {/* Quick Create CTA for desktop */}
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="hidden xl:inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
              >
                <Sparkles size={14} /> New Party
              </button>

              {user ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Notifications />
                  
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      <LayoutDashboard size={13} /> Admin
                    </Link>
                  )}

                  <Link 
                    to="/profile" 
                    className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black shadow-md shadow-emerald-900/20 hover:scale-105 transition-transform text-xs"
                    title="Your Profile"
                  >
                    {user.displayName?.[0] || 'U'}
                  </Link>

                  <button 
                    onClick={logout} 
                    className="text-gray-400 hover:text-red-400 p-1.5 transition-colors"
                    title="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link 
                    to="/login"
                    className="text-gray-400 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  >
                    Login
                  </Link>
                  <Link 
                    to="/login"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/20"
                  >
                    <User size={14} /> Sign Up
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
                  <Radio size={18} /> Live Rooms
                </Link>

                <button
                  type="button"
                  onClick={() => {
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
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <Link
                      to="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center p-3 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 transition-all"
                    >
                      Login
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center p-3 rounded-xl text-sm font-bold bg-emerald-600 text-white shadow-lg transition-all"
                    >
                      Sign Up
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
      />

      <JoinPartyModal 
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </>
  );
};
