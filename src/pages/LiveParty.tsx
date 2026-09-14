import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  setDoc,
  deleteDoc,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { WatchRoom, WatchRoomMessage, WatchRoomUser, WatchRoomReaction } from '../types';
import { useAuth } from '../hooks/useAuth';
import { getIceServers } from '../services/webrtcConfig';
import { isUserLive, sendHeartbeat, markUserOffline, HEARTBEAT_INTERVAL_MS } from '../services/presenceService';
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
  SwitchCamera,
  Mic,
  MicOff,
  Square,
  AlertCircle,
  Volume2,
  VolumeX,
  Maximize,
  RefreshCw,
  Eye,
  LogOut,
  Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LiveParty: React.FC = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, userData } = useAuth();
  const cleanRoomId = roomId ? decodeURIComponent(roomId).trim() : '';

  // Extract navigation state if navigated from WatchPartyModal creation
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

  const isLocallyRecordedHost = useMemo(() => {
    if (!cleanRoomId) return false;
    if (sessionStorage.getItem(`synora_host_${cleanRoomId}`) === 'true') return true;
    try {
      const saved = JSON.parse(localStorage.getItem('synora_created_rooms') || '[]');
      return saved.some((r: { id: string }) => r.id === cleanRoomId);
    } catch {
      return false;
    }
  }, [cleanRoomId]);

  const effectiveUserId = user?.uid || auth.currentUser?.uid || guestId;
  const initialUsername = searchParams.get('username') || user?.displayName || auth.currentUser?.displayName || userData?.username || '';
  const [username, setUsername] = useState(initialUsername || (isHostCreation || isLocallyRecordedHost ? 'Host' : 'Guest'));
  const [hasJoined, setHasJoined] = useState(() => Boolean(isHostCreation || isLocallyRecordedHost || initialUsername || user || auth.currentUser));
  const [isJoining, setIsJoining] = useState(false);

  // Room state
  const [room, setRoom] = useState<WatchRoom | null>(() => initialRoomFromState);
  const [roomLoading, setRoomLoading] = useState(() => !initialRoomFromState);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);

  // Presence & users
  const [roomUsers, setRoomUsers] = useState<WatchRoomUser[]>([]);
  const [presenceTick, setPresenceTick] = useState(Date.now());
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  // Chat & Reactions
  const [messages, setMessages] = useState<WatchRoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [reactions, setReactions] = useState<WatchRoomReaction[]>([]);
  const [showChat, setShowChat] = useState(true);

  // Media & WebRTC state
  const currentAuthUid = user?.uid || auth.currentUser?.uid;
  const isHost = Boolean(
    isHostCreation ||
    isLocallyRecordedHost ||
    (currentAuthUid && room && (currentAuthUid === room.hostId || currentAuthUid === room.ownerId)) ||
    (effectiveUserId && room && (effectiveUserId === room.hostId || effectiveUserId === room.ownerId)) ||
    (room && !room.hostId)
  );

  useEffect(() => {
    if (isHost && !hasJoined) {
      setHasJoined(true);
    }
  }, [isHost, hasJoined]);

  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [cameraSwitchAvailable, setCameraSwitchAvailable] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isViewerConnected, setIsViewerConnected] = useState(false);
  const [viewerMuted, setViewerMuted] = useState(false);
  const [isViewerRequesting, setIsViewerRequesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reactive video streams for guaranteed DOM attachment
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Video element refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // WebRTC tracking
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});
  const processedSignals = useRef<Set<string>>(new Set());
  const offerTimestamps = useRef<{ [peerId: string]: number }>({});
  const lastRequestTimeRef = useRef<number>(0);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Tick for presence updates
  useEffect(() => {
    const timer = setInterval(() => setPresenceTick(Date.now()), 3000);
    return () => clearInterval(timer);
  }, []);

  // Check camera switch capability
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      setCameraSwitchAvailable(false);
      return;
    }
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      // On mobile devices, even if only 1 device is listed before permissions, facingMode switching works.
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setCameraSwitchAvailable(videoInputs.length > 1 || isMobile);
    }).catch(() => {
      setCameraSwitchAvailable(true);
    });
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

  // 3. Heartbeat for joined user
  useEffect(() => {
    if (!cleanRoomId || !effectiveUserId || !hasJoined) return;

    const displayName = username.trim() || user?.displayName || 'Viewer';
    const userDocRef = doc(db, `watchRooms/${cleanRoomId}/users`, effectiveUserId);

    // Initial presence write
    setDoc(userDocRef, {
      username: displayName,
      uid: user?.uid || null,
      isHost: Boolean(isHost),
      joinedAt: new Date().toISOString(),
      lastSeen: Date.now(),
      connectionStatus: 'online',
      status: 'watching'
    }, { merge: true }).catch(err => {
      console.debug('Initial presence set note:', err);
    });

    const interval = setInterval(() => {
      sendHeartbeat(cleanRoomId, effectiveUserId);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      markUserOffline(cleanRoomId, effectiveUserId);
    };
  }, [cleanRoomId, effectiveUserId, hasJoined, username, user, isHost]);

  // 4. Subscribe to Messages
  useEffect(() => {
    if (!cleanRoomId) return;

    const q = query(
      collection(db, `watchRooms/${cleanRoomId}/messages`),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: WatchRoomMessage[] = [];
      snapshot.forEach(docSnap => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as WatchRoomMessage);
      });
      setMessages(msgs);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    });

    return () => unsubscribe();
  }, [cleanRoomId]);

  // 5. Subscribe to Reactions
  useEffect(() => {
    if (!cleanRoomId) return;

    const q = query(
      collection(db, `watchRooms/${cleanRoomId}/reactions`),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rxns: WatchRoomReaction[] = [];
      snapshot.forEach(docSnap => {
        rxns.push({ id: docSnap.id, ...docSnap.data() } as WatchRoomReaction);
      });
      setReactions(rxns);
    });

    return () => unsubscribe();
  }, [cleanRoomId]);

  // Clean up all media and WebRTC connections
  const cleanupWebRTC = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      localStreamRef.current = null;
    }
    Object.keys(peerConnections.current).forEach(peerId => {
      try {
        peerConnections.current[peerId].close();
      } catch {
        // ignore
      }
    });
    peerConnections.current = {};
    pendingCandidates.current = {};
    remoteStreamRef.current = null;
    offerTimestamps.current = {};
    setLocalStream(null);
    setRemoteStream(null);
    setIsMediaReady(false);
    setIsViewerConnected(false);
  }, []);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => cleanupWebRTC();
  }, [cleanupWebRTC]);

  // Drain pending candidates helper - runs whenever remote description is set
  const drainPendingCandidates = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidates.current[peerId];
    if (queue && queue.length > 0 && pc.remoteDescription) {
      const candidatesToProcess = [...queue];
      delete pendingCandidates.current[peerId];
      candidatesToProcess.forEach(candidate => {
        try {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
            console.warn('[LiveParty] Non-fatal ICE candidate error:', err);
          });
        } catch (e) {
          console.warn('[LiveParty] Error processing queued candidate:', e);
        }
      });
    }
  }, []);

  // Create PeerConnection
  const getOrCreatePeerConnection = useCallback((targetPeerId: string, asHost: boolean) => {
    if (peerConnections.current[targetPeerId]) {
      return peerConnections.current[targetPeerId];
    }

    const pc = new RTCPeerConnection(getIceServers());
    peerConnections.current[targetPeerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && cleanRoomId) {
        addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: effectiveUserId,
          to: targetPeerId,
          type: 'live-candidate',
          signal: JSON.stringify(event.candidate.toJSON ? event.candidate.toJSON() : event.candidate),
          time: new Date().toISOString(),
        }).catch((err) => {
          console.warn('[LiveParty] Failed to send ICE candidate:', err);
        });
      }
    };

    pc.onsignalingstatechange = () => {
      if (pc.remoteDescription) {
        drainPendingCandidates(targetPeerId, pc);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[LiveParty] Peer connection ${targetPeerId} state:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (!asHost) {
          setIsViewerConnected(true);
        }
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        try {
          pc.close();
        } catch {
          // ignore
        }
        delete peerConnections.current[targetPeerId];
        delete pendingCandidates.current[targetPeerId];
        delete offerTimestamps.current[targetPeerId];
        if (!asHost) {
          setIsViewerConnected(false);
        }
      }
    };

    if (asHost) {
      // Broadcaster: attach tracks from localStreamRef
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            try {
              pc.addTrack(track, localStreamRef.current!);
            } catch (err) {
              console.warn('[LiveParty] Non-fatal addTrack error:', err);
            }
          }
        });
      }
    } else {
      // Viewer: attach receiver transceivers
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch {
        // Fallback for browsers auto-configuring transceivers
      }

      pc.ontrack = (event) => {
        console.log(`[LiveParty] Viewer received remote track (${event.track.kind}):`, event.track.id);
        const incomingStream = event.streams && event.streams[0] ? event.streams[0] : null;
        let stream = remoteStreamRef.current;
        if (incomingStream) {
          remoteStreamRef.current = incomingStream;
          setRemoteStream(incomingStream);
        } else {
          if (!stream) {
            stream = new MediaStream();
            remoteStreamRef.current = stream;
          }
          if (!stream.getTracks().some(t => t.id === event.track.id)) {
            stream.addTrack(event.track);
          }
          setRemoteStream(new MediaStream(stream.getTracks()));
        }

        setIsViewerConnected(true);

        const currentTargetStream = remoteStreamRef.current;
        if (remoteVideoRef.current && currentTargetStream) {
          if (remoteVideoRef.current.srcObject !== currentTargetStream) {
            remoteVideoRef.current.srcObject = currentTargetStream;
          }
          remoteVideoRef.current.play().catch(playErr => {
            console.warn('[LiveParty] Remote video play note (autoplay policy):', playErr);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = true;
              setViewerMuted(true);
              remoteVideoRef.current.play().catch(() => {});
            }
          });
        }

        event.track.onended = () => {
          console.log(`[LiveParty] Remote track ended: ${event.track.kind}`);
          const liveTracks = remoteStreamRef.current ? remoteStreamRef.current.getTracks().filter(t => t.readyState === 'live') : [];
          if (liveTracks.length === 0) {
            setIsViewerConnected(false);
          }
        };
      };
    }

    return pc;
  }, [cleanRoomId, effectiveUserId, drainPendingCandidates]);

  // Initiate WebRTC offer from host to a specific viewer peer
  const initiateOfferToPeer = useCallback(async (targetPeerId: string) => {
    if (!localStreamRef.current) {
      console.log(`[LiveParty] Cannot initiate offer to ${targetPeerId}: localStream is not ready yet`);
      return;
    }

    const existingPc = peerConnections.current[targetPeerId];
    const lastOfferTime = offerTimestamps.current[targetPeerId] || 0;
    const timeSinceLastOffer = Date.now() - lastOfferTime;

    // If connection is already connected and active, skip
    if (existingPc && existingPc.connectionState === 'connected') {
      return;
    }

    // Debounce rapid duplicate offers (2.5s) unless connection failed
    if (existingPc && timeSinceLastOffer < 2500 && existingPc.connectionState !== 'failed') {
      return;
    }

    if (existingPc) {
      try {
        existingPc.close();
      } catch {
        // ignore
      }
      delete peerConnections.current[targetPeerId];
    }

    console.log(`[LiveParty] Creating and sending live-offer to ${targetPeerId}`);
    const pc = getOrCreatePeerConnection(targetPeerId, true);
    offerTimestamps.current[targetPeerId] = Date.now();

    try {
      const offer = await pc.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      });
      await pc.setLocalDescription(offer);

      await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
        from: effectiveUserId,
        to: targetPeerId,
        type: 'live-offer',
        signal: JSON.stringify(offer),
        time: new Date().toISOString()
      });
    } catch (err) {
      console.error(`[LiveParty] Failed to create or send offer to ${targetPeerId}:`, err);
    }
  }, [cleanRoomId, effectiveUserId, getOrCreatePeerConnection]);

  // ==========================================
  // BROADCASTER: Start Camera & Microphone
  // ==========================================
  const startCameraBroadcast = useCallback(async (desiredFacingMode: 'user' | 'environment' = 'user') => {
    setPermissionError(null);
    try {
      // 1. Request camera and microphone with robust fallback tiers
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: desiredFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });
      } catch (err1) {
        console.warn('Initial camera constraints failed, attempting basic video + audio:', err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
        } catch (err2) {
          console.warn('Video + audio failed, attempting video only fallback:', err2);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode(desiredFacingMode);
      setIsMediaReady(true);
      setIsMuted(!stream.getAudioTracks().some(t => t.enabled));
      setPermissionError(null);

      // Immediately bind to local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // prevent acoustic feedback for broadcaster
        localVideoRef.current.playsInline = true;
        localVideoRef.current.play().catch(e => console.debug('Local play note:', e));
      }

      // Add or replace tracks for all existing peer connections
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      for (const peerId of Object.keys(peerConnections.current)) {
        const pc = peerConnections.current[peerId];
        if (pc) {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio');

          if (videoTrack) {
            if (videoSender) {
              videoSender.replaceTrack(videoTrack).catch(() => {});
            } else {
              try {
                pc.addTrack(videoTrack, stream);
              } catch (e) {
                console.debug('[LiveParty] addTrack video error:', e);
              }
            }
          }
          if (audioTrack) {
            if (audioSender) {
              audioSender.replaceTrack(audioTrack).catch(() => {});
            } else {
              try {
                pc.addTrack(audioTrack, stream);
              } catch (e) {
                console.debug('[LiveParty] addTrack audio error:', e);
              }
            }
          }
        }
      }

      // 2. Ensure room state indicates active live streaming
      if (cleanRoomId) {
        updateDoc(doc(db, 'watchRooms', cleanRoomId), {
          isLiveStreaming: true,
          isActive: true
        }).catch(err => {
          console.debug('Room live status update note:', err);
        });
      }
    } catch (err: unknown) {
      console.error('[LiveParty] Failed to acquire camera/mic:', err);
      const errorObj = err as { name?: string; message?: string };
      if (errorObj.name === 'NotAllowedError' || errorObj.name === 'PermissionDeniedError') {
        setPermissionError('Camera access was denied. Please allow camera and microphone permissions in your browser to start broadcasting.');
      } else if (errorObj.name === 'NotFoundError' || errorObj.name === 'DevicesNotFoundError') {
        setPermissionError('No camera found on your device.');
      } else if (errorObj.name === 'NotReadableError' || errorObj.name === 'TrackStartError') {
        setPermissionError('Camera is currently in use by another application.');
      } else {
        setPermissionError('Could not start camera. Please check browser permissions and try again.');
      }
    }
  }, [cleanRoomId]);

  // Auto-start camera if host
  useEffect(() => {
    if (isHost && !isMediaReady && !permissionError && !streamEnded) {
      startCameraBroadcast(facingMode);
    }
  }, [isHost, isMediaReady, permissionError, streamEnded, startCameraBroadcast, facingMode]);

  // Synchronize local video element whenever localStream or DOM element changes
  useEffect(() => {
    const video = localVideoRef.current;
    if (video && localStream) {
      if (video.srcObject !== localStream) {
        video.srcObject = localStream;
      }
      video.muted = true;
      video.playsInline = true;
      video.play().catch(e => console.debug('Local video play note:', e));
    }
  }, [localStream]);

  // Synchronize remote video element whenever remoteStream or viewerMuted changes
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (video && remoteStream) {
      if (video.srcObject !== remoteStream) {
        video.srcObject = remoteStream;
      }
      video.muted = viewerMuted;
      video.playsInline = true;
      video.play().catch(err => {
        console.warn('Autoplay with audio blocked, falling back to muted autoplay:', err);
        video.muted = true;
        setViewerMuted(true);
        video.play().catch(() => {});
      });
    }
  }, [remoteStream, viewerMuted]);

  // Whenever localStream becomes active on the host, automatically offer to active viewers
  useEffect(() => {
    if (!isHost || !localStream) return;

    const otherParticipants = roomUsers.filter(u => {
      const pId = u.uid || u.id;
      return pId && pId !== effectiveUserId;
    });

    otherParticipants.forEach(p => {
      const peerId = p.uid || p.id;
      if (peerId) {
        initiateOfferToPeer(peerId);
      }
    });
  }, [isHost, localStream, roomUsers, effectiveUserId, initiateOfferToPeer]);

  // ==========================================
  // BROADCASTER: Switch Camera (Front ↔ Rear)
  // ==========================================
  const handleToggleCamera = async () => {
    if (!isHost || isSwitchingCamera || !localStreamRef.current) return;

    setIsSwitchingCamera(true);
    const nextFacingMode: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user';

    try {
      // 1. Stop old camera tracks (Mobile requirement: stop old tracks when switching)
      const oldVideoTracks = localStreamRef.current.getVideoTracks();
      oldVideoTracks.forEach(track => {
        try {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        } catch {
          // ignore
        }
      });

      // 2. Request new video stream with new facingMode
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacingMode } },
          audio: false
        });
      } catch {
        // Fallback for browsers/desktops without exact facingMode constraint
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacingMode },
          audio: false
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack && localStreamRef.current) {
        localStreamRef.current.addTrack(newVideoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        // 3. Update track in local video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // 4. Seamlessly replace video track on all connected peers using RTCRtpSender.replaceTrack
        for (const peerId of Object.keys(peerConnections.current)) {
          const pc = peerConnections.current[peerId];
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            try {
              await sender.replaceTrack(newVideoTrack);
              console.log(`[LiveParty] Replaced video track for peer ${peerId}`);
            } catch (replaceErr) {
              console.warn(`[LiveParty] Failed to replaceTrack for ${peerId}:`, replaceErr);
            }
          }
        }

        setFacingMode(nextFacingMode);
        showToast(`Switched to ${nextFacingMode === 'environment' ? 'Rear' : 'Front'} Camera`);
      }
    } catch (switchErr) {
      console.warn('[LiveParty] Camera switch error:', switchErr);
      showToast('Camera switch is not supported on this device');
      // Re-acquire default camera if switch failed
      startCameraBroadcast('user');
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  // ==========================================
  // BROADCASTER: Mute / Unmute Microphone
  // ==========================================
  const handleToggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    const willBeMuted = !isMuted;
    audioTracks.forEach(track => {
      track.enabled = !willBeMuted;
    });
    setIsMuted(willBeMuted);
    showToast(willBeMuted ? 'Microphone Muted' : 'Microphone Active');
  };

  // ==========================================
  // BROADCASTER: Stop the Live Party
  // ==========================================
  const handleStopLive = async () => {
    if (!window.confirm('Are you sure you want to end this Live Party?')) return;

    // 1. Notify viewers via signal
    if (cleanRoomId) {
      addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
        from: effectiveUserId,
        to: 'all',
        type: 'live-ended',
        time: new Date().toISOString()
      }).catch(() => {});

      // 2. Mark room inactive in Firestore
      updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isActive: false,
        isLiveStreaming: false
      }).catch(err => {
        console.debug('Error ending live party doc:', err);
      });
    }

    // 3. Clean up all tracks and connections
    cleanupWebRTC();
    setStreamEnded(true);
    showToast('Live Party ended');
  };

  // ==========================================
  // WEBRTC SIGNALING LISTENER
  // ==========================================
  useEffect(() => {
    if (!cleanRoomId || !effectiveUserId || !hasJoined) return;

    const targetList = [effectiveUserId, username, 'all'];
    if (user?.uid) targetList.push(user.uid);
    if (isHost) {
      targetList.push('host');
      if (room?.hostId) targetList.push(room.hostId);
      if (room?.ownerId) targetList.push(room.ownerId);
    }
    const cleanTargetList = Array.from(new Set(targetList)).filter(Boolean);

    const q = cleanTargetList.length > 1
      ? query(collection(db, `watchRooms/${cleanRoomId}/signals`), where('to', 'in', cleanTargetList.slice(0, 10)))
      : query(collection(db, `watchRooms/${cleanRoomId}/signals`), where('to', '==', effectiveUserId));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const docId = change.doc.id;
          const data = change.doc.data();

          if (!data.type || !data.type.startsWith('live-')) continue;

          if (processedSignals.current.has(docId)) continue;
          processedSignals.current.add(docId);
          if (processedSignals.current.size > 300) {
            const staleKeys = Array.from(processedSignals.current).slice(0, 100);
            staleKeys.forEach(k => processedSignals.current.delete(k));
          }

          const fromPeer = data.from;
          // NEVER process or delete if sent by self
          if (!fromPeer || fromPeer === effectiveUserId) {
            continue;
          }

          try {
            if (data.type === 'live-ended') {
              console.log('[LiveParty] Received live-ended notification');
              setStreamEnded(true);
              cleanupWebRTC();
              deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
              return;
            }

            // --- HOST HANDLING ---
            if (isHost) {
              if (data.type === 'live-request') {
                console.log(`[LiveParty] Host received live-request from ${fromPeer}`);
                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                if (localStreamRef.current) {
                  await initiateOfferToPeer(fromPeer);
                }
              } else if (data.type === 'live-answer') {
                console.log(`[LiveParty] Host received live-answer from ${fromPeer}`);
                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                const pc = peerConnections.current[fromPeer];
                if (pc && pc.signalingState === 'have-local-offer') {
                  const answerDesc = new RTCSessionDescription(JSON.parse(data.signal));
                  await pc.setRemoteDescription(answerDesc);
                  drainPendingCandidates(fromPeer, pc);
                }
              } else if (data.type === 'live-candidate') {
                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                const candidate = JSON.parse(data.signal);
                if (candidate && candidate.candidate) {
                  const pc = peerConnections.current[fromPeer];
                  if (pc && pc.remoteDescription) {
                    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
                  } else {
                    if (!pendingCandidates.current[fromPeer]) {
                      pendingCandidates.current[fromPeer] = [];
                    }
                    pendingCandidates.current[fromPeer].push(candidate);
                  }
                }
              }
            }

            // --- VIEWER HANDLING ---
            if (!isHost) {
              if (data.type === 'live-offer') {
                console.log(`[LiveParty] Viewer received live-offer from ${fromPeer}`);
                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                let pc = peerConnections.current[fromPeer];

                if (pc && pc.signalingState !== 'stable') {
                  try {
                    pc.close();
                  } catch {
                    // ignore
                  }
                  delete peerConnections.current[fromPeer];
                  pc = undefined;
                }

                if (!pc) {
                  pc = getOrCreatePeerConnection(fromPeer, false);
                }

                const offerDesc = new RTCSessionDescription(JSON.parse(data.signal));
                await pc.setRemoteDescription(offerDesc);
                drainPendingCandidates(fromPeer, pc);

                const answer = await pc.createAnswer({
                  offerToReceiveVideo: true,
                  offerToReceiveAudio: true
                });
                await pc.setLocalDescription(answer);

                await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                  from: effectiveUserId,
                  to: fromPeer,
                  type: 'live-answer',
                  signal: JSON.stringify(answer),
                  time: new Date().toISOString()
                });
              } else if (data.type === 'live-candidate') {
                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                const candidate = JSON.parse(data.signal);
                if (candidate && candidate.candidate) {
                  const pc = peerConnections.current[fromPeer];
                  if (pc && pc.remoteDescription) {
                    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
                  } else {
                    if (!pendingCandidates.current[fromPeer]) {
                      pendingCandidates.current[fromPeer] = [];
                    }
                    pendingCandidates.current[fromPeer].push(candidate);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[LiveParty] Error handling signal:', err);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [cleanRoomId, effectiveUserId, username, isHost, user?.uid, room?.hostId, room?.ownerId, hasJoined, getOrCreatePeerConnection, initiateOfferToPeer, drainPendingCandidates, cleanupWebRTC]);

  // ==========================================
  // VIEWER: Polling live-request until connected
  // ==========================================
  useEffect(() => {
    if (isHost || !cleanRoomId || !hasJoined || streamEnded) return;

    const hostTargetId = room?.hostId || room?.ownerId || 'host';

    const sendRequest = () => {
      // If already connected with active video tracks, no need to poll
      const hasLiveVideoTrack = remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().some(t => t.readyState === 'live');
      if (isViewerConnected && hasLiveVideoTrack) return;

      const now = Date.now();
      if (now - lastRequestTimeRef.current < 2500) return;
      lastRequestTimeRef.current = now;

      console.log(`[LiveParty] Viewer requesting stream from host: ${hostTargetId}`);
      addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
        from: effectiveUserId,
        to: hostTargetId,
        type: 'live-request',
        time: new Date().toISOString()
      }).catch(err => {
        console.debug('Failed to send live-request signal:', err);
      });

      if (hostTargetId !== 'host') {
        addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: effectiveUserId,
          to: 'host',
          type: 'live-request',
          time: new Date().toISOString()
        }).catch(() => {});
      }
    };

    sendRequest();
    const interval = setInterval(sendRequest, 3500);
    return () => clearInterval(interval);
  }, [isHost, cleanRoomId, hasJoined, streamEnded, isViewerConnected, room?.hostId, room?.ownerId, effectiveUserId]);

  // Viewer manual stream re-request handler
  const handleViewerReconnect = useCallback(() => {
    if (isHost || !cleanRoomId) return;
    const hostTargetId = room?.hostId || room?.ownerId || 'host';
    setIsViewerRequesting(true);
    showToast('Re-requesting live camera stream...');

    // Close stale peer connections for a clean re-handshake
    Object.keys(peerConnections.current).forEach(peerId => {
      try {
        peerConnections.current[peerId].close();
      } catch (e) {
        console.debug('[LiveParty] close peer error:', e);
      }
    });
    peerConnections.current = {};
    pendingCandidates.current = {};

    addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
      from: effectiveUserId,
      to: hostTargetId,
      type: 'live-request',
      time: new Date().toISOString()
    }).catch(() => {});

    if (hostTargetId !== 'host') {
      addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
        from: effectiveUserId,
        to: 'host',
        type: 'live-request',
        time: new Date().toISOString()
      }).catch(() => {});
    }

    setTimeout(() => setIsViewerRequesting(false), 2000);
  }, [isHost, cleanRoomId, room?.hostId, room?.ownerId, effectiveUserId, showToast]);

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
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-emerald-400" size={32} />
          <p className="text-sm font-bold text-gray-400">Connecting to Live Party...</p>
        </div>
      </div>
    );
  }

  if (roomNotFound || !room) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-[#141414] border border-white/10 rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 mx-auto flex items-center justify-center border border-red-500/20">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-2xl font-black">Live Party Not Found</h2>
          <p className="text-sm text-gray-400">
            This live party may have ended or the link is invalid.
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
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-[#141414] border border-white/10 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
            <Radio size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black">Live Party Has Ended</h2>
            <p className="text-sm text-gray-400">
              The broadcaster has ended this live camera party. Thank you for joining!
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
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-[#141414] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Live Camera Party
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
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Radio size={16} /> Join Live Party
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
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] text-white flex flex-col">
      {/* Toast alert */}
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

      {/* Top Navigation Bar */}
      <header className="px-4 py-3 border-b border-white/10 bg-black/60 backdrop-blur-md flex items-center justify-between gap-4 sticky top-16 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all shrink-0"
            title="Leave room"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE CAMERA
              </span>
              <h1 className="text-sm sm:text-base font-black truncate">{room.title}</h1>
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              Hosted by <span className="text-emerald-400 font-semibold">{room.hostName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Live Viewers Count Button */}
          <button
            onClick={() => setShowParticipantsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 transition-all"
            title="View participants"
          >
            <Eye size={14} className="text-emerald-400" />
            <span>{liveParticipants.length}</span>
            <span className="hidden sm:inline text-gray-400">watching</span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 transition-all"
            title="Share invite link"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>

          {/* Toggle Chat on mobile/desktop */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              showChat
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
            title="Toggle chat"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video Canvas Column */}
        <div className="flex-1 flex flex-col justify-between bg-black relative overflow-hidden">
          {/* Broadcaster Permission Error Alert */}
          {isHost && permissionError && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
              <div className="max-w-md w-full bg-red-950/40 border border-red-500/30 rounded-3xl p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center border border-red-500/30">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-black text-white">Camera & Mic Access Required</h3>
                <p className="text-xs text-red-200/80 leading-relaxed">{permissionError}</p>
                <div className="pt-2">
                  <button
                    onClick={() => startCameraBroadcast(facingMode)}
                    className="px-5 py-2.5 bg-red-500 hover:bg-red-400 text-black font-black rounded-xl text-xs transition-all shadow-lg inline-flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> Retry Permission
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Video Display Area */}
          <div className="flex-1 flex items-center justify-center relative min-h-[300px] sm:min-h-[440px] max-h-[calc(100vh-14rem)] bg-black">
            {isHost ? (
              // HOST / BROADCASTER LOCAL PREVIEW
              <div className="w-full h-full relative flex items-center justify-center">
                <video
                  ref={(el) => {
                    localVideoRef.current = el;
                    if (el && localStream) {
                      if (el.srcObject !== localStream) {
                        el.srcObject = localStream;
                      }
                      el.muted = true;
                      el.playsInline = true;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-contain ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />

                {/* Prominent Start Broadcast Button if media is not yet active */}
                {!isMediaReady && !permissionError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-sm text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg animate-pulse">
                      <Camera size={32} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-black text-white">Start Your Camera Broadcast</h3>
                      <p className="text-xs text-gray-400 max-w-xs">
                        Broadcast your camera directly to everyone in this room in real time.
                      </p>
                    </div>
                    <button
                      onClick={() => startCameraBroadcast(facingMode)}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm rounded-2xl transition-all shadow-xl shadow-emerald-950/40 inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Camera size={16} />
                      <span>Start Camera Broadcast</span>
                    </button>
                  </div>
                )}

                {/* Floating host status overlay */}
                {isMediaReady && (
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white flex items-center gap-2">
                      <Camera size={13} className="text-emerald-400 animate-pulse" />
                      <span>Broadcasting: {facingMode === 'user' ? 'Front Camera' : 'Rear Camera'}</span>
                    </span>
                    {isMuted && (
                      <span className="px-2.5 py-1 rounded-full bg-red-500/80 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1">
                        <MicOff size={11} /> Muted
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // VIEWER REMOTE BROADCASTER STREAM
              <div className="w-full h-full relative flex items-center justify-center">
                <video
                  ref={(el) => {
                    remoteVideoRef.current = el;
                    if (el && remoteStream) {
                      if (el.srcObject !== remoteStream) {
                        el.srcObject = remoteStream;
                      }
                      el.muted = viewerMuted;
                      el.playsInline = true;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted={viewerMuted}
                  className="w-full h-full object-contain"
                />

                {/* Viewer Waiting / Connecting indicator */}
                {!isViewerConnected && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-sm text-center space-y-3">
                    <RefreshCw size={36} className="animate-spin text-emerald-400" />
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-white">Connecting to Broadcaster...</h4>
                      <p className="text-xs text-gray-400 max-w-xs">
                        Negotiating live WebRTC camera connection with {room.hostName}.
                      </p>
                    </div>
                    <button
                      onClick={handleViewerReconnect}
                      disabled={isViewerRequesting}
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={isViewerRequesting ? 'animate-spin' : ''} />
                      <span>{isViewerRequesting ? 'Requesting...' : 'Request Camera Stream'}</span>
                    </button>
                  </div>
                )}

                {/* Viewer Floating Audio indicator */}
                {isViewerConnected && (
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <button
                      onClick={() => setViewerMuted(!viewerMuted)}
                      className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-bold text-white hover:bg-black/90 transition-all flex items-center gap-1.5"
                    >
                      {viewerMuted ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} className="text-emerald-400" />}
                      <span>{viewerMuted ? 'Muted (Tap to Unmute)' : 'Sound On'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Floating Reactions on top of video */}
            <div className="absolute bottom-4 left-4 z-20 flex flex-col-reverse gap-2 pointer-events-none">
              <AnimatePresence>
                {reactions.slice(-4).map((r, i) => (
                  <motion.div
                    key={r.id || `${r.time}-${i}`}
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.5 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-md border border-white/20 rounded-full text-xs text-white"
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <span className="font-bold text-gray-300">{r.username}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Broadcaster / Viewer Bottom Studio Controls Bar */}
          <div className="p-4 border-t border-white/10 bg-[#121212] flex items-center justify-between gap-3">
            {isHost ? (
              // BROADCASTER CONTROLS
              <div className="w-full flex items-center justify-between gap-2">
                {/* Left: Quick Camera & Mic Toggles */}
                <div className="flex items-center gap-2">
                  {/* Microphone Mute Toggle */}
                  <button
                    onClick={handleToggleMute}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-md ${
                      isMuted
                        ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                        : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                    }`}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff size={16} /> : <Mic size={16} className="text-emerald-400" />}
                    <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
                  </button>

                  {/* Switch Camera Button (Front ↔ Rear) */}
                  <button
                    onClick={handleToggleCamera}
                    disabled={isSwitchingCamera || !cameraSwitchAvailable}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-md ${
                      isSwitchingCamera
                        ? 'bg-white/10 text-gray-400'
                        : 'bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                    title={
                      !cameraSwitchAvailable
                        ? 'Single camera device'
                        : facingMode === 'user'
                        ? 'Switch to Rear Camera'
                        : 'Switch to Front Camera'
                    }
                  >
                    <SwitchCamera size={16} className={isSwitchingCamera ? 'animate-spin' : 'text-blue-400'} />
                    <span className="hidden sm:inline">
                      {isSwitchingCamera
                        ? 'Switching...'
                        : facingMode === 'user'
                        ? 'Switch to Rear'
                        : 'Switch to Front'}
                    </span>
                  </button>
                </div>

                {/* Right: End Live Party */}
                <button
                  onClick={handleStopLive}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-all shadow-lg"
                  title="End Live Stream"
                >
                  <Square size={14} className="fill-current" />
                  <span>End Live</span>
                </button>
              </div>
            ) : (
              // VIEWER CONTROLS
              <div className="w-full flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewerMuted(!viewerMuted)}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-bold transition-all"
                  >
                    {viewerMuted ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} className="text-emerald-400" />}
                    <span>{viewerMuted ? 'Unmute Stream' : 'Mute'}</span>
                  </button>

                  <button
                    onClick={handleViewerReconnect}
                    disabled={isViewerRequesting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all disabled:opacity-50"
                    title="Refresh camera stream"
                  >
                    <RefreshCw size={14} className={isViewerRequesting ? 'animate-spin text-emerald-400' : ''} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>

                  <button
                    onClick={() => {
                      if (document.fullscreenElement) {
                        document.exitFullscreen().catch(() => {});
                      } else {
                        document.documentElement.requestFullscreen().catch(() => {});
                      }
                    }}
                    className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all"
                    title="Fullscreen"
                  >
                    <Maximize size={15} />
                  </button>
                </div>

                <Link
                  to="/"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all"
                >
                  <LogOut size={14} />
                  <span>Leave</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Live Chat & Participants Sidebar Column */}
        {showChat && (
          <aside className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#121212] flex flex-col h-80 lg:h-auto">
            {/* Sidebar Header */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">Live Chat</span>
              </div>
              <span className="text-[11px] text-gray-400 font-semibold">
                {liveParticipants.length} online
              </span>
            </div>

            {/* Chat Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500 space-y-2">
                  <Smile size={24} className="text-gray-600" />
                  <p className="text-xs">Say hello to start the conversation!</p>
                </div>
              ) : (
                messages.map((m, index) => {
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const isSameSender = Boolean(
                    prevMsg && (
                      (m.userId && prevMsg.userId)
                        ? m.userId === prevMsg.userId
                        : m.username === prevMsg.username
                    )
                  );
                  const isMe = m.username === username;
                  const isHostMsg = m.username === room.hostName;

                  return (
                    <div 
                      key={m.id || `${m.timestamp}-${index}`} 
                      className={`text-xs ${isSameSender ? 'mt-1' : index === 0 ? 'mt-0' : 'mt-2.5'}`}
                    >
                      {!isSameSender && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`font-black ${isHostMsg ? 'text-emerald-400' : isMe ? 'text-blue-400' : 'text-gray-300'}`}>
                            {m.username}
                          </span>
                          {isHostMsg && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase">
                              Host
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-gray-200 break-words leading-relaxed pl-1">{m.text}</p>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Emoji Reaction Bar */}
            <div className="px-3 py-1.5 border-t border-white/5 flex items-center justify-between gap-1 bg-white/[0.01]">
              {['❤️', '🔥', '👏', '😂', '🎉', '👋'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSendReaction(emoji)}
                  className="hover:scale-125 active:scale-95 transition-transform p-1 text-base"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Send a message..."
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition-all disabled:opacity-40 disabled:hover:bg-emerald-500"
              >
                <Send size={14} />
              </button>
            </form>
          </aside>
        )}
      </div>

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
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
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
                className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-all"
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
