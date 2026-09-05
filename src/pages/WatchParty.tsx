import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, getDoc, getDocs, collection, addDoc, query, orderBy, limit, increment, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WatchRoom, WatchRoomMessage, WatchRoomUser, WatchRoomReaction, Movie, Episode, Series } from '../types';
import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../services/firestoreError';
import Hls from 'hls.js';
import { Users, Send, Share2, ArrowLeft, Check, User, MessageSquare, Film, Monitor, UserPlus, X, Bell, RefreshCw, Play, Pause, Volume2, VolumeX, Maximize, Minimize, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceChat } from '../components/VoiceChat';
import { ScreenShare } from '../components/ScreenShare';
import { YouTubeSyncPlayer } from '../components/YouTubeSyncPlayer';

// Helper to extract YouTube video ID if URL is YouTube
const getYouTubeVideoId = (url?: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
};

export const WatchParty = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userData, loading: authLoading } = useAuth();
  const cleanRoomId = roomId ? decodeURIComponent(roomId).trim() : '';

  // Persistent Guest ID in session storage if user is not signed in
  const [guestId] = useState<string>(() => {
    const existing = sessionStorage.getItem('synora_guest_uid') || sessionStorage.getItem('streamarena_guest_uid');
    if (existing) return existing;
    const generated = `guest_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('synora_guest_uid', generated);
    return generated;
  });

  const effectiveUserId = user?.uid || guestId;

  const [room, setRoom] = useState<WatchRoom | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const isHost = Boolean(user?.uid && room?.hostId && user.uid === room.hostId);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState(searchParams.get('username') || user?.displayName || userData?.username || '');
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState<WatchRoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [reactions, setReactions] = useState<WatchRoomReaction[]>([]);
  const [liveUsers, setLiveUsers] = useState<WatchRoomUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ [uid: string]: string }>({});
  const [speakingUsers, setSpeakingUsers] = useState<{ [uid: string]: boolean }>({});
  const [selectedUser, setSelectedUser] = useState<WatchRoomUser | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isChangeMovieModalOpen, setIsChangeMovieModalOpen] = useState(false);
  const [isLeaveConfirmationOpen, setIsLeaveConfirmationOpen] = useState(false);
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
  const autoJoinAttemptedRef = useRef(false);

  function showToast(message: string) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

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

  // Join Room Handler
  const handleJoin = useCallback(async (customName?: string) => {
    const finalName = (customName || usernameRef.current || userRef.current?.displayName || 'Guest').trim();
    if (!finalName || !cleanRoomId) return;
    setIsJoining(true);
    try {
      const currentUser = userRef.current;
      const isHostUser = Boolean(currentUser?.uid && roomRef.current?.hostId && currentUser.uid === roomRef.current.hostId);

      const userDocRef = doc(db, `watchRooms/${cleanRoomId}/users`, effectiveUserId);

      await setDoc(userDocRef, {
        username: finalName,
        uid: currentUser?.uid || effectiveUserId,
        isHost: isHostUser,
        joinedAt: new Date().toISOString(),
        speaking: false
      }, { merge: true });

      try {
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          usersCount: increment(1)
        });
      } catch (countErr) {
        console.warn("Users count update non-fatal error:", countErr);
      }

      setUsername(finalName);
      setHasJoined(true);
      if (!currentUser) {
        sessionStorage.setItem('synora_guest_name', finalName);
        if (!searchParams.get('username')) {
          setSearchParams({ username: finalName });
        }
      }
    } catch (error) {
      console.error("Join room error:", error);
      showToast("Failed to join room. Please try again.");
    } finally {
      setIsJoining(false);
    }
  }, [cleanRoomId, effectiveUserId, searchParams, setSearchParams]);

  // Auto-join any user or device visiting the room link so playback begins immediately
  useEffect(() => {
    if (!room || !cleanRoomId || hasJoined || autoJoinAttemptedRef.current || roomLoading || authLoading) return;
    if (room.isActive === false) return;

    autoJoinAttemptedRef.current = true;

    const currentUser = userRef.current;
    let initialName: string;

    if (currentUser) {
      initialName = currentUser.displayName || userDataRef.current?.username || currentUser.email?.split('@')[0] || 'Member';
    } else {
      const urlName = searchParams.get('username');
      const savedGuestName = sessionStorage.getItem('synora_guest_name') || sessionStorage.getItem('streamarena_guest_name');
      if (urlName) {
        initialName = urlName;
      } else if (savedGuestName) {
        initialName = savedGuestName;
      } else {
        initialName = `Guest ${Math.floor(100 + Math.random() * 900)}`;
      }
    }

    handleJoin(initialName);
  }, [room, cleanRoomId, hasJoined, roomLoading, authLoading, searchParams, handleJoin]);

  // Subscribe to Room Document and Subcollections
  useEffect(() => {
    if (!cleanRoomId) {
      setRoomLoading(false);
      setRoomNotFound(true);
      return;
    }

    setRoomLoading(true);
    setRoomNotFound(false);
    setPermissionDenied(false);

    const unsubscribeRoom = onSnapshot(doc(db, 'watchRooms', cleanRoomId), (snapshot) => {
      if (snapshot.exists()) {
        const roomData = { id: snapshot.id, ...snapshot.data() } as WatchRoom;
        setRoom(roomData);
        setRoomNotFound(false);
        setPermissionDenied(false);
        
        // Auto-join if host
        const currentUser = userRef.current;
        if (currentUser && roomData.hostId === currentUser.uid) {
          setHasJoined(true);
          setUsername(prev => prev || currentUser.displayName || 'Host');
        }
      } else {
        setRoom(null);
        setRoomNotFound(true);
      }
      setRoomLoading(false);
    }, (error) => {
      console.error(`Error loading watch room ${cleanRoomId}:`, error);
      if (error.code === 'permission-denied') {
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
      setLiveUsers(users);

      // Persistence check for guests and logged in users
      const currentUser = userRef.current;
      if (currentUser && !hasJoinedRef.current) {
        const me = users.find(u => u.uid === currentUser.uid);
        if (me) {
          setHasJoined(true);
          setUsername(prev => prev || me.username);
        }
      } else if (!currentUser && !hasJoinedRef.current) {
        const me = users.find(u => u.uid === effectiveUserId || u.username === searchParams.get('username'));
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
      setReactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchRoomReaction)));
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
      unsubscribeRoom();
      unsubscribeMessages();
      unsubscribeUsers();
      unsubscribeReactions();
      unsubscribeTyping();
    };
  }, [cleanRoomId, effectiveUserId, searchParams]);

  // Auto-join if user is logged in or has nickname in URL
  useEffect(() => {
    const autoJoin = async () => {
      if (
        !hasJoined && 
        !isJoining && 
        cleanRoomId && 
        room && 
        room.isActive && 
        !roomLoading && 
        !authLoading && 
        !autoJoinAttemptedRef.current
      ) {
        // If user is host:
        if (user && room.hostId === user.uid) {
          autoJoinAttemptedRef.current = true;
          setHasJoined(true);
          return;
        }

        // Check if user is already registered in liveUsers
        if (user && liveUsers.some(u => u.uid === user.uid)) {
          autoJoinAttemptedRef.current = true;
          setHasJoined(true);
          return;
        }

        // If user has a name from URL or profile, auto-join
        const queryName = searchParams.get('username')?.trim();
        const profileName = user?.displayName?.trim() || userData?.username?.trim() || (user?.email ? user.email.split('@')[0] : '');
        const effectiveName = queryName || profileName;

        if (effectiveName) {
          autoJoinAttemptedRef.current = true;
          setHasJoined(true);
          setUsername(effectiveName);
          await handleJoin(effectiveName);
        }
      }
    };

    autoJoin();
  }, [user, userData, hasJoined, isJoining, cleanRoomId, room, roomLoading, authLoading, searchParams, liveUsers, handleJoin]);

  const usernameSetFromProfile = useRef(false);

  useEffect(() => {
    if (user?.displayName && !username && !hasJoined && !usernameSetFromProfile.current) {
      setUsername(user.displayName);
      usernameSetFromProfile.current = true;
    }
  }, [user?.displayName, hasJoined, username]);

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

  // Fetch metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!room) return;
      if (room.movieId && (!movie || movie.id !== room.movieId)) {
        const movieDoc = await getDoc(doc(db, 'movies', room.movieId));
        if (movieDoc.exists()) setMovie({ id: movieDoc.id, ...movieDoc.data() } as Movie);
      } else if (room.seriesId && room.episodeId && (!episode || episode.id !== room.episodeId)) {
        const episodeDoc = await getDoc(doc(db, `series/${room.seriesId}/episodes`, room.episodeId));
        if (episodeDoc.exists()) setEpisode({ id: episodeDoc.id, ...episodeDoc.data() } as Episode);
        const seriesDoc = await getDoc(doc(db, 'series', room.seriesId));
        if (seriesDoc.exists()) setSeries({ id: seriesDoc.id, ...seriesDoc.data() });
      } else if (room.seriesId && !room.episodeId && (!series || series.id !== room.seriesId)) {
        const seriesDoc = await getDoc(doc(db, 'series', room.seriesId));
        if (seriesDoc.exists()) setSeries({ id: seriesDoc.id, ...seriesDoc.data() });
      }
    };

    fetchMetadata();
  }, [room, movie, episode, series]);

  // Authoritative Playback Updater for Host
  const updateRoomPlayback = useCallback(async (playing: boolean, time: number) => {
    const currentRoom = roomRef.current;
    const currentUser = userRef.current;
    if (!cleanRoomId || !currentUser || !currentRoom) return;
    if (currentRoom.hostId !== currentUser.uid || isRemoteSyncRef.current) return;

    // Deduplicate identical updates sent within 800ms
    const now = Date.now();
    const last = lastPublishedPlayback.current;
    if (last.playing === playing && Math.abs(last.time - time) < 0.5 && now - last.timestamp < 800) {
      return;
    }
    lastPublishedPlayback.current = { playing, time, timestamp: now };

    try {
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        playing,
        currentTime: time,
        updatedAt: now
      });
    } catch (error) {
      console.warn("Failed to update room playback:", error);
    }
  }, [cleanRoomId]);

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
              updateRoomPlayback(true, video.currentTime);
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
                  updateRoomPlayback(true, video.currentTime);
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
        updateRoomPlayback(false, video.currentTime);
      }
    }
  }, [isHost, updateRoomPlayback]);

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
    video.currentTime = newTime;
    setVideoCurrentTime(newTime);
    if (isHost) {
      updateRoomPlayback(!video.paused, newTime);
    }
  }, [isHost, updateRoomPlayback]);

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
    const workingTitle = 'Big Buck Bunny (Restored HD)';
    try {
      if (isHost) {
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          videoUrl: workingUrl,
          title: workingTitle,
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
      showToast('Switched to working HD stream.');
    } catch (err) {
      console.error('Error switching stream:', err);
    }
  };

  // Participant HTML5 Video Sync Effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isHost || isScreenSharing || youtubeVideoId) return;

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
  }, [roomPlaying, roomCurrentTime, roomUpdatedAt, isHost, isScreenSharing, youtubeVideoId]);

  // Host auto-start playback if room is marked playing
  useEffect(() => {
    const video = videoRef.current;
    if (!isHost || !video || !room?.playing || isScreenSharing || youtubeVideoId) return;
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
  }, [isHost, room?.playing, isScreenSharing, youtubeVideoId]);

  // Host Periodic Heartbeat Sync (every 4s while playing)
  useEffect(() => {
    if (!isHost || !cleanRoomId || isScreenSharing || youtubeVideoId) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && !isRemoteSyncRef.current && !video.seeking) {
        updateRoomPlayback(true, video.currentTime);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isHost, cleanRoomId, isScreenSharing, youtubeVideoId, updateRoomPlayback]);

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
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

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

  const handleScreenStream = async (stream: MediaStream | null) => {
    setScreenStream(stream);
    if (!cleanRoomId || !user || room?.hostId !== user.uid) return;

    try {
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isScreenSharing: !!stream,
        screenHostId: stream ? user.uid : null
      });
    } catch (error) {
      console.error('Error updating screen share state:', error);
    }
  };

  const inviteFriend = async (friend: User) => {
    if (!roomId || !user) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        toUser: friend.uid,
        fromUser: user.uid,
        fromUsername: user.displayName || 'Someone',
        type: 'invite',
        message: `${user.displayName || 'A friend'} invited you to watch ${room?.title}`,
        roomId,
        read: false,
        time: new Date().toISOString()
      });
      showToast(`Invite sent to ${friend.username}!`);
    } catch (error) {
      console.error('Error sending invite:', error);
    }
  };

  const changeVideo = async (item: Movie | Episode | Series) => {
    if (!roomId || !user || room?.hostId !== user.uid) return;
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
    const hlsUrl = room.videoUrl;
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
        hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.warn("HLS fatal error encountered:", data);
            setVideoLoadError("This stream source is currently offline or unavailable.");
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
      }
    } else {
      if (video.src !== hlsUrl) {
        video.src = hlsUrl;
      }
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [room?.videoUrl, currentIsEmbed, youtubeVideoId]);

  const handleTyping = async () => {
    if (!cleanRoomId || !effectiveUserId) return;
    try {
      await setDoc(doc(db, `watchRooms/${cleanRoomId}/typing`, effectiveUserId), {
        lastTyped: new Date().toISOString(),
        username: username,
        uid: effectiveUserId
      }, { merge: true });
    } catch (e) {
      console.warn("Error updating typing status:", e);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !cleanRoomId) return;
    try {
      await addDoc(collection(db, `watchRooms/${cleanRoomId}/messages`), {
        text: newMessage,
        username,
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

  const sendReaction = async (emoji: string) => {
    if (!cleanRoomId) return;
    try {
      await addDoc(collection(db, `watchRooms/${cleanRoomId}/reactions`), {
        emoji,
        username,
        time: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'send_reaction');
    }
  };

  const handleCopyLink = async () => {
    if (!cleanRoomId) return;
    const shareUrl = `${window.location.origin}/watchparty/${cleanRoomId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: room?.title ? `Watch ${room.title} on Synora` : 'Join my Synora Watch Party',
          text: `Watch ${room?.title || 'videos'} together in real-time on Synora!`,
          url: shareUrl,
        });
        showToast('Link shared successfully!');
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
    showToast('Room link copied to clipboard!');
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
        if (effectiveUserId) {
          await deleteDoc(doc(db, `watchRooms/${cleanRoomId}/users`, effectiveUserId));
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

  const confirmLeaveRoom = async (endParty: boolean) => {
    if (!cleanRoomId) return;
    try {
      if (isHost && endParty) {
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          isActive: false
        });
      }
      
      if (effectiveUserId) {
        await deleteDoc(doc(db, `watchRooms/${cleanRoomId}/users`, effectiveUserId)).catch(() => {});
        await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          usersCount: increment(-1)
        }).catch(() => {});
      }
      
      navigate('/');
    } catch (error) {
      console.warn('Error leaving room:', error);
      navigate('/');
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 space-y-6">
        <div className="w-20 h-20 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center">
          <X size={40} />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-3xl font-black">Access Restricted</h2>
          <p className="text-gray-400">You don't have permission to access this watch party. Please sign in or check the invite link.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all border border-white/10">
            Back to Home
          </Link>
          <Link to={`/login?redirect=/watchparty/${cleanRoomId}`} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-900/20">
            Sign In
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
          <p className="text-gray-400">The host has ended this watch party session.</p>
        </div>
        <Link to="/" className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-900/20">
          Browse Other Rooms
        </Link>
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
            <h2 className="text-2xl font-black text-white">Joining Watch Party</h2>
            <p className="text-gray-400 text-sm">Connecting you to <span className="text-white font-bold">{room.title}</span>...</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your nickname..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            <button 
              onClick={() => handleJoin()}
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
                  to={`/login?redirect=/watchparty/${cleanRoomId}`}
                  className="text-xs font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400"
                >
                  Sign in with Google
                </Link>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-white/5 space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Share this room</p>
            <div className="flex items-center gap-2 p-2 bg-black/40 rounded-2xl border border-white/5">
              <input 
                readOnly 
                value={window.location.origin + `/watchparty/${cleanRoomId}`}
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

  const encodeUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.includes(' ') && !finalUrlIncludes(url)) {
      return encodeURI(url);
    }
    return url;
  };

  function finalUrlIncludes(url: string) {
    return url.includes('%20');
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
              <h1 className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[250px] md:max-w-md">{room.title}</h1>
              <div className="flex items-center gap-2 text-[9px] text-gray-500 uppercase tracking-widest font-black">
                <span className="flex items-center gap-1"><Users size={10} /> {liveUsers.length}</span>
                <span>•</span>
                <span className={room.playing ? 'text-emerald-500' : 'text-yellow-500'}>{room.playing ? 'Playing' : 'Paused'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex md:hidden items-center gap-2">
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
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <VoiceChat 
              roomId={cleanRoomId} 
              userId={effectiveUserId}
              username={username} 
              muted={muted}
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
                isScreenSharingActive={Boolean(room.isScreenSharing)}
                hostId={room.screenHostId || room.hostId}
                onStreamReady={handleScreenStream} 
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
            {room.isScreenSharing ? (
              <div className="w-full h-full relative flex items-center justify-center bg-black">
                {screenStream ? (
                  <video
                    ref={(node) => {
                      screenVideoRef.current = node;
                      if (node && screenStream && node.srcObject !== screenStream) {
                        node.srcObject = screenStream;
                        node.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : isHost ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Monitor size={28} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Screen Share Mode Active</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm">Click "Share Screen" in the bar above to choose your tab, app window, or entire monitor.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-emerald-400 flex items-center justify-center animate-pulse">
                      <Monitor size={28} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Connecting to Host Screen Share...</h3>
                      <p className="text-xs text-gray-400 mt-1">Establishing real-time WebRTC video connection</p>
                    </div>
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
                roomPlaying={Boolean(room.playing)}
                roomCurrentTime={room.currentTime || 0}
                roomUpdatedAt={room.updatedAt || 0}
                playing={Boolean(room.playing)}
                currentTime={room.currentTime || 0}
                updatedAt={room.updatedAt || 0}
                onPlaybackChange={updateRoomPlayback}
                onHostPlaybackChange={updateRoomPlayback}
                onSyncReady={(syncFn) => { ytSyncFnRef.current = syncFn; }}
                isRemoteSyncRef={isRemoteSyncRef}
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
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setVideoCurrentTime(videoRef.current.currentTime);
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
                      updateRoomPlayback(true, videoRef.current.currentTime);
                    }
                  }}
                  onPause={() => {
                    setIsVideoPlaying(false);
                    if (isHost && !isRemoteSyncRef.current && videoRef.current && !videoRef.current.seeking) {
                      updateRoomPlayback(false, videoRef.current.currentTime);
                    }
                  }}
                  onSeeked={() => {
                    if (isHost && !isRemoteSyncRef.current && videoRef.current) {
                      updateRoomPlayback(!videoRef.current.paused, videoRef.current.currentTime);
                    }
                  }}
                  onError={() => {
                    const video = videoRef.current;
                    if (!video || !room?.videoUrl) return;
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

                {/* Big Center Play/Pause Button when paused */}
                {!isVideoPlaying && !videoLoadError && (
                  <div 
                    onClick={toggleVideoPlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all cursor-pointer z-10"
                  >
                    <div className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/50 hover:scale-110 active:scale-95 transition-all">
                      <Play size={36} className="ml-1 fill-white" />
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
                        onClick={handleSwitchToWorkingSample}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all"
                      >
                        <Film size={14} /> Switch to Working Film (HD)
                      </button>
                      {isHost && (
                        <button
                          onClick={() => setIsChangeMovieModalOpen(true)}
                          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold border border-white/10 transition-all"
                        >
                          Change Video Source
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
                      onChange={(e) => handleSeekVideo(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-white/20 hover:h-2 rounded-lg appearance-none cursor-pointer accent-emerald-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 text-white text-xs">
                    {/* Left Controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={toggleVideoPlay}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
                        title={isVideoPlaying ? "Pause" : "Play"}
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
                          onClick={() => {
                            if (videoRef.current && room?.currentTime !== undefined) {
                              handleSeekVideo(room.currentTime);
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                          title="Align video to host position"
                        >
                          <RefreshCw size={12} /> Sync with Host
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
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <AnimatePresence>
                {reactions.map((reaction) => (
                  <motion.div
                    key={reaction.id}
                    initial={{ y: '100%', x: getXPos(reaction.id), opacity: 0, scale: 0.5 }}
                    animate={{ y: '-20%', opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1.5, 1] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 3, ease: "easeOut" }}
                    className="absolute bottom-0 text-4xl"
                  >
                    {reaction.emoji}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {!isHost && !currentIsEmbed && (
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  {room.playing ? 'In Sync (Playing)' : 'In Sync (Paused)'}
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
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {liveUsers.length} online
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

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 lg:bg-transparent p-4 lg:p-0 rounded-2xl border border-white/5 lg:border-0">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-white">{room.title}</h2>
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
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/30 shadow-sm"
                    title="Recalculate and Align with Host"
                  >
                    <RefreshCw size={12} className="animate-spin-once" />
                    Sync with Host
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-sm">Hosted by <span className="text-emerald-500 font-bold">{room.hostName}</span></p>
            </div>
            
            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/5">
              {['👍', '😂', '🔥', '❤️', '👀'].map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-90 text-xl"
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
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-emerald-500" />
              <h3 className="font-bold text-sm">Live Chat</h3>
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{liveUsers.length} Online</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            <div className="flex flex-wrap gap-2 mb-4">
              <AnimatePresence>
                {liveUsers.map((u) => (
                  <motion.button
                    key={u.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => setSelectedUser(u)}
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                      u.speaking || speakingUsers[u.uid || u.username] 
                        ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110' 
                        : 'border-white/10'
                    } ${u.isHost ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-400'}`}
                  >
                    {u.username[0].toUpperCase()}
                    {(u.speaking || speakingUsers[u.uid || u.username]) && (
                      <motion.div
                        layoutId={`glow-${u.id}`}
                        className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"
                      />
                    )}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>

            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-black ${msg.username === room.hostName ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {msg.username}
                  </span>
                  <span className="text-[9px] text-gray-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-sm text-gray-200 bg-white/5 p-2.5 rounded-xl rounded-tl-none border border-white/5">
                  {msg.text}
                </p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-white/5 bg-white/5">
            <AnimatePresence>
              {Object.keys(typingUsers).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-[10px] text-emerald-500 font-bold mb-2 flex items-center gap-2"
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
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
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

      {/* User Avatar Popup */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 w-full max-w-xs text-center space-y-4 shadow-2xl"
            >
              <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-3xl font-black ${selectedUser.isHost ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                {selectedUser.username[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-black text-white">{selectedUser.username}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-1">
                  {selectedUser.isHost ? 'Room Host' : 'Participant'}
                </p>
              </div>
              <div className="pt-4 flex flex-col gap-2">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-black">Joined {new Date(selectedUser.joinedAt).toLocaleTimeString()}</p>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
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
              className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 shadow-2xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <X size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">End Watch Party?</h3>
                <p className="text-gray-400">As the host, leaving will end the session for everyone. Are you sure?</p>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={() => confirmLeaveRoom(true)}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-900/20"
                >
                  End Party for Everyone
                </button>
                <button 
                  onClick={() => confirmLeaveRoom(false)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
                >
                  Just Leave (Keep Active)
                </button>
                <button 
                  onClick={() => setIsLeaveConfirmationOpen(false)}
                  className="w-full py-4 text-gray-500 font-bold hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
