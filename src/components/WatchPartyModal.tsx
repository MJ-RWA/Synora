import React, { useState, useRef } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { SAMPLE_MEDIA, SampleMedia } from '../config/sampleMedia';
import { X, Film, Link as LinkIcon, Monitor, Play, User, Sparkles, Youtube, Check, AlertCircle, LogIn, Loader2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultVideoUrl?: string;
  defaultTitle?: string;
  defaultSample?: SampleMedia | null;
}

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({ 
  isOpen, 
  onClose,
  defaultVideoUrl = '',
  defaultTitle = '',
  defaultSample = null
}) => {
  const navigate = useNavigate();
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<'sample' | 'custom' | 'embed' | 'screen'>('sample');
  const [username, setUsername] = useState(user?.displayName || '');
  const [roomTitle, setRoomTitle] = useState(defaultTitle || '');
  const [customUrl, setCustomUrl] = useState(defaultVideoUrl || '');
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [selectedSample, setSelectedSample] = useState<SampleMedia | null>(defaultSample || SAMPLE_MEDIA[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  // Sync props when opened or selected sample changes
  React.useEffect(() => {
    if (isOpen) {
      if (defaultSample) {
        setSelectedSample(defaultSample);
        setRoomTitle(defaultSample.title);
        setCustomUrl(defaultSample.videoUrl);
        setActiveTab('sample');
      } else if (defaultVideoUrl) {
        setCustomUrl(defaultVideoUrl);
        if (defaultTitle) setRoomTitle(defaultTitle);
      }
      if (user?.displayName) {
        setUsername(prev => prev || user.displayName || '');
      }
    }
  }, [isOpen, defaultSample, defaultVideoUrl, defaultTitle, user]);

  if (!isOpen) return null;

  const handleGoogleSignInAndProceed = async () => {
    try {
      setError('');
      await loginWithGoogle();
    } catch (err) {
      console.warn('Google sign-in error:', err);
      setError('Failed to sign in with Google. Please try again.');
    }
  };

  const handleCreateRoom = async (sourceType: 'sample' | 'custom' | 'embed' | 'screen', sampleItem?: SampleMedia) => {
    // 1. Prevent double submission synchronously
    if (creating || isSubmittingRef.current) return;

    // 2. Validate host nickname
    const finalName = username.trim() || user?.displayName || 'Host';
    if (!finalName) {
      setError('Please enter a host nickname');
      return;
    }

    // 3. Prevent creation if auth is still initializing
    if (authLoading) {
      setError('Account is still loading, please wait a moment...');
      return;
    }

    // 4. Verify user is authenticated; if not, try Google sign-in
    let currentUser = auth.currentUser || user;
    if (!currentUser || !currentUser.uid) {
      try {
        const loggedInUser = await loginWithGoogle();
        if (loggedInUser && loggedInUser.uid) {
          currentUser = loggedInUser;
        } else {
          setError('You must sign in to create and host a room.');
          return;
        }
      } catch {
        setError('Sign in was cancelled or failed. Please sign in to host.');
        return;
      }
    }

    // Lock submission immediately
    isSubmittingRef.current = true;
    setCreating(true);
    setError('');

    try {
      let finalTitle = roomTitle.trim();
      let videoUrl = '';
      let isScreenSharing = false;
      let subtitle = subtitleUrl.trim();

      if (sourceType === 'sample') {
        const media = sampleItem || selectedSample || SAMPLE_MEDIA[0];
        videoUrl = media.videoUrl;
        if (!finalTitle) finalTitle = media.title;
        if (media.subtitle) subtitle = media.subtitle;
      } else if (sourceType === 'custom') {
        if (!customUrl.trim()) {
          setError('Please provide a direct video URL (.mp4, .m3u8, etc.)');
          setCreating(false);
          isSubmittingRef.current = false;
          return;
        }
        videoUrl = customUrl.trim();
        if (!finalTitle) finalTitle = `${finalName}'s Watch Party`;
      } else if (sourceType === 'embed') {
        if (!customUrl.trim()) {
          setError('Please enter a YouTube or web embed URL');
          setCreating(false);
          isSubmittingRef.current = false;
          return;
        }
        let url = customUrl.trim();
        if (url.includes('youtube.com/watch?v=')) {
          const videoId = url.split('v=')[1]?.split('&')[0];
          if (videoId) {
            url = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
          }
        } else if (url.includes('youtu.be/')) {
          const videoId = url.split('youtu.be/')[1]?.split('?')[0];
          if (videoId) {
            url = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
          }
        }
        videoUrl = url;
        if (!finalTitle) finalTitle = `${finalName}'s Stream Party`;
      } else if (sourceType === 'screen') {
        isScreenSharing = true;
        videoUrl = '';
        if (!finalTitle) finalTitle = `${finalName}'s Live Screen Party`;
      }

      const hostUid = currentUser.uid;
      const nowIso = new Date().toISOString();
      const nowEpoch = Date.now();

      // Generate room document reference synchronously so ID is known immediately
      const roomRef = doc(collection(db, 'watchRooms'));
      const roomId = roomRef.id;

      const roomData = {
        title: finalTitle || 'Watch Party Room',
        videoUrl: videoUrl || '',
        currentTime: 0,
        playing: true,
        hostId: hostUid,
        hostName: finalName,
        createdAt: nowIso,
        updatedAt: nowEpoch,
        subtitle: subtitle || '',
        usersCount: 1,
        isActive: true,
        isScreenSharing: Boolean(isScreenSharing),
        screenHostId: isScreenSharing ? hostUid : null,
        sourceType
      };

      // Atomic batch write: room doc + host participant subcollection doc in single round-trip
      const batch = writeBatch(db);
      batch.set(roomRef, roomData);

      const hostUserRef = doc(db, `watchRooms/${roomId}/users`, hostUid);
      batch.set(hostUserRef, {
        username: finalName,
        uid: hostUid,
        isHost: true,
        joinedAt: nowIso,
        speaking: false
      });

      await batch.commit();

      // Navigate immediately to the room without blocking on unnecessary operations
      onClose();
      navigate(`/watchparty/${roomId}?username=${encodeURIComponent(finalName)}`);
    } catch (err: unknown) {
      console.error('Error creating watch room:', err);
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === 'permission-denied') {
        setError('Firestore permission denied. Please verify your account session.');
      } else if (errorObj?.code === 'unavailable' || errorObj?.message?.includes('offline')) {
        setError('Network temporarily unavailable. Please check your connection and try again.');
      } else {
        setError(errorObj?.message || 'Failed to create watch party. Please try again.');
      }
      setCreating(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#141414] border border-white/10 rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Create a Watch Party</h2>
              <p className="text-xs text-gray-400">Stream in sync with voice chat and live reactions</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={creating}
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-semibold flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
              {(!user || !auth.currentUser) && !authLoading && (
                <Link
                  to="/login"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
                >
                  <LogIn size={13} /> Sign In
                </Link>
              )}
            </div>
          )}

          {/* Unauthenticated notice */}
          {!user && !auth.currentUser && !authLoading && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LogIn size={16} className="shrink-0 text-emerald-400" />
                <span>Sign in with Google to host your room and invite friends.</span>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignInAndProceed}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20"
              >
                <LogIn size={13} /> Sign In with Google
              </button>
            </div>
          )}

          {/* User & Title Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Host Nickname</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your nickname..."
                  disabled={creating}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Room Name (Optional)</label>
              <input 
                type="text" 
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="e.g. Movie Night with Friends"
                disabled={creating}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Source Tabs */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Choose Content Source</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
              <button 
                type="button"
                onClick={() => setActiveTab('sample')}
                disabled={creating}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'sample' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <Film size={15} /> Sample Films
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('custom')}
                disabled={creating}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'custom' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <LinkIcon size={15} /> Video URL
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('embed')}
                disabled={creating}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'embed' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <Youtube size={15} /> Web / YouTube
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('screen')}
                disabled={creating}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'screen' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <Monitor size={15} /> Screen Share
              </button>
            </div>
          </div>

          {/* Source Panels */}
          {activeTab === 'sample' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Pick any free open-source media to start an instant synchronized session:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                {SAMPLE_MEDIA.map((item) => {
                  const isSelected = selectedSample?.id === item.id;
                  return (
                    <div 
                      key={item.id}
                      onClick={() => {
                        if (!creating) {
                          setSelectedSample(item);
                          setRoomTitle(item.title);
                          setCustomUrl(item.videoUrl);
                        }
                      }}
                      className={`relative flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-emerald-500/10 border-emerald-500/60 shadow-lg' 
                          : 'bg-white/5 border-white/5 hover:border-white/20'
                      } ${creating ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <img 
                        src={item.poster} 
                        alt={item.title} 
                        className="w-14 h-16 object-cover rounded-xl shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                          {isSelected && <Check size={14} className="text-emerald-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-emerald-400 font-medium">{item.category}</p>
                        <p className="text-[10px] text-gray-500 truncate">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">Direct Video File or Stream URL</label>
                <input 
                  type="url" 
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4 or .m3u8 stream"
                  disabled={creating}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                />
                <p className="text-[11px] text-gray-500">Supports direct MP4, WebM, and HLS (.m3u8) live video streams.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">Subtitle URL (Optional .vtt / .srt)</label>
                <input 
                  type="url" 
                  value={subtitleUrl}
                  onChange={(e) => setSubtitleUrl(e.target.value)}
                  placeholder="https://example.com/subtitles.vtt"
                  disabled={creating}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">YouTube or Web Embed URL</label>
                <input 
                  type="url" 
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or embed URL"
                  disabled={creating}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                />
                <p className="text-[11px] text-gray-500">Paste any YouTube video link or compatible video player embed URL.</p>
              </div>
            </div>
          )}

          {activeTab === 'screen' && (
            <div className="p-5 bg-gradient-to-br from-indigo-900/30 to-purple-900/20 rounded-2xl border border-indigo-500/20 text-center space-y-3">
              <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
                <Monitor size={24} />
              </div>
              <h4 className="text-base font-bold text-white">Live Screen Share Room</h4>
              <p className="text-xs text-gray-300 max-w-md mx-auto">
                Create a room ready to capture your screen, browser tabs, or game window with zero latency and high-definition voice chat.
              </p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-6 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-4">
          <button 
            onClick={onClose}
            disabled={creating}
            className="px-5 py-3 text-sm font-bold text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button 
            onClick={() => handleCreateRoom(activeTab)}
            disabled={creating || authLoading}
            className="flex-1 max-w-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Creating room...</span>
              </>
            ) : authLoading ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Checking login...</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>Launch Watch Party</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

