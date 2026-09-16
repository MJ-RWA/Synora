import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { WatchRoom, WatchRoomMessage, WatchRoomUser, WatchRoomReaction } from '../types';
import { useAuth } from '../hooks/useAuth';
import { isUserLive, sendHeartbeat, markUserOffline, HEARTBEAT_INTERVAL_MS } from '../services/presenceService';
import { CameraBroadcast } from '../components/CameraBroadcast';
import {
  Radio,
  Users,
  MessageSquare,
  Share2,
  ArrowLeft,
  Check,
  X,
  Send,
  Sparkles,
  Camera,
  AlertCircle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RefreshCw,
  Eye,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LiveParty: React.FC = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const cleanRoomId = roomId ? decodeURIComponent(roomId).trim() : '';

  // Extract navigation state if navigated from room creation
  const navState = location.state as { initialRoom?: WatchRoom; isHostCreation?: boolean } | null;
  const initialRoomFromState = navState?.initialRoom && navState.initialRoom.id === cleanRoomId ? navState.initialRoom : null;
  const isHostCreation = Boolean(navState?.isHostCreation);

  // Persistent Guest ID in session storage if user is not signed in
  const [guestId] = useState<string>(() => {
    const existing = sessionStorage.getItem('synora_guest_uid');
    if (existing) return existing;
    const generated = `guest_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('synora_guest_uid', generated);
    return generated;
  });

  const effectiveUserId = user?.uid || auth.currentUser?.uid || guestId;
  const initialUsername = searchParams.get('username') || user?.displayName || auth.currentUser?.displayName || userData?.username || '';
  const [username, setUsername] = useState(initialUsername || (isHostCreation ? 'Host' : 'Guest'));
  const [hasJoined, setHasJoined] = useState(() => Boolean(isHostCreation || initialUsername || user || auth.currentUser));
  const [isJoining, setIsJoining] = useState(false);

  // Room state
  const [room, setRoom] = useState<WatchRoom | null>(() => initialRoomFromState);
  const [roomLoading, setRoomLoading] = useState(() => !initialRoomFromState);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);

  // Presence & users
  const [roomUsers, setRoomUsers] = useState<WatchRoomUser[]>([]);
  const [presenceTick, setPresenceTick] = useState(0);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'participants'>('chat');

  // Chat & Reactions
  const [messages, setMessages] = useState<WatchRoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [reactions, setReactions] = useState<WatchRoomReaction[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Video & Stream state
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraAudioMuted, setIsCameraAudioMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileScrolled, setIsMobileScrolled] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Host detection: Strict rule matching WatchParty
  const isHost = useMemo(() => {
    const currentUid = user?.uid || auth.currentUser?.uid;
    if (currentUid && room && (currentUid === room.hostId || currentUid === room.ownerId)) {
      return true;
    }
    if (effectiveUserId && room && (effectiveUserId === room.hostId || effectiveUserId === room.ownerId)) {
      return true;
    }
    if (isHostCreation && (!room || room.hostId === effectiveUserId)) {
      return true;
    }
    return false;
  }, [user?.uid, room, effectiveUserId, isHostCreation]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Presence interval
  useEffect(() => {
    const timer = setInterval(() => setPresenceTick(Date.now()), 3000);
    return () => clearInterval(timer);
  }, []);

  // Handle mobile scroll indicator
  useEffect(() => {
    const handleScroll = () => {
      setIsMobileScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 1. Subscribe to Room document
  useEffect(() => {
    if (!cleanRoomId) return;

    const roomRef = doc(db, 'watchRooms', cleanRoomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      setRoomLoading(false);
      if (!snapshot.exists()) {
        setRoomNotFound(true);
        return;
      }
      const data = { id: snapshot.id, ...snapshot.data() } as WatchRoom;
      setRoom(data);

      if (data.isActive === false || data.isLiveStreaming === false) {
        setStreamEnded(true);
      } else {
        setStreamEnded(false);
      }
    }, (err) => {
      console.warn('Error listening to live room:', err);
      setRoomLoading(false);
    });

    return () => unsubscribe();
  }, [cleanRoomId]);

  // Host initializes live room state
  useEffect(() => {
    if (!cleanRoomId || !isHost || !room) return;

    // Ensure host updates live streaming flags
    if (!room.isLiveStreaming || !room.isCameraActive || room.cameraHostId !== effectiveUserId) {
      updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isLiveStreaming: true,
        isCameraActive: true,
        cameraHostId: effectiveUserId,
        isActive: true,
      }).catch((err) => {
        console.debug('Failed to update live streaming flags:', err);
      });
    }
  }, [cleanRoomId, isHost, room, effectiveUserId]);

  // 2. Subscribe to Room Participants
  useEffect(() => {
    if (!cleanRoomId) return;

    const usersRef = collection(db, `watchRooms/${cleanRoomId}/users`);
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const users: WatchRoomUser[] = [];
      snapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() } as WatchRoomUser);
      });
      setRoomUsers(users);
    });

    return () => unsubscribe();
  }, [cleanRoomId]);

  // Active live participants
  const liveParticipants = useMemo(() => {
    return roomUsers.filter(u => isUserLive(u, presenceTick));
  }, [roomUsers, presenceTick]);

  // 3. User Presence Heartbeat
  useEffect(() => {
    if (!cleanRoomId || !hasJoined) return;

    const announce = async () => {
      try {
        await sendHeartbeat(cleanRoomId, effectiveUserId, {
          username: username.trim() || 'Guest',
          isHost,
          uid: user?.uid || null,
          photoURL: user?.photoURL || null
        });
      } catch (err) {
        console.warn('Heartbeat error:', err);
      }
    };

    announce();
    const interval = setInterval(announce, HEARTBEAT_INTERVAL_MS);

    const handleBeforeUnload = () => {
      markUserOffline(cleanRoomId, effectiveUserId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      markUserOffline(cleanRoomId, effectiveUserId);
    };
  }, [cleanRoomId, hasJoined, effectiveUserId, username, isHost, user?.uid, user?.photoURL]);

  // 4. Subscribe to Chat Messages
  useEffect(() => {
    if (!cleanRoomId) return;

    const messagesRef = collection(db, `watchRooms/${cleanRoomId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(150));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: WatchRoomMessage[] = [];
      snapshot.forEach((docSnap) => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as WatchRoomMessage);
      });
      setMessages(msgs);
      setTimeout(() => {
        if (chatBottomRef.current) {
          chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 60);
    });

    return () => unsubscribe();
  }, [cleanRoomId]);

  // 5. Subscribe to Reactions
  useEffect(() => {
    if (!cleanRoomId) return;

    const reactionsRef = collection(db, `watchRooms/${cleanRoomId}/reactions`);
    const q = query(reactionsRef, orderBy('time', 'desc'), limit(12));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rxns: WatchRoomReaction[] = [];
      snapshot.forEach((docSnap) => {
        rxns.push({ id: docSnap.id, ...docSnap.data() } as WatchRoomReaction);
      });
      setReactions(rxns.reverse());
    });

    return () => unsubscribe();
  }, [cleanRoomId]);

  // Attach camera stream to video player
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream;
      }
      videoRef.current.muted = isHost ? true : isCameraAudioMuted;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, isHost, isCameraAudioMuted]);

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !cleanRoomId) return;

    const senderName = username.trim() || user?.displayName || 'User';
    setNewMessage('');

    try {
      await addDoc(collection(db, `watchRooms/${cleanRoomId}/messages`), {
        text,
        username: senderName,
        userId: effectiveUserId,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to send chat message:', err);
    }
  };

  // Send Reaction
  const handleSendReaction = async (emoji: string) => {
    if (!cleanRoomId) return;
    const senderName = username.trim() || user?.displayName || 'User';
    try {
      await addDoc(collection(db, `watchRooms/${cleanRoomId}/reactions`), {
        emoji,
        username: senderName,
        time: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to send reaction:', err);
    }
  };

  // Copy share invite link
  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/live/${cleanRoomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    showToast('Live Party link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Host ends live stream
  const handleEndStream = async () => {
    if (!window.confirm('Are you sure you want to end this live broadcast for all participants?')) return;
    try {
      if (cleanRoomId) {
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          isActive: false,
          isLiveStreaming: false,
          isCameraActive: false,
          cameraHostId: null,
        });
      }
      showToast('Live broadcast ended.');
      navigate('/');
    } catch (err) {
      console.warn('Failed to end stream:', err);
    }
  };

  // Leave room
  const handleLeaveRoom = () => {
    if (cleanRoomId) {
      markUserOffline(cleanRoomId, effectiveUserId);
    }
    navigate('/');
  };

  // Join handler for unjoined viewer
  const handleJoinParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setIsJoining(true);
    setHasJoined(true);
    setIsJoining(false);
  };

  // ----------------------------------------------------
  // RENDER: Loading or Not Found States
  // ----------------------------------------------------
  if (roomLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-emerald-400" size={32} />
          <p className="text-sm font-bold text-gray-400">Connecting to Live Party...</p>
        </div>
      </div>
    );
  }

  if (roomNotFound || !room) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-[#141414] border border-white/10 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 mx-auto flex items-center justify-center border border-red-500/20">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-2xl font-black">Live Party Not Found</h2>
          <p className="text-sm text-gray-400">
            This live broadcast may have ended or the link is invalid.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-all shadow-lg"
          >
            <ArrowLeft size={16} /> Return to Home
          </Link>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Stream Ended Screen
  // ----------------------------------------------------
  if (streamEnded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-[#141414] border border-white/10 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
            <Radio size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black">Live Broadcast Has Ended</h2>
            <p className="text-sm text-gray-400">
              The broadcaster has ended this live broadcast. Thank you for joining!
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <ArrowLeft size={16} /> Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Guest Join Screen
  // ----------------------------------------------------
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-[#141414] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Live Camera Broadcast
            </div>
            <h2 className="text-2xl font-black">{room.title}</h2>
            <p className="text-xs text-gray-400">
              Hosted by <span className="text-emerald-400 font-bold">{room.hostName}</span>
            </p>
          </div>

          <form onSubmit={handleJoinParty} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Nickname</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your nickname..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={isJoining || !username.trim()}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <Radio size={16} /> Join Live Broadcast
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Main Live Party Studio / Viewer Screen
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-neutral-900/95 border border-white/15 text-white text-xs font-bold rounded-2xl shadow-2xl flex items-center gap-2"
          >
            <Sparkles size={14} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md px-4 py-2.5 sm:py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all shrink-0"
              title="Return home"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-wider shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
                <h1 className="text-sm sm:text-base font-black truncate">{room.title}</h1>
              </div>
              <p className="text-[11px] text-gray-400 truncate">
                Hosted by <span className="text-emerald-400 font-semibold">{room.hostName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Camera Broadcast WebRTC Engine */}
            {cleanRoomId && (
              <CameraBroadcast
                roomId={cleanRoomId}
                userId={effectiveUserId}
                username={username}
                isHost={isHost}
                isCameraActive={Boolean(room?.isCameraActive || room?.isLiveStreaming || isHost)}
                cameraHostId={room?.cameraHostId || room?.hostId}
                onStreamReady={(stream) => {
                  setCameraStream(stream);
                }}
                onToast={showToast}
                facingMode={cameraFacingMode}
                onFacingModeChange={setCameraFacingMode}
                autoStart={isHost}
              />
            )}

            {/* Live Viewers Count */}
            <button
              onClick={() => setShowParticipantsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 transition-all cursor-pointer"
              title="View participants"
            >
              <Eye size={14} className="text-emerald-400" />
              <span>{liveParticipants.length}</span>
              <span className="hidden sm:inline text-gray-400">watching</span>
            </button>

            {/* Share Link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 transition-all cursor-pointer"
              title="Share invite link"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
            </button>

            {/* Leave Room Button */}
            <button
              onClick={isHost ? handleEndStream : handleLeaveRoom}
              className="px-3 py-1.5 bg-red-600/80 hover:bg-red-500 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              title={isHost ? 'End live broadcast' : 'Leave room'}
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">{isHost ? 'End Live' : 'Leave'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Grid matching WatchParty */}
      <main className="max-w-[1800px] mx-auto p-0 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Left Column (3 cols on desktop): Video Player Stage & Studio Controls */}
        <div className="lg:col-span-3 space-y-4">
          {/* Video Player Stage (Sticky on mobile for continuous viewing while scrolling) */}
          <div
            id="video-player-stage"
            data-video-stage="true"
            ref={playerContainerRef}
            className="sticky top-[53px] sm:top-0 z-40 w-full aspect-video bg-black shadow-2xl border-b lg:border border-white/10 select-none lg:relative lg:top-auto lg:z-auto lg:aspect-video lg:rounded-2xl lg:overflow-hidden group"
          >
            {/* Scrolled-to-fixed mobile indicator */}
            {isMobileScrolled && (
              <div className="lg:hidden absolute top-2 left-2 z-30 flex items-center gap-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] text-white pointer-events-auto">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="flex items-center gap-1 font-bold text-gray-300 hover:text-white"
                  title="Scroll to top"
                >
                  <ArrowLeft size={12} />
                  <span className="truncate max-w-[140px]">{room.title}</span>
                </button>
              </div>
            )}

            {/* Video Element */}
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isHost ? true : isCameraAudioMuted}
                className={`w-full h-full object-contain ${isHost && cameraFacingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Live Camera Badge */}
              <div className="absolute top-4 left-4 bg-emerald-600 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg z-20">
                <Camera size={14} className="animate-pulse text-white" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">
                  {isHost ? 'Live Camera (Broadcasting)' : `${room.hostName}'s Camera`}
                </span>
              </div>

              {/* Waiting / Connecting Overlay if video stream not ready yet */}
              {!cameraStream && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-sm text-center space-y-3">
                  <RefreshCw size={36} className="animate-spin text-emerald-400" />
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-white">
                      {isHost ? 'Initializing Camera Broadcast...' : 'Connecting to Live Stream...'}
                    </h4>
                    <p className="text-xs text-gray-400 max-w-xs">
                      {isHost
                        ? 'Broadcasting your real-time camera directly to all viewers.'
                        : `Receiving live broadcast from ${room.hostName}.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Video Overlay Controls: Audio Unmute & Fullscreen */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 z-30 transition-opacity opacity-90 hover:opacity-100">
                {!isHost && (
                  isCameraAudioMuted ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.muted = false;
                          setIsCameraAudioMuted(false);
                          videoRef.current.play().catch(() => {});
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/90 hover:bg-amber-500 text-black shadow-lg backdrop-blur-sm transition-all cursor-pointer"
                      title="Click to unmute live audio"
                    >
                      <VolumeX size={14} />
                      <span>Unmute Audio</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.muted = true;
                          setIsCameraAudioMuted(true);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/60 hover:bg-black/80 text-white border border-white/10 shadow-lg backdrop-blur-sm transition-all cursor-pointer"
                      title="Mute live audio"
                    >
                      <Volume2 size={14} />
                      <span>Audio On</span>
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white border border-white/10 shadow-lg backdrop-blur-sm transition-all cursor-pointer"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                </button>
              </div>

              {/* Animated Floating Reactions on Video */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
                <AnimatePresence>
                  {reactions.map((reaction, i) => (
                    <motion.div
                      key={reaction.id || `${reaction.time}-${i}`}
                      initial={{ y: 0, x: `${20 + (i % 5) * 15}%`, opacity: 0, scale: 0.6 }}
                      animate={{
                        y: ['0px', '-60px', '-150px', '-240px'],
                        opacity: [0, 1, 1, 0.7, 0],
                        scale: [0.6, 1.2, 1.1, 0.9, 0.8]
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 5.5, ease: 'easeInOut' }}
                      className="absolute bottom-6 text-2xl sm:text-3xl filter drop-shadow select-none"
                    >
                      {reaction.emoji}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Under-Video Broadcast Controls & Quick Reactions Bar */}
          <div className="px-4 sm:px-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121212] p-3 sm:p-4 rounded-2xl border border-white/5 shadow-xl">
            {/* Room Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-500/30 shrink-0">
                {room.hostName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white truncate">{room.title}</h3>
                <p className="text-xs text-gray-400 truncate">
                  Broadcaster: <span className="text-emerald-400 font-semibold">{room.hostName}</span>
                </p>
              </div>
            </div>

            {/* Quick Emoji Reaction Buttons */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5">
              {['👍', '😂', '🔥', '❤️', '👀', '🎉'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSendReaction(emoji)}
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-95 text-base sm:text-lg cursor-pointer"
                  title={`Send ${emoji} reaction`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 col on desktop): Live Chat & People Sidebar */}
        <div
          id="liveparty-sidebar"
          className="px-4 sm:px-0 lg:px-0 lg:col-span-1 flex flex-col h-[560px] sm:h-[620px] lg:h-[calc(100vh-120px)] bg-[#101010] border border-white/5 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Tabs: Chat vs People */}
          <div className="p-2.5 sm:p-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setActiveSidebarTab('chat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSidebarTab === 'chat'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare size={13} />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSidebarTab('participants')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSidebarTab === 'participants'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Users size={13} />
                <span>People</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  activeSidebarTab === 'participants' ? 'bg-white/20 text-white' : 'bg-white/10 text-emerald-400'
                }`}>
                  {liveParticipants.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                {liveParticipants.length} Live
              </span>
            </div>
          </div>

          {/* TAB 1: Chat Content */}
          {activeSidebarTab === 'chat' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                    <MessageSquare size={32} className="mb-2 opacity-30 text-emerald-400" />
                    <p className="text-xs font-bold">Welcome to the Live Broadcast!</p>
                    <p className="text-[11px] text-gray-600 mt-1">Say hi to {room.hostName} and the viewers.</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isSameSender = Boolean(
                      prevMsg && (
                        (msg.userId && prevMsg.userId)
                          ? msg.userId === prevMsg.userId
                          : msg.username === prevMsg.username
                      )
                    );
                    const isSenderHost = msg.username === room.hostName;

                    return (
                      <div
                        key={msg.id || `${msg.timestamp}-${index}`}
                        className={`flex flex-col ${isSameSender ? 'mt-1' : index === 0 ? 'mt-0' : 'mt-2.5 sm:mt-3'}`}
                      >
                        {!isSameSender && (
                          <div className="flex items-baseline gap-2 mb-1 px-1">
                            <span className={`text-[11px] font-black ${isSenderHost ? 'text-emerald-400' : 'text-gray-300'}`}>
                              {msg.username}
                            </span>
                            {isSenderHost && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">
                                Host
                              </span>
                            )}
                            <span className="text-[9px] text-gray-500">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div
                          className={`text-xs text-gray-100 bg-white/5 p-2.5 rounded-2xl border border-white/5 leading-relaxed break-words shadow-sm ${
                            isSameSender ? 'rounded-tl-md' : 'rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Form */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-white/[0.02] flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Send a chat message..."
                  maxLength={500}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black transition-all disabled:opacity-40 disabled:hover:bg-emerald-500 cursor-pointer"
                  title="Send message"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          ) : (
            /* TAB 2: People Content */
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 scrollbar-hide">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Viewers ({liveParticipants.length})
                </span>
              </div>

              {liveParticipants.map((p) => {
                const isMe = (user?.uid && p.uid === user.uid) || p.id === effectiveUserId;
                const isRoomHost = p.uid === room.hostId || p.isHost;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">
                        {p.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white">{p.username}</p>
                          {isMe && <span className="text-[9px] text-gray-500 font-bold">(You)</span>}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {isRoomHost ? 'Host' : 'Viewer'}
                        </p>
                      </div>
                    </div>
                    {isRoomHost ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase tracking-wider">
                        Host
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        LIVE
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Participants Modal */}
      <AnimatePresence>
        {showParticipantsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full bg-[#141414] border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-emerald-400" />
                  <h3 className="text-base font-black">Live Viewers ({liveParticipants.length})</h3>
                </div>
                <button
                  onClick={() => setShowParticipantsModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {liveParticipants.map((p) => {
                  const isRoomHost = p.uid === room.hostId || p.isHost;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{p.username}</p>
                          <p className="text-[10px] text-gray-400">
                            {isRoomHost ? 'Broadcaster' : 'Viewer'}
                          </p>
                        </div>
                      </div>
                      {isRoomHost && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase tracking-wider">
                          Host
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowParticipantsModal(false)}
                className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
