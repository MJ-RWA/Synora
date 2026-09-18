import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, getDoc, getDocs, collection, addDoc, query, orderBy, limit, increment, setDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { WatchRoom, WatchRoomMessage, WatchRoomUser, WatchRoomReaction, NetflixRoomPlayback } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useExtensionBridge } from '../hooks/useExtensionBridge';
import { handleFirestoreError, OperationType } from '../services/firestoreError';
import Hls from 'hls.js';
import { Users, Send, Share2, ArrowLeft, Check, User, MessageSquare, Film, Monitor, UserPlus, X, Bell, RefreshCw, Play, Pause, Volume2, VolumeX, Maximize, Minimize, AlertTriangle, LogOut, Trash2, Radio, MonitorOff, Eye, Camera, Link as LinkIcon, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceChat } from '../components/VoiceChat';
import { ScreenShare } from '../components/ScreenShare';
import { CameraBroadcast } from '../components/CameraBroadcast';
import { YouTubeSyncPlayer } from '../components/YouTubeSyncPlayer';
import { NetflixSyncCompanion } from '../components/NetflixSyncCompanion';
import { SocialParticipantModal } from '../components/SocialParticipantModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { recordWatchTime } from '../services/socialService';
import { isUserLive, sendHeartbeat, markUserOffline, formatLastSeen, HEARTBEAT_INTERVAL_MS } from '../services/presenceService';
import { purgeRoomFromLocalState, deleteRoomPermanently } from '../services/roomCleanup';
import { getChatMessageTheme } from '../utils/chatThemes';

// Helper to extract YouTube video ID if URL is YouTube
const getYouTubeVideoId = (url?: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
};

const finalUrlIncludes = (url: string) => url.includes('%20');

const encodeUrl = (url?: string) => {
  if (!url) return undefined;
  if (url.includes(' ') && !finalUrlIncludes(url)) {
    return encodeURI(url);
  }
  return url;
};

