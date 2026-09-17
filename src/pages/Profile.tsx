import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Mail, 
  Calendar, 
  LogOut, 
  Clock, 
  Award, 
  Users, 
  Edit3, 
  Check, 
  Sparkles, 
  Crown, 
  Film, 
  Flame, 
  Moon, 
  Video,
  Facebook,
  Instagram,
  Chrome,
  Loader2
} from 'lucide-react';
import { SYNORA_ACHIEVEMENTS } from '../config/achievements';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const Profile = () => {
  const { user, userData, logout, isAdmin, updateUsername } = useAuth();
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState(userData?.bio || '');
  const [customStatusText, setCustomStatusText] = useState(userData?.customStatus || '');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Username edit state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Avatar error fallback state
  const [imageError, setImageError] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
          <Users size={32} />
        </div>
        <h2 className="text-2xl font-black text-white">Join the Synora Community</h2>
        <p className="text-gray-400 max-w-sm text-sm">Sign in to track your watch hours, earn achievements, and connect with watch party friends.</p>
        <Link 
          to="/login" 
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
        >
          Sign In / Create Account
        </Link>
      </div>
    );
  }

  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed || isSavingUsername) return;
    if (trimmed.length < 2) {
      setUsernameError('Username must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 30) {
      setUsernameError('Username cannot exceed 30 characters.');
      return;
    }

    setIsSavingUsername(true);
    setUsernameError('');
    try {
      await updateUsername(trimmed);
      setIsEditingUsername(false);
      showToast('Username updated successfully!');
    } catch (err: unknown) {
      const error = err as Error;
      setUsernameError(error.message || 'Failed to update username.');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user.uid || isSaving) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        bio: bioText.trim(),
        customStatus: customStatusText.trim(),
      });
      setIsEditingBio(false);
      showToast('Profile updated successfully');
    } catch {
      showToast('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const totalMinutes = Math.floor((userData?.totalWatchSeconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const watchTimeFormatted = `${hours}h ${minutes}m`;

  const unlockedBadges = new Set(userData?.badges || []);

  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Crown': return <Crown size={20} />;
      case 'Film': return <Film size={20} />;
      case 'Flame': return <Flame size={20} />;
      case 'Users': return <Users size={20} />;
      case 'Moon': return <Moon size={20} />;
      default: return <Sparkles size={20} />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'diamond': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
      case 'gold': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'silver': return 'text-slate-300 border-slate-400/30 bg-slate-400/10';
      default: return 'text-amber-600 border-amber-700/30 bg-amber-700/10';
    }
  };

  const photoUrl = !imageError ? (user.photoURL || userData?.avatarUrl) : null;
  const displayName = user.displayName || userData?.username || 'Synora Member';
  const initial = (displayName[0] || user.email?.[0] || 'U').toUpperCase();

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-[#111111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
        <div className="relative bg-gradient-to-r from-emerald-950 via-slate-900 to-[#121212] p-8 border-b border-white/5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar with Presence Indicator - Displays Facebook/Instagram/Google profile photo */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white text-4xl font-black shadow-2xl border-2 border-white/20">
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
              <span 
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#111111]" 
                title="Online on Synora" 
              />
            </div>

            {/* Profile Meta */}
            <div className="flex-1 text-center sm:text-left space-y-2.5 min-w-0">
              {/* Editable Username Row */}
              {!isEditingUsername ? (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {displayName}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput(displayName);
                      setUsernameError('');
                      setIsEditingUsername(true);
                    }}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-emerald-400 transition-all cursor-pointer"
                    title="Edit Username"
                    aria-label="Edit Username"
                  >
                    <Edit3 size={15} />
                  </button>
                  {isAdmin ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                      Admin
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                      Member
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-w-md mx-auto sm:mx-0">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    Edit Your Username
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Enter new username"
                      maxLength={30}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveUsername();
                        if (e.key === 'Escape') setIsEditingUsername(false);
                      }}
                      className="flex-1 bg-black/80 border border-emerald-500/50 rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <button 
                      type="button"
                      onClick={handleSaveUsername}
                      disabled={isSavingUsername || !usernameInput.trim()}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow shrink-0"
                    >
                      {isSavingUsername ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Save
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsEditingUsername(false)}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                  {usernameError && (
                    <p className="text-xs text-red-400 font-medium">{usernameError}</p>
                  )}
                </div>
              )}

              {/* Connected Auth Providers Badges */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                {user.providerData?.map((p) => {
                  if (p.providerId === 'facebook.com') {
                    return (
                      <span key={p.providerId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                        <Facebook size={12} className="fill-current" /> Facebook Account
                      </span>
                    );
                  }
                  if (p.providerId === 'instagram.com') {
                    return (
                      <span key={p.providerId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold">
                        <Instagram size={12} /> Instagram Account
                      </span>
                    );
                  }
                  if (p.providerId === 'google.com') {
                    return (
                      <span key={p.providerId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        <Chrome size={12} /> Google Account
                      </span>
                    );
                  }
                  if (p.providerId === 'password') {
                    return (
                      <span key={p.providerId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold">
                        <Mail size={12} /> Email & Password
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Status / Bio */}
              {!isEditingBio ? (
                <div className="space-y-1">
                  <p className="text-sm text-gray-300">
                    {userData?.bio || "Social watch party enthusiast. Watching movies & videos in sync."}
                  </p>
                  {userData?.customStatus && (
                    <p className="text-xs text-emerald-400 font-medium">
                      Status: {userData.customStatus}
                    </p>
                  )}
                  <button 
                    onClick={() => {
                      setBioText(userData?.bio || '');
                      setCustomStatusText(userData?.customStatus || '');
                      setIsEditingBio(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-400 transition-colors pt-1 font-bold"
                  >
                    <Edit3 size={13} /> Edit Bio & Status
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2 max-w-lg">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">About You (Bio)</label>
                    <input 
                      type="text"
                      maxLength={120}
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      placeholder="e.g. Cinephile, anime fan, weekend streamer..."
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Custom Status</label>
                    <input 
                      type="text"
                      maxLength={60}
                      value={customStatusText}
                      onChange={(e) => setCustomStatusText(e.target.value)}
                      placeholder="e.g. Ready for Watch Party 🍿"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow"
                    >
                      <Check size={14} /> Save
                    </button>
                    <button 
                      onClick={() => setIsEditingBio(false)}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Link 
                to="/friends"
                className="p-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-2xl border border-white/10 transition-all flex items-center gap-2 text-xs font-bold"
                title="View Friends"
              >
                <Users size={16} />
                <span className="hidden sm:inline">Friends</span>
              </Link>
              <Link 
                to="/"
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition-all flex items-center gap-2 text-xs font-bold shadow-lg shadow-emerald-900/20"
                title="Explore Watch Parties"
              >
                <Video size={16} />
                <span>Join Party</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/5 border-b border-white/5">
          <div className="p-6 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-emerald-400">
              <Clock size={18} />
              <span className="text-xl sm:text-2xl font-black">{watchTimeFormatted}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Watch Time</p>
          </div>

          <div className="p-6 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-blue-400">
              <Award size={18} />
              <span className="text-xl sm:text-2xl font-black">{unlockedBadges.size} / {SYNORA_ACHIEVEMENTS.length}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Badges Unlocked</p>
          </div>

          <div className="p-6 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-purple-400">
              <Users size={18} />
              <span className="text-xl sm:text-2xl font-black">{userData?.friends?.length || 0}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Friends</p>
          </div>

          <div className="p-6 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-amber-400">
              <Calendar size={18} />
              <span className="text-sm sm:text-base font-black">
                {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'Active'}
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Member Since</p>
          </div>
        </div>

        {/* Achievements Showcase */}
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Sparkles size={20} className="text-emerald-400" />
                Achievements & Badges
              </h2>
              <p className="text-xs text-gray-400">Unlock social badges by watching together, hosting rooms, and connecting with friends.</p>
            </div>
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              {Math.round((unlockedBadges.size / SYNORA_ACHIEVEMENTS.length) * 100)}% Complete
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {SYNORA_ACHIEVEMENTS.map(badge => {
              const isUnlocked = unlockedBadges.has(badge.id);
              return (
                <div 
                  key={badge.id}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3 relative overflow-hidden ${
                    isUnlocked 
                      ? 'bg-white/5 border-white/15 shadow-md' 
                      : 'bg-black/30 border-white/5 opacity-60'
                  }`}
                >
                  <div className={`p-3 rounded-xl border shrink-0 ${getTierColor(badge.tier)}`}>
                    {getBadgeIcon(badge.icon)}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-sm font-bold truncate ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                        {badge.name}
                      </h4>
                      {isUnlocked && (
                        <Check size={14} className="text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                      {badge.description}
                    </p>
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-gray-500 pt-1">
                      {badge.tier}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Details & Sign Out */}
        <div className="p-8 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <Mail size={16} className="text-gray-500" />
            <span>Connected email: <span className="text-white font-medium">{user.email}</span></span>
          </div>

          <button 
            id="profile-sign-out-btn"
            onClick={logout}
            className="w-full sm:w-auto px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all font-bold text-xs flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

