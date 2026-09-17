import React, { useState, useRef } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { X, Link as LinkIcon, Monitor, Play, User, Sparkles, Youtube, Tv, AlertCircle, LogIn, Loader2, Globe, Lock, CheckCircle2, Camera } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useExtensionBridge } from '../hooks/useExtensionBridge';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultVideoUrl?: string;
  defaultTitle?: string;
  defaultTab?: 'embed' | 'custom' | 'screen' | 'netflix' | 'live';
}

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({ 
  isOpen, 
  onClose,
  defaultVideoUrl = '',
  defaultTitle = '',
  defaultTab
}) => {
  const navigate = useNavigate();
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const extensionBridge = useExtensionBridge();
  const [activeTab, setActiveTab] = useState<'embed' | 'custom' | 'screen' | 'netflix' | 'live'>(defaultTab || 'embed');
  const [username, setUsername] = useState(user?.displayName || '');
  const [roomTitle, setRoomTitle] = useState(defaultTitle || '');
  const [customUrl, setCustomUrl] = useState(defaultVideoUrl || '');
  const [netflixUrl, setNetflixUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  // Sync props when opened or selected settings change
  React.useEffect(() => {
    if (isOpen) {
      if (defaultTab) {
        setActiveTab(defaultTab);
      }
      if (defaultVideoUrl) {
        if (defaultVideoUrl.includes('netflix.com')) {
          setNetflixUrl(defaultVideoUrl);
          if (!defaultTab) setActiveTab('netflix');
        } else {
          setCustomUrl(defaultVideoUrl);
        }
        if (defaultTitle) setRoomTitle(defaultTitle);
      }
      if (user?.displayName) {
        setUsername(prev => prev || user.displayName || '');
      }
      // If extension currently has Netflix active, pre-populate
      if (extensionBridge.netflixState.isAvailable && extensionBridge.netflixState.content) {
        const netflixContent = extensionBridge.netflixState.content;
        setNetflixUrl(prev => prev || netflixContent.rawUrl);
        setRoomTitle(prev => prev || (netflixContent.title ? `Netflix: ${netflixContent.title}` : ''));
      }
    }
  }, [isOpen, defaultVideoUrl, defaultTitle, defaultTab, user, extensionBridge.netflixState]);

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

  const handleCreateRoom = async (sourceType: 'embed' | 'custom' | 'screen' | 'netflix') => {
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
      const subtitle = subtitleUrl.trim();
      let netflixPlayback = null;

      if (sourceType === 'custom') {
        let clean = customUrl.trim();
        if (!clean) {
          setError('Please provide a direct video URL (.mp4, .m3u8, etc.)');
          setCreating(false);
          isSubmittingRef.current = false;
          return;
        }
        // Auto-convert Google Drive view links to direct media stream
        const gDriveMatch = clean.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (gDriveMatch && gDriveMatch[1]) {
          clean = `https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}`;
        }
        // Auto-convert Dropbox dl=0 links to raw=1 for direct streaming
        if (clean.includes('dropbox.com') && clean.includes('dl=0')) {
          clean = clean.replace('dl=0', 'raw=1');
        }
        // Auto upgrade http to https if app origin is https to prevent Mixed Content blocking
        if (window.location.protocol === 'https:' && clean.startsWith('http://')) {
          clean = clean.replace('http://', 'https://');
        }
        videoUrl = clean;
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
      } else if (sourceType === 'live') {
        videoUrl = '';
        if (!finalTitle) finalTitle = `${finalName}'s Live Camera Party`;
      } else if (sourceType === 'netflix') {
        const extContent = extensionBridge.netflixState.content;
        const extState = extensionBridge.netflixState.state;
        const cleanUrl = netflixUrl.trim() || (extContent?.rawUrl || 'https://www.netflix.com/watch');
        videoUrl = cleanUrl;
        
        let contentId = extContent?.id || '';
        if (!contentId) {
          const match = cleanUrl.match(/\/watch\/(\d+)/);
          if (match) contentId = match[1];
        }

        const detectedTitle = extContent?.title;
        if (!finalTitle) {
          finalTitle = detectedTitle ? `Netflix: ${detectedTitle}` : `${finalName}'s Netflix Party`;
        }

        netflixPlayback = {
          status: (extState?.isPlaying ? 'playing' : 'paused') as 'playing' | 'paused',
          position: extState?.currentTime || 0,
          updatedAt: Date.now(),
          contentId: contentId || 'netflix_stream',
          contentTitle: detectedTitle || finalTitle,
          rawUrl: cleanUrl,
          season: extContent?.season ?? null,
          episode: extContent?.episode ?? null,
          hostId: currentUser.uid,
          hostName: finalName,
        };
      }

      const hostUid = currentUser.uid;
      const nowIso = new Date().toISOString();
      const nowEpoch = Date.now();

      // Generate room document reference synchronously so ID is known immediately
      const roomRef = doc(collection(db, 'watchRooms'));
      const roomId = roomRef.id;
      const inviteCode = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);

      const roomData = {
        title: finalTitle || 'Watch Party Room',
        videoUrl: videoUrl || '',
        currentTime: 0,
        playing: true,
        hostId: hostUid,
        ownerId: hostUid,
        hostName: finalName,
        createdAt: nowIso,
        updatedAt: nowEpoch,
        subtitle: subtitle || '',
        usersCount: 1,
        isActive: true,
        isPrivate: Boolean(isPrivate),
        inviteCode,
        allowedUsers: [hostUid],
        isScreenSharing: Boolean(isScreenSharing),
        screenHostId: isScreenSharing ? hostUid : null,
        sourceType,
        isLiveParty: sourceType === 'live',
        isLiveStreaming: sourceType === 'live',
        netflixPlayback: netflixPlayback
      };

      // 1. Commit room document to Firestore
      const commitPromise = setDoc(roomRef, roomData);

      // 2. Add host participant record in users subcollection asynchronously in background
      const hostUserRef = doc(db, `watchRooms/${roomId}/users`, hostUid);
      setDoc(hostUserRef, {
        username: finalName,
        uid: hostUid,
        isHost: true,
        joinedAt: nowIso,
        speaking: false
      }).catch((hostDocErr) => {
        console.warn('Initial host participant doc write note:', hostDocErr);
      });

      // 3. Persist to local storage so user NEVER loses their created rooms
      try {
        const savedRoomsKey = 'synora_created_rooms';
        const existing = JSON.parse(localStorage.getItem(savedRoomsKey) || '[]');
        const updated = [{
          id: roomId,
          title: finalTitle,
          createdAt: nowIso,
          hostId: hostUid,
          isHost: true,
          sourceType,
          videoUrl: videoUrl || '',
          isPrivate: Boolean(isPrivate)
        }, ...existing.filter((r: { id: string }) => r.id !== roomId)].slice(0, 30);
        localStorage.setItem(savedRoomsKey, JSON.stringify(updated));

        const idListKey = 'synora_saved_room_ids';
        const existingIds = JSON.parse(localStorage.getItem(idListKey) || '[]');
        if (!existingIds.includes(roomId)) {
          localStorage.setItem(idListKey, JSON.stringify([roomId, ...existingIds].slice(0, 50)));
        }
      } catch (storageErr) {
        console.warn('LocalStorage save note:', storageErr);
      }

      // Fast-race the commit so if the network roundtrip is slow, user transitions instantly
      await Promise.race([
        commitPromise,
        new Promise(resolve => setTimeout(resolve, 300))
      ]);

      // 4. Navigate instantly to the room with preloaded state
      sessionStorage.setItem(`synora_host_${roomId}`, 'true');
      onClose();
      const targetPath = sourceType === 'live' ? `/live/${roomId}` : `/watchparty/${roomId}`;
      navigate(`${targetPath}?username=${encodeURIComponent(finalName)}&invite=${inviteCode}`, {
        state: {
          initialRoom: { id: roomId, ...roomData },
          isHostCreation: true
        }
      });
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
              <button 
                type="button"
                onClick={() => setActiveTab('embed')}
                disabled={creating}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'embed' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <Youtube size={15} /> YouTube
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('custom')}
                disabled={creating}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'custom' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <LinkIcon size={15} /> URL
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('live')}
                disabled={creating}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'live' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <Camera size={15} /> Live Party
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('netflix')}
                disabled={creating}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'netflix' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <Tv size={15} className="text-white" /> Netflix
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('screen')}
                disabled={creating}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'screen' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <Monitor size={15} /> Screen
              </button>
            </div>
          </div>

          {/* Source Panels */}
          {activeTab === 'netflix' && (
            <div className="space-y-4 bg-gradient-to-br from-red-950/30 to-black p-5 rounded-2xl border border-red-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                    N
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Netflix Synchronized Watch Party</h4>
                    <p className="text-[11px] text-gray-400">Host controls playback for all participants via browser extension</p>
                  </div>
                </div>

                {extensionBridge.netflixState.isAvailable ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Netflix Tab Detected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Extension Bridge Ready
                  </span>
                )}
              </div>

              {extensionBridge.netflixState.isAvailable && extensionBridge.netflixState.content && (
                <div className="p-3.5 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Title on Netflix</span>
                    <h5 className="text-sm font-black text-white">{extensionBridge.netflixState.content.title}</h5>
                    <p className="text-[11px] text-gray-400">
                      ID: {extensionBridge.netflixState.content.id} • Status: {extensionBridge.netflixState.state?.isPlaying ? 'Playing' : 'Paused'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (extensionBridge.netflixState.content) {
                        setNetflixUrl(extensionBridge.netflixState.content.rawUrl);
                        setRoomTitle(`Netflix: ${extensionBridge.netflixState.content.title}`);
                      }
                    }}
                    className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white rounded-lg text-xs font-bold transition-all shrink-0"
                  >
                    Use This Title
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">Netflix Watch URL or Video ID</label>
                <input 
                  type="url" 
                  value={netflixUrl}
                  onChange={(e) => setNetflixUrl(e.target.value)}
                  placeholder="https://www.netflix.com/watch/80057281"
                  disabled={creating}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                />
                <p className="text-[11px] text-gray-400">
                  Open Netflix in another tab or paste your Netflix watch URL. When you play, pause, or seek, all participants stay in lockstep.
                </p>
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

          {activeTab === 'live' && (
            <div className="p-5 bg-gradient-to-br from-red-950/30 to-black rounded-2xl border border-red-500/20 text-center space-y-3">
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
                <Camera size={24} />
              </div>
              <h4 className="text-base font-bold text-white">Live Camera Party</h4>
              <p className="text-xs text-gray-300 max-w-md mx-auto">
                Broadcast your camera and microphone live to your friends with peer-to-peer WebRTC streaming. Switch between front and rear cameras, mute audio, and chat in real-time.
              </p>
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

          {/* Room Privacy Selector */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Room Privacy</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                disabled={creating}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  !isPrivate 
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-sm' 
                    : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${!isPrivate ? 'bg-emerald-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                  <Globe size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>Public Party</span>
                    {!isPrivate && <CheckCircle2 size={13} className="text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                    Visible on Active Watch Parties list. Friends can easily discover and join.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                disabled={creating}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  isPrivate 
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-sm' 
                    : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${isPrivate ? 'bg-emerald-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                  <Lock size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>Private Room</span>
                    {isPrivate && <CheckCircle2 size={13} className="text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                    Hidden from public list. Only participants with direct link or invite code can join.
                  </p>
                </div>
              </button>
            </div>
          </div>
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
                {activeTab === 'live' ? (
                  <>
                    <Camera size={16} />
                    <span>Start Live Party</span>
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" />
                    <span>Launch Watch Party</span>
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

