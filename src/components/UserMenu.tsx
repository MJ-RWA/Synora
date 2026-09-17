import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User as UserIcon, 
  Users, 
  LayoutDashboard, 
  LogOut, 
  ChevronDown, 
  Download,
  Chrome,
  Facebook,
  Instagram
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface UserMenuProps {
  className?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({ className = '' }) => {
  const { user, userData, logout, isAdmin } = useAuth();
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  const displayName = user.displayName || userData?.username || 'User';
  const email = user.email || '';
  const photoUrl = !imageError ? (user.photoURL || userData?.avatarUrl) : null;
  const initial = (displayName[0] || email[0] || 'U').toUpperCase();
  
  const isGoogleConnected = user.providerData?.some(
    (p) => p.providerId === 'google.com'
  );
  const isFacebookConnected = user.providerData?.some(
    (p) => p.providerId === 'facebook.com'
  );
  const isInstagramConnected = user.providerData?.some(
    (p) => p.providerId === 'instagram.com'
  );

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Avatar Trigger Button */}
      <button
        type="button"
        id="user-profile-menu-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User profile menu"
        className="group flex items-center gap-1.5 p-0.5 rounded-xl border border-white/10 hover:border-emerald-500/40 bg-white/5 hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
      >
        <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-black text-xs shadow-inner">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initial}</span>
          )}
          {/* Subtle online status indicator */}
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black" />
        </div>

        <ChevronDown
          size={13}
          className={`text-gray-400 group-hover:text-white transition-transform duration-200 mr-1 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#111111]/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/80 z-50 overflow-hidden text-gray-200"
          >
            {/* User Info Header */}
            <div className="p-4 bg-white/[0.03] border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-black text-base shadow-md">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      onError={() => setImageError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-white text-sm truncate leading-snug">
                      {displayName}
                    </p>
                  </div>
                  {email && (
                    <p className="text-xs text-gray-400 truncate leading-snug">
                      {email}
                    </p>
                  )}

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {isGoogleConnected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                        <Chrome size={10} className="text-emerald-400" />
                        Google
                      </span>
                    )}
                    {isFacebookConnected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold">
                        <Facebook size={10} className="text-blue-400 fill-current" />
                        Facebook
                      </span>
                    )}
                    {isInstagramConnected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[10px] font-semibold">
                        <Instagram size={10} className="text-pink-400" />
                        Instagram
                      </span>
                    )}
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Options */}
            <div className="p-2 space-y-1">
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-emerald-400 shrink-0">
                  <UserIcon size={14} />
                </div>
                <div className="flex-1">
                  <span>Your Profile</span>
                </div>
              </Link>

              <Link
                to="/friends"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-teal-400 shrink-0">
                  <Users size={14} />
                </div>
                <div className="flex-1">
                  <span>Friends & Invitations</span>
                </div>
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                    <LayoutDashboard size={14} />
                  </div>
                  <div className="flex-1">
                    <span>Admin Dashboard</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    Panel
                  </span>
                </Link>
              )}

              {/* Install App button inside dropdown for devices where navbar button is hidden */}
              {(isInstallable || isIOS) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (isInstallable) {
                      install();
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-blue-400 shrink-0">
                    <Download size={14} />
                  </div>
                  <div className="flex-1">
                    <span>Install Synora App</span>
                  </div>
                </button>
              )}
            </div>

            {/* Logout Footer */}
            <div className="p-2 border-t border-white/10">
              <button
                type="button"
                id="user-profile-logout-button"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                  <LogOut size={14} />
                </div>
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
