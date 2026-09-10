import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Mic, 
  MicOff, 
  Shield, 
  Crown, 
  UserPlus, 
  UserCheck, 
  MessageSquare, 
  Clock, 
  Award, 
  X,
  VolumeX,
  Volume2,
  UserX
} from 'lucide-react';
import { motion } from 'framer-motion';
import { WatchRoomUser, User } from '../types';
import { getUserProfile, hostMuteParticipant } from '../services/socialService';
import { isUserLive, formatLastSeen } from '../services/presenceService';

interface SocialParticipantModalProps {
  user: WatchRoomUser;
  currentUser: User | null;
  currentUserId: string;
  isCurrentUserHost: boolean;
  roomId: string;
  isFriend: boolean;
  onAddFriend?: (targetUser: WatchRoomUser) => void;
  onRemoveFriend?: (targetUserId: string) => void;
  onMentionUser?: (username: string) => void;
  onKickUser?: (targetUserId: string) => void;
  onClose: () => void;
  onToast?: (message: string) => void;
}

export const SocialParticipantModal: React.FC<SocialParticipantModalProps> = ({
  user,
  currentUser,
  currentUserId,
  isCurrentUserHost,
  roomId,
  isFriend,
  onAddFriend,
  onRemoveFriend,
  onMentionUser,
  onKickUser,
  onClose,
  onToast
}) => {
  const [profileData, setProfileData] = useState<User | null>(null);
  const [isMuting, setIsMuting] = useState<boolean>(false);

  const isSelf = user.uid === currentUserId || user.id === currentUserId;
  const canModerate = isCurrentUserHost && !user.isHost && !isSelf;

  useEffect(() => {
    let active = true;
    if (user.uid) {
      getUserProfile(user.uid)
        .then(data => {
          if (active && data) setProfileData(data);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user.uid]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  const handleToggleMute = async () => {
    if (!canModerate || isMuting) return;
    setIsMuting(true);
    const nextMuteState = !user.mutedByHost;
    const success = await hostMuteParticipant(roomId, user.id, nextMuteState);
    setIsMuting(false);
    if (success) {
      onToast?.(nextMuteState ? `Muted ${user.username}` : `Unmuted ${user.username}`);
    } else {
      onToast?.('Failed to update participant mute state');
    }
  };

  const totalMinutes = Math.floor((profileData?.totalWatchSeconds || 0) / 60);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label={`${user.username}'s profile`}
    >
      {/* Full viewport backdrop overlay covering the fixed player and intercepting outside clicks */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
      />

      {/* Centering and scroll alignment layer */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center pointer-events-none">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm bg-[#161616] border border-white/10 rounded-[28px] p-5 sm:p-6 shadow-2xl text-center space-y-4 sm:space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain z-10 pointer-events-auto"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-all"
            aria-label="Close user modal"
          >
            <X size={16} />
          </button>

        {/* User Header Avatar */}
        <div className="relative mx-auto w-20 h-20">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg border-2 ${
            user.isHost 
              ? 'bg-emerald-600 text-white border-emerald-400/50 shadow-emerald-900/30' 
              : 'bg-gradient-to-tr from-slate-800 to-slate-700 text-gray-200 border-white/15'
          }`}>
            {user.username[0]?.toUpperCase() || 'U'}
          </div>
          {user.isHost && (
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black p-1 rounded-full shadow border-2 border-[#161616]" title="Room Host">
              <Crown size={12} className="fill-current" />
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-xl font-black text-white">{user.username}</h3>
            {user.isHost && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                Host
              </span>
            )}
          </div>
          <div className="flex items-center justify-center pt-1">
            {isUserLive(user) ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE • Watching Now</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                <span>OFFLINE • {formatLastSeen(user.lastSeen)}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {profileData?.bio || (user.isHost ? 'Guiding the Watch Party' : 'Watching together in sync')}
          </p>
        </div>

        {/* Audio / Mic Status Bar */}
        <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {user.mutedByHost ? (
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <VolumeX size={16} />
              </div>
            ) : user.micActive === false ? (
              <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                <MicOff size={16} />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Mic size={16} />
              </div>
            )}
            <div className="text-left">
              <p className="font-bold text-gray-200">
                {user.mutedByHost ? 'Muted by Host' : user.micActive === false ? 'Microphone Off' : 'Microphone Live'}
              </p>
              <p className="text-[10px] text-gray-500">
                {user.speaking ? 'Active speaker' : 'Voice status'}
              </p>
            </div>
          </div>
          {user.speaking && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>

        {/* Stats Summary if available */}
        {profileData && (
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-bold mb-0.5">
                <Clock size={12} />
                <span>{totalHours} hrs</span>
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Watch Time</p>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center justify-center gap-1 text-amber-400 text-xs font-bold mb-0.5">
                <Award size={12} />
                <span>{profileData.badges?.length || 0}</span>
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Badges</p>
            </div>
          </div>
        )}

        {/* Social Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-2">
            {onMentionUser && (
              <button
                onClick={() => {
                  onMentionUser(user.username);
                  onClose();
                }}
                className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all flex items-center justify-center gap-1.5 border border-white/5"
              >
                <MessageSquare size={14} /> Mention
              </button>
            )}

            {!isSelf && user.uid && currentUser && (
              isFriend ? (
                <button
                  onClick={() => onRemoveFriend?.(user.uid!)}
                  className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-red-500/10 rounded-xl text-xs font-bold text-emerald-400 hover:text-red-400 transition-all flex items-center justify-center gap-1.5 border border-emerald-500/20 hover:border-red-500/20"
                  title="Remove Friend"
                >
                  <UserCheck size={14} /> Friends
                </button>
              ) : (
                <button
                  onClick={() => onAddFriend?.(user)}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-emerald-900/20 flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={14} /> Add Friend
                </button>
              )
            )}
          </div>

          {/* Host Moderation Controls */}
          {canModerate && (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-gray-500 px-1">
                <span>Host Moderation</span>
                <Shield size={12} className="text-amber-400" />
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="host-toggle-mute-participant-btn"
                  onClick={handleToggleMute}
                  disabled={isMuting}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                    user.mutedByHost
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {user.mutedByHost ? (
                    <>
                      <Volume2 size={14} /> Unmute Participant
                    </>
                  ) : (
                    <>
                      <VolumeX size={14} /> Mute Participant
                    </>
                  )}
                </button>

                {onKickUser && (
                  <button
                    onClick={() => {
                      onKickUser(user.id);
                      onClose();
                    }}
                    className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    title="Remove participant from room"
                  >
                    <UserX size={14} /> Kick
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  </div>
);

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