export const WatchParty = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userData, loading: authLoading } = useAuth();
  const cleanRoomId = roomId ? decodeURIComponent(roomId).trim() : '';

  const navState = location.state as { initialRoom?: WatchRoom; isHostCreation?: boolean } | null;
  const initialRoomFromState = navState?.initialRoom && navState.initialRoom.id === cleanRoomId ? navState.initialRoom : null;
  const isHostCreation = Boolean(navState?.isHostCreation);

  // Persistent Guest ID in session storage if user is not signed in
  const [guestId] = useState<string>(() => {
    const existing = sessionStorage.getItem('synora_guest_uid') || sessionStorage.getItem('streamarena_guest_uid');
    if (existing) return existing;
    const generated = `guest_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('synora_guest_uid', generated);
    return generated;
  });

  const effectiveUserId = user?.uid || guestId;

  const [room, setRoom] = useState<WatchRoom | null>(() => initialRoomFromState);
  const [roomLoading, setRoomLoading] = useState(() => !initialRoomFromState);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const isHost = Boolean(user?.uid && room && (user.uid === room.hostId || user.uid === room.ownerId));
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState(searchParams.get('username') || user?.displayName || userData?.username || '');
  const [hasJoined, setHasJoined] = useState(() => Boolean(isHostCreation || searchParams.get('username')));
  const [isJoining, setIsJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState<WatchRoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [reactions, setReactions] = useState<WatchRoomReaction[]>([]);
  const [allRoomUsers, setAllRoomUsers] = useState<WatchRoomUser[]>([]);
  const [hasInitialUsersLoaded, setHasInitialUsersLoaded] = useState(false);
  const [presenceTick, setPresenceTick] = useState<number>(() => Date.now());
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'participants'>('chat');

  // Derive LIVE watching participants vs offline / disconnected participants
  const liveUsers = useMemo(() => {
    return allRoomUsers.filter(u => isUserLive(u, presenceTick));
  }, [allRoomUsers, presenceTick]);

  const offlineUsers = useMemo(() => {
    return allRoomUsers.filter(u => !isUserLive(u, presenceTick));
  }, [allRoomUsers, presenceTick]);

  // Periodic local tick to evaluate participant presence in real-time
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setPresenceTick(Date.now());
    }, 10000);
    return () => clearInterval(tickInterval);
  }, []);

  // Identify host participant from real-time participants subcollection
  const hostParticipant = useMemo(() => {
    if (!room) return null;
    const hostId = room.hostId || room.ownerId;
    return allRoomUsers.find(u => (hostId && (u.uid === hostId || u.id === hostId)) || u.isHost) || null;
  }, [allRoomUsers, room]);

  // Determine if host is live using the real-time presence system as source of truth
  // The host themselves are always considered online in their own active session
  const isHostOnline = useMemo(() => {
    if (isHost) return true;
    if (!room) return false;
    // Before initial users snapshot has finished loading, avoid flashing offline immediately
    if (!hasInitialUsersLoaded) return true;
    if (!hostParticipant) return false;
    return isUserLive(hostParticipant, presenceTick);
  }, [isHost, room, hasInitialUsersLoaded, hostParticipant, presenceTick]);

  // RULE: The host is the playback authority. If the host is offline, playback must be paused/stopped for everyone.
  useEffect(() => {
    if (isHost || !hasInitialUsersLoaded) return;
    if (!isHostOnline) {
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
        setIsVideoPlaying(false);
      }
    }
  }, [isHost, hasInitialUsersLoaded, isHostOnline]);
  const [typingUsers, setTypingUsers] = useState<{ [uid: string]: string }>({});
  const [speakingUsers, setSpeakingUsers] = useState<{ [uid: string]: boolean }>({});
  const [selectedUser, setSelectedUser] = useState<WatchRoomUser | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenAudioMuted, setIsScreenAudioMuted] = useState(false);
  const [showHostScreenPreview, setShowHostScreenPreview] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraAudioMuted, setIsCameraAudioMuted] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isChangeMovieModalOpen, setIsChangeMovieModalOpen] = useState(false);
  const [isEditStreamModalOpen, setIsEditStreamModalOpen] = useState(false);
  const [editStreamInput, setEditStreamInput] = useState('');
  const [isLeaveConfirmationOpen, setIsLeaveConfirmationOpen] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const isRoomEnded = Boolean(room && room.isActive === false);
  const [friends, setFriends] = useState<User[]>([]);
  const [availableMovies, setAvailableMovies] = useState<Movie[]>([]);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  // Video Player Controls & Playback State
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoVolume, setVideoVolume] = useState(1);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const [showPlayerControls, setShowPlayerControls] = useState(true);
  const [isMobileScrolled, setIsMobileScrolled] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth < 1024) {
        setIsMobileScrolled(window.scrollY > 40);
      } else {
        setIsMobileScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isRemoteSyncRef = useRef(false);
  const isInitialMessagesLoad = useRef(true);
  const ytSyncFnRef = useRef<(() => void) | null>(null);
  const lastPublishedPlayback = useRef<{ playing: boolean; time: number; timestamp: number }>({ playing: false, time: 0, timestamp: 0 });
  const lastTypingSentRef = useRef<number>(0);
  const lastReactionSentRef = useRef<number>(0);
  const syncedStaleUsersRef = useRef<Set<string>>(new Set());

  // Chrome Extension Bridge & Netflix Synchronization Engine (Phase 4 & 5)
  const extensionBridge = useExtensionBridge();
  const extensionBridgeRef = useRef(extensionBridge);
  useEffect(() => {
    extensionBridgeRef.current = extensionBridge;
  }, [extensionBridge]);
  const [autoSyncNetflix, setAutoSyncNetflix] = useState(true);
  const handleToggleAutoSync = useCallback(() => {
    setAutoSyncNetflix(prev => !prev);
  }, []);
  const handleYtSyncReady = useCallback((syncFn: () => void) => {
    ytSyncFnRef.current = syncFn;
  }, []);
  const [netflixSyncDrift, setNetflixSyncDrift] = useState<number | null>(null);
  const [isNetflixSynced, setIsNetflixSynced] = useState(true);
  const isApplyingRemoteNetflixPlaybackRef = useRef(false);
  const lastHostPublishedNetflix = useRef<{ status: string; position: number; contentId: string; updatedAt: number }>({
    status: '',
    position: -1,
    contentId: '',
    updatedAt: 0,
  });

  const isNetflixParty = Boolean(
    room?.sourceType === 'netflix' ||
    room?.videoUrl?.includes('netflix.com') ||
    room?.netflixPlayback
  );

  const remoteContentId = room?.netflixPlayback?.contentId || (room?.videoUrl ? (room.videoUrl.match(/watch\/(\d+)/)?.[1] || '') : '');
  const localContentId = extensionBridge.netflixState.content?.id || '';
  const isContentMismatch = Boolean(
    isNetflixParty &&
    !isHost &&
    remoteContentId &&
    localContentId &&
    remoteContentId !== localContentId
  );

  const prevVideoUrlRef = useRef<string | null>(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const userDataRef = useRef(userData);
  useEffect(() => { userDataRef.current = userData; }, [userData]);
  const hasJoinedRef = useRef(hasJoined);
  useEffect(() => { hasJoinedRef.current = hasJoined; }, [hasJoined]);
  const usernameRef = useRef(username);
  useEffect(() => { usernameRef.current = username; }, [username]);
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);
  const isHostRef = useRef(isHost);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  const handleJoinRef = useRef<(name?: string) => Promise<void>>(() => Promise.resolve());

  // Host moderation check: determine if current participant is muted by host
  const currentParticipant = liveUsers.find(u => (user?.uid && u.uid === user.uid) || u.id === effectiveUserId || u.username === username);
  const isHostMuted = Boolean(currentParticipant?.mutedByHost);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Active watch time tracking and achievement progression
  useEffect(() => {
    if (!user?.uid || !room || !room.playing || !hasJoined) return;

    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const newBadges = await recordWatchTime(user.uid, 30, isHost);
      if (newBadges.length > 0) {
        newBadges.forEach(badgeId => {
          showToast(`🏆 Achievement Unlocked: ${badgeId.replace(/_/g, ' ').toUpperCase()}!`);
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.uid, room, hasJoined, isHost, showToast]);

  // Safely attach screen stream to video ref without triggering render cascades
  useEffect(() => {
    const video = screenVideoRef.current;
    if (!video || !screenStream) return;
    if (video.srcObject !== screenStream) {
      video.srcObject = screenStream;
    }
    video.muted = isHost ? true : isScreenAudioMuted;
    video.play().catch(() => {});
  }, [screenStream, isHost, isScreenAudioMuted, showHostScreenPreview]);

  useEffect(() => {
    if (!screenStream) {
      setShowHostScreenPreview(false);
    }
  }, [screenStream]);

  const playJoinSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  };

  const isInitialUsersLoad = useRef(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (hasJoined) {
      window.scrollTo(0, 0);
    }
  }, [hasJoined]);

  const joinAttemptedRef = useRef(false);

  // Join Room Handler
  const handleJoin = useCallback(async (customName?: string) => {
    const finalName = (customName || username || usernameRef.current || userRef.current?.displayName || userDataRef.current?.username || 'Guest').trim();
    if (!cleanRoomId) return;
    setIsJoining(true);
    try {
      const currentUser = userRef.current;
      const currentUid = currentUser?.uid || effectiveUserId;
      const isHostUser = Boolean(currentUser?.uid && roomRef.current && (currentUser.uid === roomRef.current.hostId || currentUser.uid === roomRef.current.ownerId));

      // If room was marked inactive and this user is host/owner, reactivate it automatically
      if (isHostUser && roomRef.current && roomRef.current.isActive === false) {
        updateDoc(doc(db, 'watchRooms', cleanRoomId), { isActive: true }).catch(() => {});
        setRoom(prev => prev ? { ...prev, isActive: true } : null);
      }

      const userDocRef = doc(db, `watchRooms/${cleanRoomId}/users`, currentUid);

      await setDoc(userDocRef, {
        username: finalName,
        uid: currentUid,
        isHost: isHostUser,
        joinedAt: new Date().toISOString(),
        speaking: false,
        lastSeen: Date.now(),
        connectionStatus: 'online',
        status: 'watching'
      }, { merge: true }).catch((err) => {
        console.warn("User doc non-fatal sync error:", err);
      });

      if (!isHostUser) {
        try {
          await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
            usersCount: increment(1)
          });
        } catch (countErr) {
          console.warn("Users count update non-fatal error:", countErr);
        }
      }

      setUsername(finalName);
      hasJoinedRef.current = true;
      joinAttemptedRef.current = true;
      setHasJoined(true);

      if (!currentUser) {
        sessionStorage.setItem('synora_guest_name', finalName);
        if (!searchParams.get('username')) {
          setSearchParams({ username: finalName });
        }
      }
    } catch (error) {
      console.error("Join room error:", error);
      // Ensure user can still enter locally without being blocked by network/firestore issues
      setUsername(finalName);
      hasJoinedRef.current = true;
      joinAttemptedRef.current = true;
      setHasJoined(true);
    } finally {
      setIsJoining(false);
    }
  }, [cleanRoomId, effectiveUserId, username, searchParams, setSearchParams]);

  useEffect(() => {
    handleJoinRef.current = handleJoin;
  }, [handleJoin]);

  // Check and redeem invite code for authenticated user
  const inviteCodeParam = searchParams.get('invite')?.trim();
  const queryUsername = searchParams.get('username')?.trim();
  const inviteRedeemedRef = useRef(false);
  const [inviteRedeemTrigger, setInviteRedeemTrigger] = useState(0);

  useEffect(() => {
    if (!cleanRoomId || authLoading || !user || !inviteCodeParam || inviteRedeemedRef.current) return;

    // If user is host or already in allowedUsers, no need to redeem
    if (room && (room.hostId === user.uid || room.ownerId === user.uid || (Array.isArray(room.allowedUsers) && room.allowedUsers.includes(user.uid)))) {
      return;
    }

    const redeemInvite = async () => {
      inviteRedeemedRef.current = true;
      try {
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          allowedUsers: arrayUnion(user.uid),
          _inviteAttempt: inviteCodeParam
        });
        setPermissionDenied(false);
        setInviteRedeemTrigger(prev => prev + 1);
      } catch (err) {
        console.warn('Auto-redeem invite code failed:', err);
      }
    };

    redeemInvite();
  }, [cleanRoomId, user, authLoading, inviteCodeParam, room]);

  // Subscribe to Room Document and Subcollections
  useEffect(() => {
    if (!cleanRoomId) {
      setRoomLoading(false);
      setRoomNotFound(true);
      return;
    }

    // Wait until auth state is fully resolved so temporary auth-loading state is not treated as permission denied
    if (authLoading) {
      if (!roomRef.current && !initialRoomFromState) {
        setRoomLoading(true);
      }
      return;
    }

    if (!roomRef.current && !initialRoomFromState) {
      setRoomLoading(true);
    }
    setRoomNotFound(false);
    setPermissionDenied(false);

    let isSubscribed = true;

    const unsubscribeRoom = onSnapshot(doc(db, 'watchRooms', cleanRoomId), (snapshot) => {
      if (!isSubscribed) return;
      if (snapshot.exists()) {
        const roomData = { id: snapshot.id, ...snapshot.data() } as WatchRoom;
        if (roomData.isDeleted) {
          purgeRoomFromLocalState(cleanRoomId);
          setRoom(null);
          setRoomNotFound(true);
          setRoomLoading(false);
          return;
        }

        // If this is a Live Party room, redirect to dedicated Live Studio
        if (roomData.sourceType === 'live' || roomData.isLiveParty) {
          navigate(`/live/${cleanRoomId}${window.location.search}`, { replace: true });
          return;
        }

        setRoom(roomData);
        setRoomNotFound(false);
        setPermissionDenied(false);

        // Ensure room is cached in local storage so user never loses access across reloads
        try {
          const idListKey = 'synora_saved_room_ids';
          const existing: string[] = JSON.parse(localStorage.getItem(idListKey) || '[]');
          if (!existing.includes(snapshot.id)) {
            localStorage.setItem(idListKey, JSON.stringify([snapshot.id, ...existing].slice(0, 50)));
          }
        } catch {
          // Ignore local storage quota errors
        }
        
        // Auto-join if user has an established identity, host, or pre-filled username to skip username prompt
        const currentUser = userRef.current;
        const isUserHost = Boolean(currentUser?.uid && (roomData.hostId === currentUser.uid || roomData.ownerId === currentUser.uid));
        
        // If the host is returning to their room and it was marked inactive, reactivate it
        if (isUserHost && roomData.isActive === false) {
          updateDoc(doc(db, 'watchRooms', cleanRoomId), { isActive: true }).catch(() => {});
        }

        const candidateName = (
          currentUser?.displayName || 
          userDataRef.current?.username || 
          (currentUser?.email ? currentUser.email.split('@')[0] : '') || 
          (isUserHost ? 'Host' : '')
        )?.trim();

        if (candidateName && !hasJoinedRef.current && !joinAttemptedRef.current) {
          joinAttemptedRef.current = true;
          setUsername(candidateName);
          handleJoinRef.current(candidateName);
        }
      } else {
        purgeRoomFromLocalState(cleanRoomId);
        setRoom(null);
        setRoomNotFound(true);
      }
      setRoomLoading(false);
    }, async (error) => {
      if (!isSubscribed) return;
      console.error(`Error loading watch room ${cleanRoomId}:`, error);
      if (error.code === 'permission-denied') {
        // If user has an invite code and is authenticated, attempt immediate redemption if not already attempted
        const currentUser = userRef.current;
        if (currentUser?.uid && inviteCodeParam && !inviteRedeemedRef.current) {
          try {
            await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
              allowedUsers: arrayUnion(currentUser.uid),
              _inviteAttempt: inviteCodeParam
            });
            inviteRedeemedRef.current = true;
            setPermissionDenied(false);
            setInviteRedeemTrigger(prev => prev + 1);
            return;
          } catch (redeemErr) {
            console.warn("Permission-denied invite redemption failed:", redeemErr);
          }
        }
        setPermissionDenied(true);
      } else {
        setRoomNotFound(true);
      }
      setRoomLoading(false);
    });

    // Chat listener
    const messagesQuery = query(collection(db, `watchRooms/${cleanRoomId}/messages`), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchRoomMessage)));
    }, (error) => {
      console.warn("Messages listener error:", error);
    });

    // Users listener
    const usersQuery = query(collection(db, `watchRooms/${cleanRoomId}/users`), orderBy('joinedAt', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        const userData = change.doc.data() as WatchRoomUser;
        if (change.doc.metadata.hasPendingWrites) return;

        if (change.type === "added" && !isInitialUsersLoad.current) {
          showToast(userData.username + " entered the room");
          playJoinSound();
        }
        if (change.type === "removed") {
          showToast(userData.username + " left the room");
        }
      });
      
      if (isInitialUsersLoad.current) {
        isInitialUsersLoad.current = false;
      }

      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchRoomUser));
      setAllRoomUsers(users);
      setHasInitialUsersLoaded(true);

      // Persistence check for guests and logged in users
      const currentUser = userRef.current;
      if (currentUser && !hasJoinedRef.current) {
        const me = users.find(u => u.uid === currentUser.uid);
        if (me) {
          setHasJoined(true);
          setUsername(prev => prev || me.username);
        }
      } else if (!currentUser && !hasJoinedRef.current) {
        const me = users.find(u => u.uid === effectiveUserId || (queryUsername && u.username === queryUsername));
        if (me) {
          setHasJoined(true);
          setUsername(prev => prev || me.username);
        }
      }
    }, (error) => {
      console.warn("Users listener error:", error);
    });

    // Reactions listener
    const reactionsQuery = query(collection(db, `watchRooms/${cleanRoomId}/reactions`), orderBy('time', 'desc'), limit(10));
    const unsubscribeReactions = onSnapshot(reactionsQuery, (snapshot) => {
      const now = Date.now();
      const recent = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as WatchRoomReaction))
        .filter(r => !r.time || (now - new Date(r.time).getTime() < 8500));
      setReactions(recent);
    }, (error) => {
      console.warn("Reactions listener error:", error);
    });

    // Typing listener
    const typingQuery = query(collection(db, `watchRooms/${cleanRoomId}/typing`));
    const unsubscribeTyping = onSnapshot(typingQuery, (snapshot) => {
      const typing: { [uid: string]: string } = {};
      const currentUid = userRef.current?.uid || effectiveUserId;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.uid !== currentUid && (Date.now() - new Date(data.lastTyped).getTime() < 5000)) {
          typing[data.uid] = data.username;
        }
      });
      setTypingUsers(typing);
    }, (error) => {
      console.warn("Typing listener error:", error);
    });

    return () => {
      isSubscribed = false;
      unsubscribeRoom();
      unsubscribeMessages();
      unsubscribeUsers();
      unsubscribeReactions();
      unsubscribeTyping();
    };
  }, [cleanRoomId, user?.uid, authLoading, effectiveUserId, inviteRedeemTrigger, inviteCodeParam, queryUsername, initialRoomFromState, navigate, showToast]);

  // Real-time presence heartbeat & lifecycle tracking
  useEffect(() => {
    if (!cleanRoomId || !hasJoined) return;
    const currentUid = userRef.current?.uid || effectiveUserId;
    if (!currentUid) return;

    // Send immediate heartbeat on join/reconnect
    sendHeartbeat(cleanRoomId, currentUid);

    const heartbeatTimer = setInterval(() => {
      sendHeartbeat(cleanRoomId, currentUid);
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat(cleanRoomId, currentUid);
      }
    };

    const handleOnline = () => {
      sendHeartbeat(cleanRoomId, currentUid);
    };

    const handleOffline = () => {
      markUserOffline(cleanRoomId, currentUid);
    };

    const handleUnload = () => {
      markUserOffline(cleanRoomId, currentUid);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [cleanRoomId, hasJoined, effectiveUserId]);

  // Ensure offline presence is recorded on unmount of WatchParty
  useEffect(() => {
    const currentUid = user?.uid || effectiveUserId;
    return () => {
      if (cleanRoomId && currentUid) {
        markUserOffline(cleanRoomId, currentUid);
      }
    };
  }, [cleanRoomId, user?.uid, effectiveUserId]);

  // Host periodic check to sync any stale timed-out participants to 'offline' in Firestore
  useEffect(() => {
    if (!isHost || !cleanRoomId) return;
    const staleUsers = allRoomUsers.filter(u => u.connectionStatus !== 'offline' && !isUserLive(u, presenceTick));
    if (staleUsers.length > 0) {
      staleUsers.forEach(staleUser => {
        const uid = staleUser.id || staleUser.uid;
        if (uid && !syncedStaleUsersRef.current.has(uid)) {
          syncedStaleUsersRef.current.add(uid);
          markUserOffline(cleanRoomId, uid);
        }
      });
    }
    // Clean up users who returned to active live status
    allRoomUsers.forEach(u => {
      const uid = u.id || u.uid;
      if (uid && isUserLive(u, presenceTick) && syncedStaleUsersRef.current.has(uid)) {
        syncedStaleUsersRef.current.delete(uid);
      }
    });
  }, [isHost, cleanRoomId, allRoomUsers, presenceTick]);

  // Pre-fill default nickname from user profile or URL parameter without skipping the username prompt
  useEffect(() => {
    if (!hasJoined && !username) {
      const queryName = searchParams.get('username')?.trim();
      const profileName = user?.displayName?.trim() || userData?.username?.trim() || (user?.email ? user.email.split('@')[0] : '');
      const defaultName = queryName || profileName;
      if (defaultName) {
        setUsername(defaultName);
      }
    }
  }, [user, userData, hasJoined, username, searchParams]);

  // Handle video URL change
  useEffect(() => {
    if (room?.videoUrl && prevVideoUrlRef.current && room.videoUrl !== prevVideoUrlRef.current) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.pause();
      }
    }
    prevVideoUrlRef.current = room?.videoUrl || null;
  }, [room?.videoUrl]);

  // Authoritative Playback Updater for Host
  const updateRoomPlayback = useCallback(async (playing: boolean, time: number, videoEnded?: boolean) => {
    const currentRoom = roomRef.current;
    const currentUser = userRef.current;
    if (!cleanRoomId || !currentUser || !currentRoom) return;
    if (currentRoom.hostId !== currentUser.uid || isRemoteSyncRef.current) return;

    // Deduplicate identical updates sent within 800ms unless videoEnded status is changing
    const now = Date.now();
    const last = lastPublishedPlayback.current;
    if (videoEnded === undefined && last.playing === playing && Math.abs(last.time - time) < 0.5 && now - last.timestamp < 800) {
      return;
    }
    lastPublishedPlayback.current = { playing, time, timestamp: now };

    try {
      const payload: Record<string, unknown> = {
        playing,
        currentTime: time,
        updatedAt: now
      };
      if (typeof videoEnded === 'boolean') {
        payload.videoEnded = videoEnded;
      } else if (playing) {
        payload.videoEnded = false;
      }
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), payload);
    } catch (error) {
      console.warn("Failed to update room playback:", error);
    }
  }, [cleanRoomId]);

  const handleHostVideoEnded = useCallback(() => {
    if (!isHost || isRemoteSyncRef.current) return;
    setIsVideoPlaying(false);
    const video = videoRef.current;
    const dur = video?.duration || video?.currentTime || 0;
    updateRoomPlayback(false, dur, true);
    showToast("The video has ended.");
  }, [isHost, updateRoomPlayback, showToast]);

  const handleHostReplayVideo = useCallback(() => {
    if (!isHost) return;
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      setVideoCurrentTime(0);
      video.play().then(() => {
        setIsVideoPlaying(true);
        updateRoomPlayback(true, 0, false);
      }).catch(() => {
        updateRoomPlayback(true, 0, false);
      });
    } else {
      updateRoomPlayback(true, 0, false);
    }
  }, [isHost, updateRoomPlayback]);

  const youtubeVideoId = getYouTubeVideoId(room?.videoUrl);
  const roomPlaying = room?.playing;
  const roomCurrentTime = room?.currentTime;
  const roomUpdatedAt = room?.updatedAt;
  const isScreenSharing = Boolean(room?.isScreenSharing);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePlayerMouseMove = () => {
    setShowPlayerControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (isVideoPlaying) {
        setShowPlayerControls(false);
      }
    }, 3000);
  };

  const toggleVideoPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // RULE: The host is the playback authority. If the host is offline, playback is paused and participants cannot play.
    if (!isHost && !isHostOnline) {
      showToast("Playback is paused until the host returns.");
      return;
    }

    // RULE: When video has ended from host's side, participants cannot restart!
    if (!isHost && (room?.videoEnded || (video.duration > 0 && video.currentTime >= video.duration - 0.5))) {
      showToast("The video has ended. Waiting for the host to restart or select a new video.");
      return;
    }

    // RULE: Participants in synchronized watch party cannot unilaterally start playing
    if (!isHost && !room?.playing && video.paused) {
      showToast("Playback is synchronized with the host.");
      return;
    }

    if (!video.src && !video.currentSrc) {
      console.warn("Playback postponed: video source is still loading");
      return;
    }

    if (video.paused) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoPlaying(true);
            setIsAutoplayBlocked(false);
            if (isHost) {
              updateRoomPlayback(true, video.currentTime, false);
            }
          })
          .catch((err) => {
            if (err.name === 'NotSupportedError' || err.message?.includes('no supported sources')) {
              console.warn("Video source not yet ready for playback:", err);
              return;
            }
            console.warn("Unmuted play blocked by browser, muting:", err);
            video.muted = true;
            setIsVideoMuted(true);
            setIsAutoplayBlocked(true);
            video.play()
              .then(() => {
                setIsVideoPlaying(true);
                if (isHost) {
                  updateRoomPlayback(true, video.currentTime, false);
                }
              })
              .catch((e2) => {
                if (e2.name !== 'NotSupportedError' && !e2.message?.includes('no supported sources')) {
                  console.warn("Muted playback deferred:", e2);
                }
              });
          });
      }
    } else {
      video.pause();
      setIsVideoPlaying(false);
      if (isHost) {
        updateRoomPlayback(false, video.currentTime, false);
      }
    }
  }, [isHost, isHostOnline, room?.videoEnded, room?.playing, updateRoomPlayback, showToast]);

  const handleUnmuteVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    setIsVideoMuted(false);
    setIsAutoplayBlocked(false);
    if (video.paused) {
      video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
    }
  }, []);

  const toggleVideoMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      handleUnmuteVideo();
    } else {
      video.muted = true;
      setIsVideoMuted(true);
    }
  }, [handleUnmuteVideo]);

  const handleSeekVideo = useCallback((newTime: number) => {
    const video = videoRef.current;
    if (!video) return;

    // RULE: If host is offline, participants cannot seek/resume
    if (!isHost && !isHostOnline) {
      showToast("Playback is paused until the host returns.");
      return;
    }

    // RULE: When video has ended, participants cannot seek or restart
    if (!isHost && room?.videoEnded) {
      showToast("The video has ended. Only the host can seek or restart.");
      return;
    }

    video.currentTime = newTime;
    setVideoCurrentTime(newTime);
    if (isHost) {
      updateRoomPlayback(!video.paused, newTime, false);
    }
  }, [isHost, isHostOnline, room?.videoEnded, updateRoomPlayback, showToast]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVolume;
    video.muted = newVolume === 0;
    setVideoVolume(newVolume);
    setIsVideoMuted(newVolume === 0);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const container = playerContainerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsPlayerFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsPlayerFullscreen(false)).catch(() => {});
    }
  }, []);

  const handleSwitchToWorkingSample = async () => {
    if (!cleanRoomId) return;
    const workingUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    try {
      if (isHost) {
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          videoUrl: workingUrl,
          // CRITICAL: Preserve room title! Never overwrite with Big Buck Bunny!
          currentTime: 0,
          playing: true,
          updatedAt: Date.now()
        });
      } else {
        if (videoRef.current) {
          videoRef.current.src = workingUrl;
          videoRef.current.play().then(() => setIsVideoPlaying(true)).catch(() => {});
        }
      }
      setVideoLoadError(null);
      showToast('Switched to test stream (room title preserved).');
    } catch (err) {
      console.error('Error switching stream:', err);
    }
  };

  const handleRetryStream = () => {
    setVideoLoadError(null);
    const video = videoRef.current;
    if (video && room?.videoUrl) {
      const isHls = room.videoUrl.toLowerCase().includes('.m3u8');
      if (!isHls) {
        video.src = encodeUrl(room.videoUrl);
        video.load();
        video.play().catch(() => {});
      }
    }
  };

  const handleUpdateStreamUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanRoomId || !isHost || !editStreamInput.trim()) return;
    try {
      let clean = editStreamInput.trim();
      const gDriveMatch = clean.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (gDriveMatch && gDriveMatch[1]) {
        clean = `https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}`;
      }
      if (clean.includes('dropbox.com') && clean.includes('dl=0')) {
        clean = clean.replace('dl=0', 'raw=1');
      }
      if (window.location.protocol === 'https:' && clean.startsWith('http://')) {
        clean = clean.replace('http://', 'https://');
      }
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        videoUrl: clean,
        currentTime: 0,
        playing: true,
        updatedAt: Date.now()
      });
      setVideoLoadError(null);
      setIsEditStreamModalOpen(false);
      showToast('Stream URL updated successfully!');
    } catch (err) {
      console.error('Failed to update stream URL:', err);
      showToast('Failed to update stream URL');
    }
  };

  // Participant HTML5 Video Sync Effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isHost || isScreenSharing || youtubeVideoId || isNetflixParty) return;

    // RULE: When video has ended according to the host, freeze and pause immediately
    if (room?.videoEnded) {
      if (!video.paused) {
        video.pause();
        setIsVideoPlaying(false);
      }
      return;
    }

    // RULE: The host is the playback authority. If the host is offline, playback must remain paused.
    if (!isHostOnline) {
      if (!video.paused) {
        video.pause();
        setIsVideoPlaying(false);
      }
      return;
    }

    // Avoid syncing while another sync action is in-flight
    if (isRemoteSyncRef.current) return;

    const targetStatus = Boolean(roomPlaying);
    const now = Date.now();
    const elapsed = Math.max(0, (now - (roomUpdatedAt || now)) / 1000);
    const expectedTime = targetStatus ? (roomCurrentTime || 0) + elapsed : (roomCurrentTime || 0);

    // Correct drift only if greater than 3.5s to avoid constant seeking/stutter
    const currentPos = video.currentTime || 0;
    const drift = Math.abs(currentPos - expectedTime);
    if (drift > 3.5 && !isNaN(expectedTime)) {
      isRemoteSyncRef.current = true;
      video.currentTime = expectedTime;
      setTimeout(() => {
        isRemoteSyncRef.current = false;
      }, 1200);
    }

    // Play/Pause alignment
    if (targetStatus && video.paused) {
      if (!video.src && !video.currentSrc) return;
      isRemoteSyncRef.current = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoPlaying(true);
          })
          .catch((err) => {
            if (err.name === 'NotSupportedError' || err.message?.includes('no supported sources')) {
              return;
            }
            console.warn("Participant unmuted auto-play deferred, retrying muted:", err);
            video.muted = true;
            setIsVideoMuted(true);
            setIsAutoplayBlocked(true);
            video.play()
              .then(() => setIsVideoPlaying(true))
              .catch((e) => {
                if (e.name !== 'NotSupportedError' && !e.message?.includes('no supported sources')) {
                  console.warn("Deferred muted play also deferred:", e);
                }
              });
          })
          .finally(() => {
            setTimeout(() => {
              isRemoteSyncRef.current = false;
            }, 1200);
          });
      }
    } else if (!targetStatus && !video.paused) {
      isRemoteSyncRef.current = true;
      video.pause();
      setIsVideoPlaying(false);
      if (Math.abs(video.currentTime - (roomCurrentTime || 0)) > 1.0) {
        video.currentTime = roomCurrentTime || 0;
      }
      setTimeout(() => {
        isRemoteSyncRef.current = false;
      }, 1200);
    }
  }, [roomPlaying, roomCurrentTime, roomUpdatedAt, isHost, isHostOnline, isScreenSharing, youtubeVideoId, isNetflixParty, room?.videoEnded]);

  // Host auto-start playback if room is marked playing
  useEffect(() => {
    const video = videoRef.current;
    if (!isHost || !video || !room?.playing || isScreenSharing || youtubeVideoId || isNetflixParty) return;
    if (!video.src && !video.currentSrc) return;
    if (video.paused) {
      const p = video.play();
      if (p !== undefined) {
        p.then(() => {
          setIsVideoPlaying(true);
        }).catch((err) => {
          if (err.name === 'NotSupportedError' || err.message?.includes('no supported sources')) {
            return;
          }
          console.warn("Host auto-play blocked, retrying muted:", err);
          video.muted = true;
          setIsVideoMuted(true);
          setIsAutoplayBlocked(true);
          video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
        });
      }
    }
  }, [isHost, room?.playing, isScreenSharing, youtubeVideoId, isNetflixParty]);

  // Host Periodic Heartbeat Sync (every 12s while playing; clients calculate continuous drift via updatedAt)
  useEffect(() => {
    if (!isHost || !cleanRoomId || isScreenSharing || youtubeVideoId || isNetflixParty) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && !isRemoteSyncRef.current && !video.seeking) {
        updateRoomPlayback(true, video.currentTime);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [isHost, cleanRoomId, isScreenSharing, youtubeVideoId, isNetflixParty, updateRoomPlayback]);

  // ---------------------------------------------------------------------------
  // PHASE 5: NETFLIX EXTENSION PLAYBACK SYNCHRONIZATION ENGINE
  // ---------------------------------------------------------------------------

  // 1. Connect room info with Extension
  useEffect(() => {
    if (!cleanRoomId || !room?.title) return;
    extensionBridgeRef.current.joinRoomWithExtension(cleanRoomId, room.title, isHost);
    return () => {
      extensionBridgeRef.current.leaveRoomWithExtension(cleanRoomId);
    };
  }, [cleanRoomId, room?.title, isHost]);

  // 2. Host Authoritative Netflix Playback Publisher
  // Detects play, pause, seek, and content change from the host's Netflix extension tab
  // and writes authoritative state to Firestore (NEVER on every frame).
  useEffect(() => {
    if (!isNetflixParty || !isHost || !cleanRoomId) return;
    if (isApplyingRemoteNetflixPlaybackRef.current) return;

    const netflixState = extensionBridge.netflixState;
    if (!netflixState.isAvailable || !netflixState.state) return;

    const localState = netflixState.state;
    const localContent = netflixState.content;
    const now = Date.now();

    const currentStatus = localState.isPlaying ? 'playing' : 'paused';
    const currentPosition = localState.currentTime;
    const currentContentId = localContent?.id || room?.netflixPlayback?.contentId || 'netflix';

    const last = lastHostPublishedNetflix.current;

    // Calculate expected position based on last publish to identify meaningful seek events
    const elapsedSec = (now - last.updatedAt) / 1000;
    const expectedPos = last.status === 'playing' ? last.position + elapsedSec : last.position;
    const seekDrift = Math.abs(currentPosition - expectedPos);

    const hasStatusChanged = last.status !== currentStatus;
    const hasContentChanged = last.contentId !== currentContentId;
    const hasSeeked = last.position >= 0 && seekDrift > 2.5;

    // Only publish when a meaningful event occurred (or initial publish)
    if (hasStatusChanged || hasContentChanged || hasSeeked || last.position < 0) {
      lastHostPublishedNetflix.current = {
        status: currentStatus,
        position: currentPosition,
        contentId: currentContentId,
        updatedAt: now,
      };

      const updatedNetflixPlayback: NetflixRoomPlayback = {
        status: currentStatus,
        position: currentPosition,
        updatedAt: now,
        contentId: currentContentId,
        contentTitle: localContent?.title || room?.netflixPlayback?.contentTitle || room?.title || 'Netflix Title',
        rawUrl: localContent?.rawUrl || room?.videoUrl || `https://www.netflix.com/watch/${currentContentId}`,
        season: localContent?.season ?? null,
        episode: localContent?.episode ?? null,
        hostId: user?.uid || 'host',
        hostName: username || 'Host',
      };

      updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        playing: localState.isPlaying,
        currentTime: currentPosition,
        updatedAt: now,
        netflixPlayback: updatedNetflixPlayback,
      }).catch((err) => {
        console.warn('Failed to publish host authoritative Netflix playback:', err);
      });
    }
  }, [
    isNetflixParty,
    isHost,
    cleanRoomId,
    user?.uid,
    username,
    room?.title,
    room?.videoUrl,
    room?.netflixPlayback?.contentId,
    room?.netflixPlayback?.contentTitle,
    extensionBridge.netflixState,
  ]);

  // 3. Participant Lockstep Synchronizer
  // Listens to authoritative Firestore room playback state and synchronizes local Netflix tab.
  // Suppresses feedback loops via isApplyingRemoteNetflixPlaybackRef.
  const applyParticipantNetflixSyncRef = useRef<(force?: boolean) => void>(() => {});

  const applyParticipantNetflixSync = useCallback(
    (force = false) => {
      if (isHost || !isNetflixParty || !room?.netflixPlayback) return;
      if (!autoSyncNetflix && !force) return;

      const netflixState = extensionBridgeRef.current.netflixState;
      if (!netflixState.isAvailable || !netflixState.state) return;

      const remotePlayback = room.netflixPlayback;
      const localContent = netflixState.content;

      // Content Identity Guard: Compare content identity before applying playback commands
      if (
        remotePlayback.contentId &&
        localContent?.id &&
        remotePlayback.contentId !== localContent.id
      ) {
        setIsNetflixSynced((prev) => (prev ? false : prev));
        return;
      }

      // Feedback Loop Guard: Avoid re-processing if command was just dispatched
      if (isApplyingRemoteNetflixPlaybackRef.current && !force) return;

      const now = Date.now();
      const elapsed = (now - remotePlayback.updatedAt) / 1000;
      const expectedPosition = remotePlayback.status === 'playing'
        ? Math.max(0, remotePlayback.position + elapsed)
        : remotePlayback.position;

      const localState = netflixState.state;
      const drift = localState.currentTime - expectedPosition;
      const absDrift = Math.abs(drift);

      // Only update drift state if change exceeds 0.5s to avoid rendering storms
      setNetflixSyncDrift((prev) => (prev === null || Math.abs(prev - drift) > 0.5 ? drift : prev));

      // Evaluate required actions:
      const shouldSeek = absDrift > 2.0; // Configured drift threshold > 2.0s
      const shouldPlay = remotePlayback.status === 'playing' && !localState.isPlaying;
      const shouldPause = remotePlayback.status === 'paused' && localState.isPlaying;

      if (!shouldSeek && !shouldPlay && !shouldPause) {
        setIsNetflixSynced((prev) => (!prev ? true : prev));
        if (force) {
          showToast(`Already synchronized with host (drift: ${absDrift.toFixed(1)}s)`);
        }
        return;
      }

      // Arm loop prevention guard
      isApplyingRemoteNetflixPlaybackRef.current = true;
      setTimeout(() => {
        isApplyingRemoteNetflixPlaybackRef.current = false;
      }, 2500);

      // Execute Seek
      if (shouldSeek) {
        extensionBridgeRef.current.sendPlaybackControl('seek', expectedPosition);
      }

      // Execute Play / Pause
      if (shouldPlay) {
        extensionBridgeRef.current.sendPlaybackControl('play');
      } else if (shouldPause) {
        extensionBridgeRef.current.sendPlaybackControl('pause');
      }

      setIsNetflixSynced((prev) => (!prev ? true : prev));
      if (force) {
        showToast(`Synchronized with host at ${formatTime(expectedPosition)}`);
      }
    },
    [isHost, isNetflixParty, room?.netflixPlayback, autoSyncNetflix, showToast]
  );

  useEffect(() => {
    applyParticipantNetflixSyncRef.current = applyParticipantNetflixSync;
  }, [applyParticipantNetflixSync]);

  // Trigger sync on authoritative Firestore updates
  useEffect(() => {
    if (isHost || !isNetflixParty || !room?.netflixPlayback) return;
    applyParticipantNetflixSyncRef.current(false);
  }, [
    isHost,
    isNetflixParty,
    room?.netflixPlayback,
    room?.netflixPlayback?.status,
    room?.netflixPlayback?.position,
    room?.netflixPlayback?.updatedAt,
    room?.netflixPlayback?.contentId,
  ]);

  // Periodic drift check (every 4 seconds for participants)
  useEffect(() => {
    if (isHost || !isNetflixParty || !autoSyncNetflix) return;
    const interval = setInterval(() => {
      applyParticipantNetflixSyncRef.current(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [isHost, isNetflixParty, autoSyncNetflix]);

  const handleManualNetflixSync = () => {
    applyParticipantNetflixSync(true);
  };

  // Initial video metadata load handler
  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video || !room) return;

    setVideoDuration(video.duration || 0);

    const targetStatus = Boolean(room.playing);
    const now = Date.now();
    const elapsed = Math.max(0, (now - (room.updatedAt || now)) / 1000);
    const expectedTime = targetStatus ? (room.currentTime || 0) + elapsed : (room.currentTime || 0);

    isRemoteSyncRef.current = true;
    if (!isNaN(expectedTime) && expectedTime > 0) {
      video.currentTime = expectedTime;
    }

    if (targetStatus && (video.src || video.currentSrc)) {
      const p = video.play();
      if (p !== undefined) {
        p.then(() => {
          setIsVideoPlaying(true);
        }).catch((e) => {
          if (e.name === 'NotSupportedError' || e.message?.includes('no supported sources')) {
            return;
          }
          console.warn("Video metadata play unmuted failed, trying muted:", e);
          video.muted = true;
          setIsVideoMuted(true);
          setIsAutoplayBlocked(true);
          video.play().then(() => setIsVideoPlaying(true)).catch(() => {});
        });
      }
    } else {
      video.pause();
      setIsVideoPlaying(false);
    }

    setTimeout(() => {
      isRemoteSyncRef.current = false;
    }, 1200);
  }, [room]);

  useEffect(() => {
    const videoNode = screenVideoRef.current;
    if (videoNode && screenStream) {
      if (videoNode.srcObject !== screenStream) {
        videoNode.srcObject = screenStream;
      }
      videoNode.muted = isHost ? true : isScreenAudioMuted;
      videoNode.play().catch(() => {
        // Fallback to muted autoplay if browser blocks unmuted playback
        videoNode.muted = true;
        setIsScreenAudioMuted(true);
        videoNode.play().catch(() => {});
      });
    }
  }, [screenStream, isHost, isScreenAudioMuted]);

  useEffect(() => {
    if (!room?.isScreenSharing && !isHost && screenStream) {
      setScreenStream(null);
    }
  }, [room?.isScreenSharing, isHost, screenStream]);

  useEffect(() => {
    if (!user) return;
    
    const fetchFriends = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friends || [];
        const friendDocs = await Promise.all(friendIds.map((id: string) => getDoc(doc(db, 'users', id))));
        setFriends(friendDocs.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() })));
      }
    };

    const fetchContent = async () => {
      const moviesSnap = await getDocs(collection(db, 'movies'));
      const seriesSnap = await getDocs(collection(db, 'series'));
      const moviesList = moviesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Movie));
      const seriesList = seriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Series));
      setAvailableMovies([...moviesList, ...seriesList]);
    };

    if (isInviteModalOpen) fetchFriends();
    if (isChangeMovieModalOpen) fetchContent();
  }, [user, isInviteModalOpen, isChangeMovieModalOpen]);

  const handleScreenStream = useCallback(async (stream: MediaStream | null) => {
    setScreenStream(stream);
    if (!cleanRoomId) return;

    try {
      const currentUser = userRef.current;
      const currentRoom = roomRef.current;
      const currentUid = currentUser?.uid || effectiveUserId;
      const isHostUser = Boolean(currentUser?.uid && currentRoom && (currentUser.uid === currentRoom.hostId || currentUser.uid === currentRoom.ownerId));

      if (isHostUser) {
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          isScreenSharing: Boolean(stream),
          screenHostId: stream ? currentUid : null
        });
      }
    } catch (error) {
      console.warn('Notice updating screen share state:', error);
    }
  }, [cleanRoomId, effectiveUserId]);

  const handleCameraStream = useCallback(async (stream: MediaStream | null) => {
    setCameraStream(stream);
    if (!cleanRoomId) return;

    try {
      const currentUser = userRef.current;
      const currentRoom = roomRef.current;
      const currentUid = currentUser?.uid || effectiveUserId;
      const isHostUser = Boolean(
        isHost ||
        (currentUser?.uid && currentRoom && (currentUser.uid === currentRoom.hostId || currentUser.uid === currentRoom.ownerId))
      );

      if (isHostUser) {
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          isCameraActive: Boolean(stream),
          cameraHostId: stream ? currentUid : null,
          ...(stream ? { isScreenSharing: false } : {}),
        });
      }
    } catch (error) {
      console.warn('Notice updating camera state:', error);
    }
  }, [cleanRoomId, effectiveUserId, isHost]);

  useEffect(() => {
    if (!room?.isCameraActive && !isHost && cameraStream) {
      setCameraStream(null);
    }
  }, [room?.isCameraActive, isHost, cameraStream]);

  const inviteFriend = async (friend: User) => {
    if (!cleanRoomId || !user) return;
    try {
      // Add friend UID to allowedUsers so Firestore rules grant access to this private room
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        allowedUsers: arrayUnion(friend.uid)
      }).catch(err => console.warn('Could not update allowedUsers for invited friend:', err));

      await addDoc(collection(db, 'notifications'), {
        toUser: friend.uid,
        fromUser: user.uid,
        fromUsername: user.displayName || 'Someone',
        type: 'invite',
        message: `${user.displayName || 'A friend'} invited you to watch ${room?.title}`,
        roomId: cleanRoomId,
        inviteCode: room?.inviteCode || '',
        read: false,
        time: new Date().toISOString()
      });
      showToast(`Invite sent to ${friend.username}!`);
    } catch (error) {
      console.error('Error sending invite:', error);
    }
  };

  const changeVideo = async (item: Movie | Episode | Series) => {
    if (!roomId || !user || (room?.hostId !== user.uid && room?.ownerId !== user.uid)) return;
    try {
      let videoUrl = '';
      let episodeId = null;
      let seriesId = null;
      let movieId = null;
      let subtitle = '';

      const isMovie = 'category' in item;
      const isEpisode = 'episodeNumber' in item;
      const isSeries = 'seasons' in item && !isEpisode;

      if (isEpisode) {
        const ep = item as Episode;
        videoUrl = ep.mp4 || ep.m3u8 || ep.streamLink || ep.embed || '';
        episodeId = ep.id;
        seriesId = room.seriesId;
        subtitle = ep.subtitle1 || ep.subtitle || '';
      } else if (isSeries) {
        const q = query(
          collection(db, `series/${item.id}/episodes`), 
          orderBy('seasonNumber'), 
          orderBy('episodeNumber'), 
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const firstEp = { id: snap.docs[0].id, ...snap.docs[0].data() } as Episode;
          videoUrl = firstEp.mp4 || firstEp.m3u8 || firstEp.streamLink || firstEp.embed || '';
          episodeId = firstEp.id;
          seriesId = item.id;
          subtitle = firstEp.subtitle1 || firstEp.subtitle || '';
        } else {
          showToast('This series has no episodes.');
          return;
        }
      } else {
        const mov = item as Movie;
        videoUrl = mov.mp4 || mov.m3u8 || mov.streamLinks?.[0] || mov.embed || '';
        movieId = mov.id;
        subtitle = mov.subtitle1 || '';
      }

      if (!videoUrl) {
        showToast('No video URL found.');
        return;
      }

      await updateDoc(doc(db, 'watchRooms', roomId), {
        title: item.title,
        videoUrl,
        movieId,
        seriesId,
        episodeId,
        contentType: isMovie ? 'movie' : (isSeries ? 'series' : 'episode'),
        contentId: item.id,
        currentTime: 0,
        playing: false,
        updatedAt: Date.now(),
        subtitle
      });
      setIsChangeMovieModalOpen(false);
      showToast(`Changed video to ${item.title}`);
    } catch (error) {
      console.error('Error changing video:', error);
    }
  };

  useEffect(() => {
    if (isInitialMessagesLoad.current) {
      if (messages.length > 0) {
        isInitialMessagesLoad.current = false;
      }
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isEmbed = (url?: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.mp4') || lowerUrl.includes('.m3u8') || lowerUrl.includes('.webm') || lowerUrl.includes('.ogg')) {
      return false;
    }
    return lowerUrl.includes('embed') || 
           lowerUrl.includes('iframe') || 
           lowerUrl.includes('vidsrc') || 
           lowerUrl.includes('dood') || 
           lowerUrl.includes('upstream') || 
           lowerUrl.includes('mixdrop') || 
           lowerUrl.includes('voe.sx') || 
           lowerUrl.includes('streamtape');
  };

  const currentIsEmbed = room ? isEmbed(room.videoUrl) : false;

  // Handle HLS for HTML5 video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !room?.videoUrl || currentIsEmbed || youtubeVideoId) return;

    setVideoLoadError(null);
    const rawUrl = room.videoUrl.trim();
    // Auto upgrade http to https if app origin is https to prevent Mixed Content blocking
    const hlsUrl = (typeof window !== 'undefined' && window.location.protocol === 'https:' && rawUrl.startsWith('http://'))
      ? rawUrl.replace('http://', 'https://')
      : rawUrl;
    const isHls = hlsUrl.toLowerCase().includes('.m3u8');
    let hlsInstance: Hls | null = null;

    if (isHls) {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30
        });
        hlsInstance.loadSource(hlsUrl);
        hlsInstance.attachMedia(video);
        let errorRetryCount = 0;
        hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.warn("HLS fatal error encountered:", data);
            if (errorRetryCount < 2) {
              errorRetryCount++;
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                console.log("[HLS] Attempting network error recovery...");
                hlsInstance?.startLoad();
                return;
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                console.log("[HLS] Attempting media error recovery...");
                hlsInstance?.recoverMediaError();
                return;
              }
            }
            setVideoLoadError("This stream source is currently offline or unavailable.");
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
      }
    } else {
      const targetSrc = encodeUrl(hlsUrl);
      if (video.src !== targetSrc && video.currentSrc !== targetSrc) {
        video.src = targetSrc;
      }
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [room?.videoUrl, currentIsEmbed, youtubeVideoId]);

  const handleTyping = useCallback(async () => {
    if (!cleanRoomId || !effectiveUserId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 3000) return;
    lastTypingSentRef.current = now;

    try {
      await setDoc(doc(db, `watchRooms/${cleanRoomId}/typing`, effectiveUserId), {
        lastTyped: new Date().toISOString(),
        username: username,
        uid: effectiveUserId
      }, { merge: true });
    } catch (e) {
      console.warn("Error updating typing status:", e);
    }
  }, [cleanRoomId, effectiveUserId, username]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !cleanRoomId) return;
    try {
      await addDoc(collection(db, `watchRooms/${cleanRoomId}/messages`), {
        text: newMessage,
        username,
        userId: effectiveUserId,
        isHost,
        timestamp: new Date().toISOString()
      });
      setNewMessage('');
      if (effectiveUserId) {
        await deleteDoc(doc(db, `watchRooms/${cleanRoomId}/typing`, effectiveUserId)).catch(() => {});
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'send_message');
    }
  };

  const sendReaction = useCallback(async (emoji: string) => {
    if (!cleanRoomId) return;
    const now = Date.now();
    if (now - lastReactionSentRef.current < 400) return;
    lastReactionSentRef.current = now;

    try {
      await addDoc(collection(db, `watchRooms/${cleanRoomId}/reactions`), {
        emoji,
        username,
        time: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'send_reaction');
    }
  }, [cleanRoomId, username]);

  const getRoomShareUrl = useCallback(() => {
    if (!cleanRoomId) return '';
    const base = `${window.location.origin}/watchparty/${cleanRoomId}`;
    if (room?.inviteCode) {
      return `${base}?invite=${encodeURIComponent(room.inviteCode)}`;
    }
    return base;
  }, [cleanRoomId, room?.inviteCode]);

  const handleCopyLink = async () => {
    if (!cleanRoomId) return;
    const shareUrl = getRoomShareUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: room?.title ? `Watch ${room.title} on Synora` : 'Join my Synora Watch Party',
          text: `Watch ${room?.title || 'videos'} together in real-time on Synora!`,
          url: shareUrl,
        });
        showToast('Invite link shared successfully!');
        return;
      } catch (err: unknown) {
        const errorObj = err as { name?: string };
        if (errorObj?.name !== 'AbortError') {
          console.warn('Navigator share error:', err);
        } else {
          return;
        }
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).catch(() => {
        fallbackCopy(shareUrl);
      });
    } else {
      fallbackCopy(shareUrl);
    }
    setCopied(true);
    showToast('Room invite link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (e) {
      console.warn("Fallback copy failed:", e);
    }
  };

  // Sync with Host Handler
  const syncWithHost = () => {
    if (!room || isHost) return;

    // If YouTube Player is active
    if (youtubeVideoId && ytSyncFnRef.current) {
      ytSyncFnRef.current();
      showToast("Synchronized with Host");
      return;
    }

    // Standard HTML5 video
    const video = videoRef.current;
    if (!video) {
      showToast("Player is still loading...");
      return;
    }

    const storedPosition = room.currentTime || 0;
    const timestampOfLastUpdate = room.updatedAt || Date.now();
    const timeSinceUpdateInSeconds = Math.max(0, (Date.now() - timestampOfLastUpdate) / 1000);
    
    // Calculate expected playback position using storedPosition + elapsed time since last update when playing
    const expectedPosition = room.playing 
      ? storedPosition + timeSinceUpdateInSeconds
      : storedPosition;

    isRemoteSyncRef.current = true;
    if (!isNaN(expectedPosition)) {
      video.currentTime = expectedPosition;
    }

    if (room.playing && (video.src || video.currentSrc)) {
      video.play().catch((err) => console.warn("Sync play deferred:", err));
    } else if (!room.playing) {
      video.pause();
    }

    setTimeout(() => {
      isRemoteSyncRef.current = false;
    }, 400);

    showToast(`Synchronized with Host at ${formatTime(expectedPosition)}`);
  };

  const leaveRoom = async () => {
    if (!cleanRoomId) return;
    if (isHost) {
      setIsLeaveConfirmationOpen(true);
    } else {
      try {
        const currentUid = userRef.current?.uid || effectiveUserId;
        if (currentUid) {
          await markUserOffline(cleanRoomId, currentUid);
          await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
            usersCount: increment(-1)
          }).catch(() => {});
        }
      } catch (error) {
        console.warn('Error leaving room:', error);
      }
      navigate('/');
    }
  };

  const confirmLeaveRoom = async (endAndPermanentlyDelete: boolean = false) => {
    if (!cleanRoomId) return;
    setIsLeavingRoom(true);
    try {
      // Immediately stop media and screen share tracks
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }

      // Notify extension bridge
      try {
        extensionBridgeRef.current.leaveRoomWithExtension(cleanRoomId);
      } catch (extErr) {
        console.debug('Extension bridge cleanup non-fatal:', extErr);
      }

      const currentUid = userRef.current?.uid || effectiveUserId;
      if (currentUid) {
        await markUserOffline(cleanRoomId, currentUid);
        updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          usersCount: increment(-1)
        }).catch(() => {});
      }

      if (isHost && endAndPermanentlyDelete) {
        // Explicitly end and remove the room permanently
        purgeRoomFromLocalState(cleanRoomId);
        await deleteRoomPermanently(cleanRoomId);
      }
      
      setIsLeaveConfirmationOpen(false);
      navigate('/');
    } catch (error) {
      console.warn('Error leaving room:', error);
      setIsLeaveConfirmationOpen(false);
      navigate('/');
    } finally {
      setIsLeavingRoom(false);
    }
  };

  const getXPos = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 80) + 10 + '%';
  };

  // 1. Loading state
  if (authLoading || roomLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading Watch Party...</p>
      </div>
    );
  }

  // 2. Permission Denied state
  if (permissionDenied) {
    const hasInviteParam = Boolean(inviteCodeParam);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 space-y-6">
        <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center border border-amber-500/30">
          <AlertTriangle size={38} />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-2xl sm:text-3xl font-black">
            {hasInviteParam && !user ? "Sign In to Accept Invitation" : "You don't have access to this room"}
          </h2>
          <p className="text-gray-400 text-sm">
            {hasInviteParam && !user
              ? "You've been invited to this private watch party! Please sign in to verify your invitation and join."
              : "This watch party is private. Only the room owner and explicitly invited participants can join."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
          {!user ? (
            <Link 
              to={`/login?redirect=${encodeURIComponent(`/watchparty/${cleanRoomId}${inviteCodeParam ? `?invite=${inviteCodeParam}` : ''}`)}`}
              className="w-full text-center px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 text-sm"
            >
              Sign In to Continue
            </Link>
          ) : (
            <Link 
              to={`/login?redirect=${encodeURIComponent(`/watchparty/${cleanRoomId}`)}`}
              className="w-full text-center px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all border border-white/10 text-sm"
            >
              Switch Account
            </Link>
          )}
          <Link 
            to="/" 
            className="w-full text-center px-6 py-3.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl font-bold transition-all border border-white/5 text-sm"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // 3. Room Not Found state
  if (roomNotFound || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 space-y-6">
        <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center">
          <X size={40} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black">Room Not Found</h2>
          <p className="text-gray-400">This watch party doesn't exist or has been ended.</p>
        </div>
        <Link to="/" className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all border border-white/10">
          Back to Home
        </Link>
      </div>
    );
  }

  // 4. Room Ended state
  if (!room.isActive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 space-y-6">
        <div className="w-20 h-20 bg-gray-800 text-gray-400 rounded-full flex items-center justify-center border border-white/10">
          <Film size={40} />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-3xl font-black">Watch Party Ended</h2>
          <p className="text-gray-400">
            {isHost 
              ? 'You previously ended this session. You can reactivate and reopen this room anytime.' 
              : 'The host has ended this watch party session.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isHost && (
            <button 
              onClick={async () => {
                try {
                  await updateDoc(doc(db, 'watchRooms', cleanRoomId), { isActive: true });
                  setRoom(prev => prev ? { ...prev, isActive: true } : null);
                  handleJoin();
                } catch (err) {
                  console.error('Reactivate room error:', err);
                }
              }}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2"
            >
              <Play size={18} fill="currentColor" /> Reactivate & Reopen Party
            </button>
          )}
          <Link to="/" className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all">
            Browse Other Rooms
          </Link>
        </div>
      </div>
    );
  }

  // 5. Nickname / Join modal if not yet joined
  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-black">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 w-full max-w-md space-y-8 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <Users size={32} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Joining Watch Party</h2>
            <p className="text-gray-400 text-xs sm:text-sm">Connecting you to <span className="text-white font-semibold">{room.title}</span>...</p>
          </div>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin(username.trim());
            }}
            className="space-y-4"
          >
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose your display name..."
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            <button 
              id="enter-room-now-btn"
              type="submit"
              disabled={isJoining}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Enter Room Now'
              )}
            </button>
            
            {!user && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">Want to sign in with Google?</p>
                <Link 
                  to={`/login?redirect=${encodeURIComponent(`/watchparty/${cleanRoomId}${inviteCodeParam ? `?invite=${inviteCodeParam}` : ''}`)}`}
                  className="text-xs font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400"
                >
                  Sign in with Google
                </Link>
              </div>
            )}
          </form>

          <div className="pt-6 border-t border-white/5 space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Share this room</p>
            <div className="flex items-center gap-2 p-2 bg-black/40 rounded-2xl border border-white/5">
              <input 
                readOnly 
                value={getRoomShareUrl()}
                className="flex-1 bg-transparent border-none text-[10px] text-gray-400 px-2 focus:outline-none"
              />
              <button 
                onClick={handleCopyLink}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-emerald-500 transition-all"
              >
                {copied ? <Check size={16} /> : <Share2 size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Room Ended Overlay */}
      <AnimatePresence>
        {isRoomEnded && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-6 max-w-md"
            >
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <Film size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white">Watch Party Ended</h2>
                <p className="text-gray-400">The host has ended this session. We hope you had a great time!</p>
              </div>
              <button 
                onClick={() => navigate('/')}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-900/20"
              >
                Return to Home
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="relative md:sticky top-0 z-30 bg-[#0f0f0f]/80 backdrop-blur-md border-b border-white/5 px-4 h-auto min-h-[64px] py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-white/5 rounded-full text-gray-400 transition-all">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex flex-col">
              <h1 className="text-[10px] sm:text-[11px] font-semibold text-white truncate max-w-[130px] sm:max-w-[220px] md:max-w-md">{room.title}</h1>
              <div className="flex items-center gap-2 text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-widest font-semibold">
                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-bold">{liveUsers.length} Live</span>
                  <span className="text-gray-400 font-medium">/ {allRoomUsers.length} Total</span>
                </span>
                <span>•</span>
                <span className={room.playing ? 'text-emerald-500' : 'text-yellow-500'}>{room.playing ? 'Playing' : 'Paused'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button 
              onClick={leaveRoom}
              className="p-2 bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-900/20 text-white"
              title="Leave Room"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Bar with single unified VoiceChat */}
        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-2 md:gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
          <div className="flex items-center gap-2">
            {user && (
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="p-2 md:p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all border border-white/5"
                title="Invite Friend"
              >
                <UserPlus size={18} />
              </button>
            )}
            <button 
              onClick={handleCopyLink}
              className="flex items-center gap-2 p-2 md:px-4 md:py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5 text-gray-300 hover:text-white"
              title="Share Room"
            >
              {copied ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
              <span className="hidden md:inline">{copied ? 'Copied!' : 'Share Room'}</span>
            </button>
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <VoiceChat 
              roomId={cleanRoomId} 
              userId={effectiveUserId}
              username={username} 
              muted={muted}
              mutedByHost={isHostMuted}
              onMuteChange={setMuted}
              onMuteToggle={setMuted}
              onSpeaking={(speakerId) => {
                const speaker = liveUsers.find(u => u.uid === speakerId || u.username === speakerId);
                const id = speaker?.uid || speakerId;
                setSpeakingUsers(prev => ({ ...prev, [id]: true }));
                setTimeout(() => {
                  setSpeakingUsers(prev => ({ ...prev, [id]: false }));
                }, 2000);
              }}
              onToast={showToast}
            />
            {cleanRoomId && (
              <ScreenShare 
                roomId={cleanRoomId} 
                userId={effectiveUserId}
                username={username} 
                isHost={isHost} 
                isScreenSharingActive={Boolean(room?.isScreenSharing)}
                hostId={room?.screenHostId || room?.hostId}
                onStreamReady={handleScreenStream} 
                onToast={showToast}
              />
            )}
            {cleanRoomId && (
              <CameraBroadcast
                roomId={cleanRoomId}
                userId={effectiveUserId}
                username={username}
                isHost={isHost}
                isCameraActive={Boolean(room?.isCameraActive)}
                cameraHostId={room?.cameraHostId || room?.hostId}
                onStreamReady={handleCameraStream}
                onToast={showToast}
                facingMode={cameraFacingMode}
                onFacingModeChange={setCameraFacingMode}
                isHostOnline={isHostOnline}
              />
            )}
            <button 
              onClick={leaveRoom}
              className="hidden md:block px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/20 text-white"
            >
              Leave Room
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto p-0 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Left Side / Top: Player (Sticky top-0 on mobile so it stays fixed to the screen while scrolling) */}
        <div 
          id="video-player-stage"
          data-video-stage="true"
          ref={playerContainerRef}
          onMouseMove={handlePlayerMouseMove}
          onMouseLeave={() => { if (isVideoPlaying) setShowPlayerControls(false); }}
          className="sticky top-0 z-40 w-full aspect-video bg-black shadow-2xl border-b lg:border border-white/10 select-none lg:relative lg:top-auto lg:z-auto lg:aspect-video lg:rounded-2xl lg:overflow-hidden lg:col-span-3 group"
        >
          {/* Scrolled-to-fixed mobile indicator & jump back button */}
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
            {room.isCameraActive || Boolean(cameraStream) ? (
              <div className="w-full h-full relative flex items-center justify-center bg-black select-none">
                {cameraStream ? (
                  <div className="w-full h-full relative group">
                    <video
                      ref={(el) => {
                        cameraVideoRef.current = el;
                        if (el && cameraStream) {
                          if (el.srcObject !== cameraStream) {
                            el.srcObject = cameraStream;
                          }
                          el.muted = isHost ? true : isCameraAudioMuted;
                          el.playsInline = true;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted={isHost ? true : isCameraAudioMuted}
                      className={`w-full h-full object-contain ${isHost && cameraFacingMode === 'user' ? '-scale-x-100' : ''}`}
                    />

                    {/* Camera Live Badge */}
                    <div className="absolute top-4 left-4 bg-emerald-600 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg z-20">
                      <Camera size={14} className="animate-pulse text-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">
                        {isHost ? 'Live Camera (Broadcasting)' : `${room.hostName}'s Camera`}
                      </span>
                    </div>

                    {/* Controls for audio & fullscreen */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-2 z-30 transition-opacity opacity-90 hover:opacity-100">
                      {!isHost && (
                        isCameraAudioMuted ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (cameraVideoRef.current) {
                                cameraVideoRef.current.muted = false;
                                setIsCameraAudioMuted(false);
                                cameraVideoRef.current.play().catch(() => {});
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/90 hover:bg-amber-500 text-black shadow-lg backdrop-blur-sm transition-all cursor-pointer"
                            title="Click to unmute camera audio"
                          >
                            <VolumeX size={14} />
                            <span>Unmute Audio</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (cameraVideoRef.current) {
                                cameraVideoRef.current.muted = true;
                                setIsCameraAudioMuted(true);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/60 hover:bg-black/80 text-white border border-white/10 shadow-lg backdrop-blur-sm transition-all cursor-pointer"
                            title="Mute camera audio"
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
                        title="Fullscreen"
                      >
                        <Maximize size={14} />
                      </button>
                    </div>
                  </div>
                ) : isHost ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Camera size={28} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">Camera Mode Ready</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm">Tap "Camera" in the bar above to start broadcasting your camera to the room.</p>
                    </div>
                  </div>
                ) : !isHostOnline && hasInitialUsersLoaded ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg">
                      <Pause size={28} className="fill-amber-400/20" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span>Host Offline (Broadcast Paused)</span>
                      </div>
                      <h3 className="text-base font-bold text-white">Live Broadcast Paused</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">The host is currently offline. The broadcast will automatically resume when {room.hostName || 'the host'} returns.</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (cleanRoomId) {
                          const targetHost = room.cameraHostId || room.hostId || 'host';
                          try {
                            await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                              from: effectiveUserId,
                              to: targetHost,
                              type: 'camera-request',
                              time: new Date().toISOString(),
                            });
                            showToast('Checking if host has reconnected...');
                          } catch (e) {
                            console.warn('Manual camera retry error:', e);
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Check Connection</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-emerald-400 flex items-center justify-center animate-pulse">
                      <Camera size={28} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Connecting to Host Camera...</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">Establishing real-time WebRTC camera connection with host</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (cleanRoomId) {
                          const targetHost = room.cameraHostId || room.hostId || 'host';
                          try {
                            await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                              from: effectiveUserId,
                              to: targetHost,
                              type: 'camera-request',
                              time: new Date().toISOString(),
                            });
                            showToast('Re-requesting camera stream from host...');
                          } catch (e) {
                            console.warn('Manual camera retry error:', e);
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Re-request Camera Stream</span>
                    </button>
                  </div>
                )}
              </div>
            ) : room.isScreenSharing ? (
              <div className="w-full h-full relative flex items-center justify-center bg-black select-none">
                {screenStream ? (
                  isHost && !showHostScreenPreview ? (
                    /* Broadcaster HUD: eliminates infinite recursion loop on mobile devices, keeping the entire room ultra-responsive */
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4 bg-gradient-to-b from-zinc-900 to-black select-none">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-950/40">
                          <Radio size={32} className="animate-pulse" />
                        </div>
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-ping" />
                      </div>

                      <div className="space-y-1 max-w-sm">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Screen Broadcast Active
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-white pt-1">
                          You Are Broadcasting Live
                        </h3>
                        <p className="text-xs text-gray-400">
                          {liveUsers.length} {liveUsers.length === 1 ? 'viewer' : 'viewers'} in the room. Switch to any app, video, or presentation on your device to share.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (screenStream) {
                              screenStream.getTracks().forEach(t => t.stop());
                            }
                            setScreenStream(null);
                            updateDoc(doc(db, 'watchRooms', cleanRoomId), {
                              isScreenSharing: false,
                              screenHostId: null
                            }).catch(() => {});
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-950/40 flex items-center gap-1.5 cursor-pointer"
                        >
                          <MonitorOff size={14} />
                          <span>Stop Screen Share</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowHostScreenPreview(true)}
                          className="px-3 py-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer"
                          title="Show video preview (may cause visual feedback on mobile)"
                        >
                          <Eye size={14} />
                          <span>Preview Stream</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full relative group">
                      <video
                        ref={screenVideoRef}
                        autoPlay
                        playsInline
                        muted={isHost ? true : isScreenAudioMuted}
                        className="w-full h-full object-contain"
                      />

                      {isHost && (
                        <div className="absolute top-4 right-4 z-30">
                          <button
                            type="button"
                            onClick={() => setShowHostScreenPreview(false)}
                            className="px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-gray-300 hover:text-white text-[11px] font-medium border border-white/10 shadow-lg cursor-pointer"
                          >
                            Hide Preview
                          </button>
                        </div>
                      )}

                      {/* Participant Screen Audio and View Controls */}
                      {!isHost && (
                        <div className="absolute bottom-4 right-4 flex items-center gap-2 z-30 transition-opacity opacity-90 hover:opacity-100">
                          {isScreenAudioMuted ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (screenVideoRef.current) {
                                  screenVideoRef.current.muted = false;
                                  setIsScreenAudioMuted(false);
                                  screenVideoRef.current.play().catch(() => {});
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/90 hover:bg-amber-500 text-black shadow-lg backdrop-blur-sm transition-all"
                              title="Click to unmute screen audio"
                            >
                              <VolumeX size={14} />
                              <span>Unmute Audio</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (screenVideoRef.current) {
                                  screenVideoRef.current.muted = true;
                                  setIsScreenAudioMuted(true);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/60 hover:bg-black/80 text-white border border-white/10 shadow-lg backdrop-blur-sm transition-all"
                              title="Mute screen audio"
                            >
                              <Volume2 size={14} />
                              <span>Audio On</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white border border-white/10 shadow-lg backdrop-blur-sm transition-all"
                            title="Fullscreen"
                          >
                            <Maximize size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ) : isHost ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Monitor size={28} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">Screen Share Mode Active</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm">Tap "Share Screen" in the bar above to broadcast your screen to the room.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-emerald-400 flex items-center justify-center animate-pulse">
                      <Monitor size={28} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Connecting to Host Screen Share...</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">Establishing real-time WebRTC stream connection with host</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (cleanRoomId) {
                          const targetHost = room.screenHostId || room.hostId || 'host';
                          try {
                            await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                              from: effectiveUserId,
                              to: targetHost,
                              type: 'screen-request',
                              time: new Date().toISOString(),
                            });
                          } catch (e) {
                            console.warn('Manual retry error:', e);
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Re-request Stream</span>
                    </button>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg z-20">
                  <Monitor size={14} className="animate-pulse text-white" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Screen Share</span>
                </div>
              </div>
            ) : youtubeVideoId ? (
              <YouTubeSyncPlayer 
                videoId={youtubeVideoId}
                isHost={isHost}
                isHostOnline={isHostOnline}
                roomPlaying={isHostOnline && !room.videoEnded ? Boolean(room.playing) : false}
                roomCurrentTime={room.currentTime || 0}
                roomUpdatedAt={room.updatedAt || 0}
                videoEnded={Boolean(room?.videoEnded)}
                playing={isHostOnline && !room.videoEnded ? Boolean(room.playing) : false}
                currentTime={room.currentTime || 0}
                updatedAt={room.updatedAt || 0}
                onPlaybackChange={updateRoomPlayback}
                onHostPlaybackChange={updateRoomPlayback}
                onSyncReady={handleYtSyncReady}
                isRemoteSyncRef={isRemoteSyncRef}
              />
            ) : isNetflixParty ? (
              <NetflixSyncCompanion
                room={room}
                isHost={isHost}
                extensionBridge={extensionBridge}
                onManualSync={handleManualNetflixSync}
                syncDrift={netflixSyncDrift}
                isSynced={isNetflixSynced}
                contentMismatch={isContentMismatch}
                autoSyncEnabled={autoSyncNetflix}
                onToggleAutoSync={handleToggleAutoSync}
                onToast={showToast}
              />
            ) : currentIsEmbed ? (
              <iframe 
                src={encodeUrl(room.videoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                frameBorder="0"
                title="Watch Party Player"
              />
            ) : (
              <div className="w-full h-full relative group">
                <video
                  ref={videoRef}
                  src={room?.videoUrl && !room.videoUrl.toLowerCase().includes('.m3u8') ? encodeUrl(room.videoUrl) : undefined}
                  className="w-full h-full object-contain cursor-pointer"
                  playsInline
                  preload="auto"
                  onClick={toggleVideoPlay}
                  onEnded={() => {
                    setIsVideoPlaying(false);
                    if (isHost) {
                      handleHostVideoEnded();
                    }
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setVideoCurrentTime(videoRef.current.currentTime);
                      if (isHost && !room?.videoEnded && videoRef.current.duration > 0 && videoRef.current.currentTime >= videoRef.current.duration - 0.4) {
                        handleHostVideoEnded();
                      }
                    }
                  }}
                  onDurationChange={() => {
                    if (videoRef.current) {
                      setVideoDuration(videoRef.current.duration || 0);
                    }
                  }}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onPlay={() => {
                    setIsVideoPlaying(true);
                    if (isHost && !isRemoteSyncRef.current && videoRef.current && !videoRef.current.seeking) {
                      updateRoomPlayback(true, videoRef.current.currentTime, false);
                    }
                  }}
                  onPause={() => {
                    setIsVideoPlaying(false);
                    if (isHost && !isRemoteSyncRef.current && videoRef.current && !videoRef.current.seeking) {
                      updateRoomPlayback(false, videoRef.current.currentTime, false);
                    }
                  }}
                  onSeeked={() => {
                    if (isHost && !isRemoteSyncRef.current && videoRef.current) {
                      updateRoomPlayback(!videoRef.current.paused, videoRef.current.currentTime, false);
                    }
                  }}
                  onError={() => {
                    const video = videoRef.current;
                    if (!video || !room?.videoUrl) return;
                    // Ignore abort error (code 1) which happens on video src re-assignment or reload
                    if (video.error?.code === 1) {
                      return;
                    }
                    // Only display error if there's a genuine decode/network failure on an active source
                    if (video.error && video.src) {
                      console.warn("Video element reported decode error:", video.error);
                      setVideoLoadError("This video stream could not be loaded or has expired.");
                    }
                  }}
                >
                  {room.subtitle && (
                    <track 
                      kind="subtitles" 
                      src={room.subtitle} 
                      srcLang="en" 
                      label="English" 
                      default 
                    />
                  )}
                </video>

                {/* Big Center Play/Pause Button when paused and not ended */}
                {!isVideoPlaying && !videoLoadError && isHostOnline && !room?.videoEnded && (
                  <div 
                    onClick={toggleVideoPlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all cursor-pointer z-10"
                  >
                    <div className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/50 hover:scale-110 active:scale-95 transition-all">
                      <Play size={36} className="ml-1 fill-white" />
                    </div>
                  </div>
                )}

                {/* Video Finished Overlay (Enforces room-wide end: participants cannot restart) */}
                {Boolean(room?.videoEnded) && (
                  <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
                      <Film size={32} />
                    </div>
                    <div className="max-w-md">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-gray-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Video Finished
                      </div>
                      <h3 className="text-white font-black text-xl sm:text-2xl">
                        {room.title || "Watch Party"} has ended
                      </h3>
                      <p className="text-gray-300 text-xs sm:text-sm mt-1.5 leading-relaxed">
                        {isHost
                          ? "The video playback has finished. You can replay the video from the beginning or choose another video."
                          : `The host (${room.hostName || "Host"}) has finished the video. Waiting for the host to restart or choose a new video.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      {isHost ? (
                        <>
                          <button
                            type="button"
                            onClick={handleHostReplayVideo}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-xl shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          >
                            <RotateCcw size={16} /> Replay from Beginning
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditStreamInput(room.videoUrl || '');
                              setIsEditStreamModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold border border-white/10 transition-all cursor-pointer flex items-center gap-2"
                          >
                            <LinkIcon size={16} /> Change Video
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs text-gray-200 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Connected — waiting for host to restart</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Autoplay Muted Warning Badge */}
                {isAutoplayBlocked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnmuteVideo();
                    }}
                    className="absolute top-4 left-4 z-20 px-3.5 py-2 bg-emerald-600/95 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-xl flex items-center gap-2 backdrop-blur-md transition-all animate-bounce"
                  >
                    <VolumeX size={16} />
                    <span>Click to Unmute Audio</span>
                  </button>
                )}

                {/* Video Error Overlay */}
                {videoLoadError && (
                  <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <AlertTriangle size={28} />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-base">Video Stream Unavailable</h4>
                      <p className="text-gray-400 text-xs mt-1 max-w-sm">{videoLoadError}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={handleRetryStream}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all"
                      >
                        <RefreshCw size={14} /> Retry Stream
                      </button>
                      {isHost && (
                        <button
                          onClick={() => {
                            setEditStreamInput(room.videoUrl || '');
                            setIsEditStreamModalOpen(true);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
                        >
                          <LinkIcon size={14} /> Edit Stream Link
                        </button>
                      )}
                      {isHost && (
                        <button
                          onClick={handleSwitchToWorkingSample}
                          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-all flex items-center gap-1.5"
                          title="Switch video source to a working sample film (keeps your room title intact)"
                        >
                          <Film size={14} /> Test with Sample Film
                        </button>
                      )}
                      {isHost && (
                        <button
                          onClick={() => setIsChangeMovieModalOpen(true)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-all"
                        >
                          Movie Catalog
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Sleek Custom Control Bar */}
                <div 
                  className={`absolute bottom-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${
                    showPlayerControls || !isVideoPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Progress / Scrubber Bar */}
                  <div className="relative mb-3 flex items-center group/slider cursor-pointer">
                    <input
                      type="range"
                      min={0}
                      max={videoDuration || 100}
                      step={0.1}
                      value={videoCurrentTime}
                      disabled={(!isHost && !isHostOnline) || (!isHost && Boolean(room?.videoEnded))}
                      onChange={(e) => handleSeekVideo(parseFloat(e.target.value))}
                      className={`w-full h-1.5 bg-white/20 rounded-lg appearance-none transition-all ${
                        (!isHost && !isHostOnline) || (!isHost && Boolean(room?.videoEnded))
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:h-2 cursor-pointer accent-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 text-white text-xs">
                    {/* Left Controls */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={toggleVideoPlay}
                        disabled={(!isHost && !isHostOnline) || (!isHost && Boolean(room?.videoEnded))}
                        className={`p-1.5 rounded-lg text-white transition-colors ${
                          (!isHost && !isHostOnline) || (!isHost && Boolean(room?.videoEnded))
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-white/10'
                        }`}
                        title={
                          !isHost && room?.videoEnded
                            ? "The video has ended. Waiting for host to restart."
                            : !isHost && !isHostOnline
                            ? "Playback is paused until the host returns."
                            : isVideoPlaying ? "Pause" : "Play"
                        }
                      >
                        {isVideoPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white" />}
                      </button>

                      {/* Volume & Mute */}
                      <div className="flex items-center gap-1.5 group/vol">
                        <button
                          onClick={toggleVideoMute}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
                          title={isVideoMuted ? "Unmute" : "Mute"}
                        >
                          {isVideoMuted || videoVolume === 0 ? (
                            <VolumeX size={18} className="text-amber-400" />
                          ) : (
                            <Volume2 size={18} />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isVideoMuted ? 0 : videoVolume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      {/* Time display */}
                      <span className="text-[11px] font-medium text-gray-300">
                        {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                      </span>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-3">
                      {!isHost && (
                        <button
                          type="button"
                          onClick={() => {
                            if (videoRef.current && room?.currentTime !== undefined) {
                              handleSeekVideo(room.currentTime);
                            }
                          }}
                          disabled={!isHostOnline}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                            !isHostOnline
                              ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                          }`}
                          title={!isHostOnline ? "Playback is paused until the host returns." : "Align video to host position"}
                        >
                          <RefreshCw size={12} className={!isHostOnline ? '' : 'text-emerald-400'} /> Sync with Host
                        </button>
                      )}

                      {isHost && (
                        <span className="hidden sm:inline-block px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                          Host Controls
                        </span>
                      )}

                      <button
                        onClick={handleToggleFullscreen}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
                        title={isPlayerFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      >
                        {isPlayerFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reactions Overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
              <AnimatePresence>
                {reactions.map((reaction) => (
                  <motion.div
                    key={reaction.id}
                    initial={{ y: 0, x: getXPos(reaction.id), opacity: 0, scale: 0.6 }}
                    animate={{ 
                      y: ['0px', '-50px', '-140px', '-230px'], 
                      opacity: [0, 1, 1, 0.7, 0], 
                      scale: [0.6, 1.15, 1.1, 0.95, 0.8] 
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 6.5, ease: "easeInOut" }}
                    className="absolute bottom-6 text-xl sm:text-2xl filter drop-shadow select-none"
                  >
                    {reaction.emoji}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Host Offline Global Overlay (Applies to all video sources) */}
            {!isHost && !isHostOnline && hasInitialUsersLoaded && (
              <div 
                id="host-offline-overlay"
                className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-xl shadow-amber-950/40">
                  <Pause size={32} className="fill-amber-400/20" />
                </div>

                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold mb-3 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Host is offline</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
                  {room?.isCameraActive || Boolean(cameraStream) ? 'Live Broadcast Paused' : 'Host is offline'}
                </h3>

                <p className="text-sm sm:text-base text-gray-300 max-w-md font-medium leading-relaxed mb-5">
                  {room?.isCameraActive || Boolean(cameraStream)
                    ? 'The live camera broadcast is paused until the host returns.'
                    : 'Playback is paused until the host returns.'}
                </p>

                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Waiting for <strong className="text-white">{room.hostName || 'the host'}</strong> to reconnect</span>
                </div>
              </div>
            )}

            {!isHost && !currentIsEmbed && (
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 z-20">
                <div className={`w-2 h-2 rounded-full ${
                  !isHostOnline
                    ? 'bg-amber-400 animate-pulse'
                    : room.playing ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'
                }`} />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  {!isHostOnline ? 'Host Offline (Paused)' : room.playing ? 'In Sync (Playing)' : 'In Sync (Paused)'}
                </span>
              </div>
            )}
          </div>

        {/* Room Info, Reactions & Host Controls */}
        <div className="px-4 sm:px-0 space-y-4 lg:col-span-3 lg:col-start-1 lg:row-start-2">
          {/* Mobile Quick Jump to Chat & Comment */}
          <div className="flex lg:hidden items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-300">Live Party</span>
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{liveUsers.length} Live</span>
                <span className="text-emerald-200/60 font-normal">/ {allRoomUsers.length} Total</span>
              </span>
            </div>
            <button 
              onClick={() => {
                const chatEl = document.getElementById('watchparty-live-chat');
                if (chatEl) {
                  chatEl.scrollIntoView({ behavior: 'smooth' });
                  setTimeout(() => {
                    const input = document.getElementById('watchparty-chat-input');
                    if (input) input.focus();
                  }, 300);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/30 active:scale-95"
            >
              <MessageSquare size={13} />
              <span>Jump to Chat ({messages.length})</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white/5 lg:bg-transparent p-3 sm:p-4 lg:p-0 rounded-2xl border border-white/5 lg:border-0">
            <div className="space-y-0.5 sm:space-y-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-sm sm:text-base font-bold text-white">{room.title}</h2>
                {isHost && (
                  <button 
                    onClick={() => setIsChangeMovieModalOpen(true)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-emerald-500 transition-all"
                    title="Change Movie"
                  >
                    <Film size={16} />
                  </button>
                )}
                {!isHost && (
                  <button 
                    onClick={syncWithHost}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/30 shadow-sm"
                    title="Recalculate and Align with Host"
                  >
                    <RefreshCw size={12} className="animate-spin-once" />
                    Sync with Host
                  </button>
                )}
              </div>
              <p className="text-gray-400 text-[11px]">Hosted by <span className="text-emerald-400 font-semibold">{room.hostName}</span></p>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 bg-white/5 p-1.5 sm:p-2 rounded-2xl border border-white/5">
              {['👍', '😂', '🔥', '❤️', '👀'].map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-90 text-base sm:text-xl"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side / Bottom: Chat */}
        <div 
          id="watchparty-live-chat"
          className="scroll-mt-[230px] px-4 sm:px-0 lg:px-0 lg:col-span-1 lg:col-start-4 lg:row-start-1 lg:row-span-2 flex flex-col h-[520px] sm:h-[600px] lg:h-[calc(100vh-120px)] bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="p-2.5 sm:p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                type="button"
                id="tab-live-chat"
                onClick={() => setActiveSidebarTab('chat')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
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
                id="tab-live-participants"
                onClick={() => setActiveSidebarTab('participants')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
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
                  {liveUsers.length}/{allRoomUsers.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                {liveUsers.length} Live
              </span>
            </div>
          </div>

          {activeSidebarTab === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-hide">
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                  <AnimatePresence>
                    {allRoomUsers.map((u) => {
                      const isLive = isUserLive(u, presenceTick);
                      return (
                        <motion.button
                          key={u.id}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          onClick={() => setSelectedUser(u)}
                          title={`${u.username} (${isLive ? 'LIVE' : `OFFLINE - ${formatLastSeen(u.lastSeen, presenceTick)}`})`}
                          className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold border-2 transition-all ${
                            u.speaking || speakingUsers[u.uid || u.username] 
                              ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110' 
                              : isLive 
                                ? 'border-emerald-500/40' 
                                : 'border-white/10 opacity-50 grayscale'
                          } ${u.isHost ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-300'}`}
                        >
                          {u.username[0].toUpperCase()}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-2 border-[#0f0f0f] ${
                            isLive ? 'bg-emerald-500' : 'bg-gray-500'
                          }`} />
                          {(u.speaking || speakingUsers[u.uid || u.username]) && isLive && (
                            <motion.div
                              layoutId={`glow-${u.id}`}
                              className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {messages.map((msg, index) => {
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const isSameSender = Boolean(
                    prevMsg && (
                      (msg.userId && prevMsg.userId)
                        ? msg.userId === prevMsg.userId
                        : msg.username === prevMsg.username
                    )
                  );
                  const isSenderHost = Boolean(
                    msg.isHost ||
                    (room?.hostId && msg.userId && msg.userId === room.hostId) ||
                    msg.username === room?.hostName
                  );
                  const theme = getChatMessageTheme(msg.userId || msg.username, isSenderHost);

                  return (
                    <div 
                      key={msg.id || `${msg.timestamp}-${index}`} 
                      className={`flex flex-col ${isSameSender ? 'mt-1' : index === 0 ? 'mt-0' : 'mt-2.5 sm:mt-3'}`}
                    >
                      {!isSameSender && (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className={`text-[10px] sm:text-[11px] font-black ${theme.nameColor}`}>
                            {msg.username}
                          </span>
                          {isSenderHost && (
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}>
                              Host
                            </span>
                          )}
                          <span className="text-[8px] sm:text-[9px] text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <p className={`text-[11px] sm:text-xs p-2.5 sm:p-3 rounded-xl border leading-relaxed break-words shadow-sm transition-colors ${theme.bubbleBg} ${theme.bubbleBorder} ${theme.bubbleText} ${theme.accentBorder} ${
                        isSameSender ? 'rounded-tl-md' : 'rounded-tl-none'
                      }`}>
                        {msg.text}
                      </p>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t border-white/5 bg-white/5">
                <AnimatePresence>
                  {Object.keys(typingUsers).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="text-[9px] sm:text-[10px] text-emerald-500 font-bold mb-1.5 sm:mb-2 flex items-center gap-2"
                    >
                      <div className="flex gap-1">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" />
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                      {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length > 1 ? 'are' : 'is'} typing...
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="relative">
                  <input 
                    id="watchparty-chat-input"
                    type="text" 
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Say something..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 sm:py-3 pl-3.5 sm:pl-4 pr-11 sm:pr-12 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                  <button 
                    id="watchparty-send-btn"
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {/* Presence Overview Pill */}
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-white">Party Presence</p>
                  <p className="text-[10px] text-gray-500">{allRoomUsers.length} total participants</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {liveUsers.length} LIVE
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    {offlineUsers.length} OFFLINE
                  </span>
                </div>
              </div>

              {/* LIVE Participants Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Watching Now ({liveUsers.length})
                  </span>
                </div>

                {liveUsers.length === 0 ? (
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center text-xs text-gray-500">
                    No active viewers detected.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveUsers.map((u) => {
                      const isMe = (user?.uid && u.uid === user.uid) || u.id === effectiveUserId;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className="group p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                                u.isHost ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-200'
                              } ${u.speaking ? 'ring-2 ring-emerald-500 animate-pulse' : ''}`}>
                                {u.username[0].toUpperCase()}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0f0f0f]" />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                                  {u.username}
                                </span>
                                {isMe && (
                                  <span className="text-[9px] text-gray-500 font-bold">(You)</span>
                                )}
                                {u.isHost && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">
                                    Host
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-emerald-400 font-medium">
                                {u.speaking ? 'Speaking now...' : u.mutedByHost ? 'Muted by Host' : 'Watching in sync'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-gray-400 group-hover:text-white transition-colors">
                            {u.mutedByHost ? (
                              <span className="p-1 rounded-md bg-amber-500/10 text-amber-400" title="Muted by host">
                                <VolumeX size={13} />
                              </span>
                            ) : null}
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              LIVE
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* OFFLINE Participants Section */}
              {offlineUsers.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                      Disconnected / Offline ({offlineUsers.length})
                    </span>
                  </div>

                  <div className="space-y-2">
                    {offlineUsers.map((u) => {
                      const isMe = (user?.uid && u.uid === user.uid) || u.id === effectiveUserId;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className="group p-3 bg-white/[0.02] hover:bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer flex items-center justify-between opacity-75 hover:opacity-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-white/5 text-gray-400 grayscale">
                                {u.username[0].toUpperCase()}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-500 border-2 border-[#0f0f0f]" />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">
                                  {u.username}
                                </span>
                                {isMe && (
                                  <span className="text-[9px] text-gray-600 font-bold">(You)</span>
                                )}
                                {u.isHost && (
                                  <span className="px-1.5 py-0.2 rounded bg-white/10 text-gray-400 text-[9px] font-bold uppercase">
                                    Host
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500">
                                Disconnected • {formatLastSeen(u.lastSeen, presenceTick)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 text-gray-500 border border-white/5">
                              Offline
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isHost && (
                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-center">
                  <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                    Tip: Click any participant to view profile, add friend, or use host moderation.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none max-w-[calc(100vw-32px)]">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              layout
              className="pointer-events-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-3 min-w-[280px]"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                <Bell size={16} />
              </div>
              <p className="text-sm font-bold text-white leading-tight">
                {t.message}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Social Participant Card & Host Moderation Modal */}
      <AnimatePresence>
        {selectedUser && (
          <SocialParticipantModal
            user={selectedUser}
            currentUser={userData}
            currentUserId={effectiveUserId}
            isCurrentUserHost={isHost}
            roomId={cleanRoomId}
            isFriend={Boolean(userData?.friends?.includes(selectedUser.uid || ''))}
            onAddFriend={async (target) => {
              if (!user?.uid || !target.uid) {
                showToast("Sign in to add friends");
                return;
              }
              try {
                await updateDoc(doc(db, 'users', user.uid), {
                  friends: arrayUnion(target.uid)
                });
                showToast(`Added ${target.username} as friend!`);
              } catch {
                showToast("Failed to add friend");
              }
            }}
            onRemoveFriend={async (targetUid) => {
              if (!user?.uid) return;
              try {
                const { arrayRemove } = await import('firebase/firestore');
                await updateDoc(doc(db, 'users', user.uid), {
                  friends: arrayRemove(targetUid)
                });
                showToast("Removed from friends");
              } catch {
                showToast("Failed to remove friend");
              }
            }}
            onMentionUser={(name) => {
              setNewMessage(prev => `@${name} ` + prev);
              const input = document.getElementById('watchparty-chat-input');
              if (input) input.focus();
            }}
            onKickUser={async (targetDocId) => {
              try {
                await deleteDoc(doc(db, `watchRooms/${cleanRoomId}/users`, targetDocId));
                showToast("Participant removed from room");
              } catch {
                showToast("Failed to remove participant");
              }
            }}
            onClose={() => setSelectedUser(null)}
            onToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white">Invite Friends</h3>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
                {friends.length > 0 ? (
                  friends.map(friend => (
                    <div key={friend.uid} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-bold">
                          {friend.username[0].toUpperCase()}
                        </div>
                        <span className="font-bold">{friend.username}</span>
                      </div>
                      <button 
                        onClick={() => inviteFriend(friend)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        Invite
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No friends found. Add some friends first!</p>
                    <Link to="/friends" className="text-emerald-500 text-sm font-bold mt-2 inline-block">Go to Friends Page</Link>
                  </div>
                )}
              </div>

              <div className="pt-6 mt-6 border-t border-white/5 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Share Invite Link</p>
                <div className="flex items-center gap-2 p-2 bg-black/40 rounded-2xl border border-white/5">
                  <input 
                    readOnly 
                    value={getRoomShareUrl()}
                    className="flex-1 bg-transparent border-none text-[10px] text-gray-400 px-2 focus:outline-none"
                  />
                  <button 
                    onClick={handleCopyLink}
                    className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
                  >
                    {copied ? <Check size={14} /> : <Share2 size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Movie Modal */}
      <AnimatePresence>
        {isChangeMovieModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChangeMovieModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white">Change Video</h3>
                <button onClick={() => setIsChangeMovieModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {availableMovies.map(m => (
                  <button 
                    key={m.id}
                    onClick={() => changeVideo(m)}
                    className="group relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 hover:border-emerald-500/50 transition-all"
                  >
                    <img src={m.poster} alt={m.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                      <p className="text-[10px] font-black text-white uppercase truncate">{m.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Stream Link Modal */}
      <AnimatePresence>
        {isEditStreamModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditStreamModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[32px] p-6 sm:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <LinkIcon size={18} />
                  </div>
                  <h3 className="text-lg font-black text-white">Edit Stream Link</h3>
                </div>
                <button onClick={() => setIsEditStreamModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleUpdateStreamUrl} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1.5">Direct Stream or Video URL</label>
                  <input
                    type="url"
                    value={editStreamInput}
                    onChange={(e) => setEditStreamInput(e.target.value)}
                    placeholder="https://example.com/video.mp4 or .m3u8"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">Supports direct MP4, WebM, and HLS (.m3u8) live streams.</p>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditStreamModalOpen(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all"
                  >
                    Update Stream
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {isLeaveConfirmationOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeaveConfirmationOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-3xl sm:rounded-[32px] p-6 sm:p-8 shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-500/15 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                <LogOut className="w-7 h-7 sm:w-9 sm:h-9" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-white">Leave Watch Party?</h3>
                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                  Leaving exits your current viewing session. Your room and its stream settings remain saved under <span className="text-emerald-400 font-bold">My Watch Parties</span> on your Home page so you can return anytime.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  id="leave-room-temporarily-btn"
                  onClick={() => confirmLeaveRoom(false)}
                  disabled={isLeavingRoom}
                  className="group relative w-full py-3.5 sm:py-4 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-900/25 flex items-center justify-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-center"
                >
                  {isLeavingRoom ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <div className="flex items-center justify-center gap-2.5 sm:gap-3 w-full">
                      <LogOut className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-white transition-transform duration-200 group-hover:-translate-x-0.5" />
                      <div className="flex flex-col sm:flex-row items-center sm:gap-1.5 leading-tight">
                        <span>Leave Room Temporarily</span>
                        <span className="text-[11px] sm:text-xs text-emerald-100/80 font-normal">
                          (Keep Room Saved)
                        </span>
                      </div>
                    </div>
                  )}
                </button>
                <button 
                  id="end-delete-room-btn"
                  onClick={() => confirmLeaveRoom(true)}
                  disabled={isLeavingRoom}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 hover:text-red-300 font-bold rounded-2xl transition-all border border-red-500/20 text-xs flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> End & Delete Room Permanently
                </button>
                <button 
                  onClick={() => setIsLeaveConfirmationOpen(false)}
                  disabled={isLeavingRoom}
                  className="w-full py-2.5 text-gray-400 font-bold hover:text-white transition-all text-xs disabled:opacity-50"
                >
                  Stay in Party
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
