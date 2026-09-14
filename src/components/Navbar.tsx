import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Radio, 
  Users, 
  LogIn, 
  LogOut, 
  Coffee, 
  Menu, 
  X, 
  LayoutDashboard,
  Cpu,
  Tv,
  Plus,
  ChevronDown,
  User as UserIcon,
  Download,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Notifications } from './Notifications';
import { WatchPartyModal } from './WatchPartyModal';
import { JoinPartyModal } from './JoinPartyModal';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeToggle } from './ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsMoreMenuOpen(false);
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      <header className="bg-black/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand Identity & Primary Nav Links */}
            <div className="flex items-center gap-6 lg:gap-8">
              {/* Brand Logo */}
              <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-black font-black text-sm shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  S
                </div>
                <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
                  Synora
                </span>
              </Link>
              
              {/* Desktop Primary Nav (Decluttered & Spacious) */}
              <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
                {/* Dashboard / Home */}
                <Link 
                  to="/" 
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isActive('/') 
                      ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20' 
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio size={14} className={isActive('/') ? 'text-emerald-400' : 'text-zinc-400'} />
                  <span>{user ? 'Dashboard' : 'Home'}</span>
                </Link>

                {/* Friends (Authenticated) */}
                {user && (
                  <Link 
                    to="/friends" 
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isActive('/friends') 
                        ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20' 
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Users size={14} className={isActive('/friends') ? 'text-emerald-400' : 'text-zinc-400'} />
                    <span>Friends</span>
                  </Link>
                )}

                {/* Netflix Party */}
                <Link 
                  to="/netflix" 
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isActive('/netflix') || isActive('/netflix-party')
                      ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20' 
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Tv size={14} className={isActive('/netflix') ? 'text-emerald-400' : 'text-zinc-400'} />
                  <span>Netflix Party</span>
                </Link>

                {/* 'More' Dropdown for Secondary Links */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(prev => !prev)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                      isMoreMenuOpen || isActive('/how-it-works') || isActive('/support')
                        ? 'text-white bg-white/5' 
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                    aria-expanded={isMoreMenuOpen}
                    aria-label="More navigation links"
                  >
                    <span>More</span>
                    <ChevronDown size={13} className={`transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180 text-emerald-400' : 'text-zinc-500'}`} />
                  </button>

                  <AnimatePresence>
                    {isMoreMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-2 w-48 rounded-2xl bg-zinc-950/95 border border-zinc-800 shadow-2xl p-1.5 backdrop-blur-2xl z-50 text-xs"
                      >
                        <Link
                          to="/how-it-works"
                          onClick={() => setIsMoreMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
                        >
                          <Cpu size={14} className="text-emerald-400" />
                          <span>How It Works</span>
                        </Link>

                        <Link
                          to="/support"
                          onClick={() => setIsMoreMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
                        >
                          <Coffee size={14} className="text-amber-400" />
                          <span>Support Synora</span>
                        </Link>

                        {/* Install app if installable */}
                        {(!isInstalled && (isInstallable || isIOS)) && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsMoreMenuOpen(false);
                              if (isInstallable) install();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium text-left"
                          >
                            <Download size={14} className="text-emerald-400" />
                            <span>Install Desktop App</span>
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </nav>
            </div>

            {/* Right: Actions, Utilities & User Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Quick Party Action Buttons (Desktop) */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  id="nav-join-room-btn"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 hover:border-zinc-600 transition-all flex items-center gap-1.5"
                >
                  <LogIn size={13} className="text-blue-400" />
                  <span>Join</span>
                </button>

                <button
                  type="button"
                  id="nav-create-room-btn"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-sm shadow-emerald-950 transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus size={14} className="text-white" />
                  <span>Create Party</span>
                </button>
              </div>

              <div className="hidden sm:block h-5 w-px bg-white/10 mx-0.5" />

              {/* Theme Toggle Button */}
              <ThemeToggle className="w-8 h-8 sm:w-9 sm:h-9 p-0 flex items-center justify-center shrink-0 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all text-zinc-400 hover:text-white" />

              {/* Notifications Bell (for logged in users) */}
              {user && <Notifications />}

              {/* User Account / Profile Dropdown */}
              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    id="nav-user-menu-btn"
                    onClick={() => setIsUserMenuOpen(prev => !prev)}
                    className="flex items-center gap-1.5 p-0.5 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
                    aria-expanded={isUserMenuOpen}
                    aria-label="User account menu"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-emerald-950/30">
                      {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                    </div>
                    <ChevronDown 
                      size={12} 
                      className={`hidden sm:block text-zinc-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-950/95 border border-zinc-800 shadow-2xl p-2 backdrop-blur-2xl z-50 text-xs flex flex-col gap-1"
                      >
                        {/* User Identity Header */}
                        <div className="px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800/60 mb-1">
                          <p className="font-bold text-zinc-100 truncate">
                            {user.displayName || 'Synora User'}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {user.email || 'Member'}
                          </p>
                          {isAdmin && (
                            <span className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              <ShieldCheck size={11} /> Admin
                            </span>
                          )}
                        </div>

                        {/* Dropdown Items */}
                        <Link
                          to="/profile"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
                        >
                          <UserIcon size={14} className="text-zinc-400" />
                          <span>My Profile</span>
                        </Link>

                        <Link
                          to="/friends"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
                        >
                          <Users size={14} className="text-zinc-400" />
                          <span>Friends</span>
                        </Link>

                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors font-medium"
                          >
                            <LayoutDashboard size={14} />
                            <span>Admin Dashboard</span>
                          </Link>
                        )}

                        <div className="h-px bg-zinc-800/80 my-1" />

                        <Link
                          to="/how-it-works"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors font-medium text-[11px]"
                        >
                          <HelpCircle size={13} />
                          <span>How It Works</span>
                        </Link>

                        <Link
                          to="/support"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors font-medium text-[11px]"
                        >
                          <Coffee size={13} />
                          <span>Support Synora</span>
                        </Link>

                        <div className="h-px bg-zinc-800/80 my-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            logout();
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors font-medium text-left"
                        >
                          <LogOut size={14} />
                          <span>Log Out</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link 
                    to="/login"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-950"
                  >
                    <LogIn size={13} />
                    <span>Log In</span>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Toggle Button */}
              <button 
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-zinc-800/80 bg-black/95 backdrop-blur-2xl overflow-hidden"
            >
              <div className="px-4 py-5 space-y-2">
                {/* Mobile Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
                  >
                    <Plus size={15} />
                    <span>Create Room</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsJoinModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-zinc-900 border border-zinc-700/80 text-zinc-200"
                  >
                    <LogIn size={15} className="text-blue-400" />
                    <span>Join Room</span>
                  </button>
                </div>

                <Link
                  to="/"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive('/') ? 'bg-emerald-500/15 text-emerald-400 font-bold' : 'text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Radio size={16} />
                  <span>{user ? 'App Dashboard' : 'Home'}</span>
                </Link>

                {user && (
                  <Link
                    to="/friends"
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive('/friends') ? 'bg-emerald-500/15 text-emerald-400 font-bold' : 'text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <Users size={16} />
                    <span>Friends</span>
                  </Link>
                )}

                <Link
                  to="/netflix"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive('/netflix') || isActive('/netflix-party') ? 'bg-emerald-500/15 text-emerald-400 font-bold' : 'text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Tv size={16} />
                  <span>Netflix Party</span>
                </Link>

                <Link
                  to="/how-it-works"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive('/how-it-works') ? 'bg-emerald-500/15 text-emerald-400 font-bold' : 'text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Cpu size={16} />
                  <span>How It Works</span>
                </Link>

                <Link
                  to="/support"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive('/support') ? 'bg-emerald-500/15 text-emerald-400 font-bold' : 'text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Coffee size={16} />
                  <span>Support Synora</span>
                </Link>

                {user && (
                  <Link
                    to="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive('/profile') ? 'bg-emerald-500/15 text-emerald-400 font-bold' : 'text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <UserIcon size={16} />
                    <span>My Profile</span>
                  </Link>
                )}

                {user && isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold text-emerald-400 hover:bg-white/5 transition-all"
                  >
                    <LayoutDashboard size={16} />
                    <span>Admin Dashboard</span>
                  </Link>
                )}

                {/* Theme Mode Toggle in Mobile Menu */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-300">Theme</span>
                  <ThemeToggle showLabel={true} />
                </div>

                {/* Mobile PWA Install */}
                <div className="pt-1">
                  <PWAInstallButton variant="mobile" />
                </div>

                {/* Mobile Auth action */}
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-500/10 transition-all text-left"
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                ) : (
                  <div className="pt-2">
                    <Link
                      to="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-lg transition-all"
                    >
                      <LogIn size={15} />
                      <span>Log In</span>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

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
