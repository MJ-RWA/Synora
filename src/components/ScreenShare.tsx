import React, { useEffect, useRef, useState, useCallback } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Monitor, MonitorOff, RefreshCw, AlertCircle } from 'lucide-react';
import { WatchRoomVoiceSignal } from '../types';

export interface ScreenShareProps {
  roomId: string;
  userId: string;
  username: string;
  isHost: boolean;
  isScreenSharingActive?: boolean;
  hostId?: string | null;
  onStreamReady?: (stream: MediaStream | null) => void;
  onSharingStateChange?: (isSharing: boolean) => void;
  onToast?: (message: string) => void;
}

const getIceServers = (): RTCConfiguration => {
  const customTurnUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TURN_SERVER_URL;
  const customTurnUsername = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TURN_USERNAME;
  const customTurnCredential = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TURN_CREDENTIAL;

  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
  ];

  if (customTurnUrl) {
    servers.push({
      urls: customTurnUrl,
      username: customTurnUsername,
      credential: customTurnCredential,
    });
  }

  return {
    iceServers: servers,
    iceCandidatePoolSize: 10,
  };
};

export const ScreenShare: React.FC<ScreenShareProps> = ({ 
  roomId, 
  userId, 
  username, 
  isHost, 
  isScreenSharingActive = false,
  hostId,
  onStreamReady,
  onSharingStateChange,
  onToast
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});
  const remoteStreams = useRef<{ [peerId: string]: MediaStream }>({});
  const processedSignals = useRef<Set<string>>(new Set());
  const hasStreamReadyRef = useRef<boolean>(false);
  const offerTimestamps = useRef<{ [peerId: string]: number }>({});
  const lastRequestTimeRef = useRef<number>(0);

  const onStreamReadyRef = useRef(onStreamReady);
  useEffect(() => {
    onStreamReadyRef.current = onStreamReady;
  }, [onStreamReady]);

  const cleanRoomId = roomId ? decodeURIComponent(roomId).trim() : '';
  const myId = userId || username;

  const cleanup = useCallback(() => {
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
    remoteStreams.current = {};
    offerTimestamps.current = {};
    hasStreamReadyRef.current = false;
    if (onStreamReadyRef.current) onStreamReadyRef.current(null);
  }, []);

  // Process queued ICE candidates after remote description is set
  const drainPendingCandidates = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidates.current[peerId];
    if (queue && queue.length > 0 && pc.remoteDescription) {
      const candidatesToProcess = [...queue];
      delete pendingCandidates.current[peerId];
      candidatesToProcess.forEach(candidate => {
        try {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
            console.warn('[ScreenShare] Non-fatal ICE candidate add error:', err);
          });
        } catch (e) {
          console.warn('[ScreenShare] Error processing queued candidate:', e);
        }
      });
    }
  }, []);

  // Create or retrieve an RTCPeerConnection for a specific remote peer
  const getOrCreatePeerConnection = useCallback((targetUserId: string) => {
    if (peerConnections.current[targetUserId]) {
      return peerConnections.current[targetUserId];
    }

    const pc = new RTCPeerConnection(getIceServers());
    peerConnections.current[targetUserId] = pc;

    // Send local ICE candidates to the target peer via Firestore signals
    pc.onicecandidate = (event) => {
      if (event.candidate && cleanRoomId && myId) {
        addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: targetUserId,
          type: 'screen-candidate',
          signal: JSON.stringify(event.candidate),
          time: new Date().toISOString(),
        }).catch((err) => {
          console.warn('[ScreenShare] Failed to send ICE candidate:', err);
        });
      }
    };

    // When signaling state changes to stable, drain queued candidates
    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable' && pc.remoteDescription) {
        drainPendingCandidates(targetUserId, pc);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[ScreenShare] Connection state with ${targetUserId}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        try {
          pc.close();
        } catch {
          // ignore
        }
        delete peerConnections.current[targetUserId];
        delete pendingCandidates.current[targetUserId];
        delete remoteStreams.current[targetUserId];
        delete offerTimestamps.current[targetUserId];
      }
    };

    pc.ontrack = (event) => {
      console.log(`[ScreenShare] Received remote screen track (${event.track.kind}):`, event.track.id);
      
      let stream = remoteStreams.current[targetUserId];
      if (!stream) {
        stream = new MediaStream();
        remoteStreams.current[targetUserId] = stream;
      }

      // Add track to stream if not already present
      if (!stream.getTracks().some(t => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      setIsConnecting(false);
      hasStreamReadyRef.current = true;

      // Pass fresh MediaStream wrapper so React state recognizes the stream update
      if (onStreamReadyRef.current) {
        onStreamReadyRef.current(new MediaStream(stream.getTracks()));
      }

      event.track.onended = () => {
        console.log(`[ScreenShare] Remote track ended (${event.track.kind})`);
        const liveTracks = stream ? stream.getTracks().filter(t => t.readyState === 'live') : [];
        if (liveTracks.length === 0) {
          hasStreamReadyRef.current = false;
          delete remoteStreams.current[targetUserId];
          if (onStreamReadyRef.current) {
            onStreamReadyRef.current(null);
          }
        }
      };
    };

    // If host has active screen stream, attach all live tracks to this peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          try {
            pc.addTrack(track, localStreamRef.current!);
          } catch (trackErr) {
            console.warn('[ScreenShare] Non-fatal addTrack error:', trackErr);
          }
        }
      });
    } else {
      // Participant side: add transceivers to receive video and audio
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch {
        // Fallback for browsers that automatically handle recv transceivers
      }
    }

    return pc;
  }, [cleanRoomId, myId, drainPendingCandidates]);

  // Universal signal listener: runs for BOTH host and participants
  useEffect(() => {
    if (!cleanRoomId || !myId) return;

    // Target addresses this peer should listen for:
    // 1) myId (uid or guest ID)
    // 2) username
    // 3) 'host' if this peer is host
    // 4) hostId if this peer is host
    const targetSet = new Set<string>();
    if (myId) targetSet.add(myId);
    if (username) targetSet.add(username);
    if (isHost) {
      targetSet.add('host');
      if (hostId) targetSet.add(hostId);
    }
    const targetList = Array.from(targetSet).filter(Boolean).slice(0, 10);

    const q = targetList.length > 1
      ? query(collection(db, `watchRooms/${cleanRoomId}/signals`), where('to', 'in', targetList))
      : query(collection(db, `watchRooms/${cleanRoomId}/signals`), where('to', '==', myId));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const docId = change.doc.id;
          const data = change.doc.data() as WatchRoomVoiceSignal;

          // Process only screen sharing signals
          if (!data.type || !data.type.startsWith('screen-')) continue;

          // Prevent processing the exact same signal doc twice
          if (processedSignals.current.has(docId)) continue;
          processedSignals.current.add(docId);
          if (processedSignals.current.size > 300) {
            const staleKeys = Array.from(processedSignals.current).slice(0, 100);
            staleKeys.forEach(k => processedSignals.current.delete(k));
          }

          const fromPeer = data.from;
          if (!fromPeer || fromPeer === myId) {
            deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
            continue;
          }

          try {
            if (data.type === 'screen-request') {
              // Participant requested screen stream from host
              if (localStreamRef.current && isHost) {
                console.log(`[ScreenShare] Host received screen-request from ${fromPeer}`);
                const existingPc = peerConnections.current[fromPeer];
                const lastOfferTime = offerTimestamps.current[fromPeer] || 0;
                const timeSinceLastOffer = Date.now() - lastOfferTime;

                // If connection is already healthy and active, no need to renegotiate
                if (existingPc && existingPc.connectionState === 'connected') {
                  console.log(`[ScreenShare] Peer ${fromPeer} already connected and receiving stream`);
                  deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                  continue;
                }

                // If an offer was created less than 2.5 seconds ago and is pending answer, do not destroy it
                if (existingPc && timeSinceLastOffer < 2500 && existingPc.connectionState !== 'failed') {
                  console.log(`[ScreenShare] Offer for ${fromPeer} is already in-flight, awaiting answer`);
                  deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                  continue;
                }

                // Close stale connection if needed
                if (existingPc) {
                  try {
                    existingPc.close();
                  } catch {
                    // ignore
                  }
                  delete peerConnections.current[fromPeer];
                }

                const pc = getOrCreatePeerConnection(fromPeer);
                offerTimestamps.current[fromPeer] = Date.now();

                const offer = await pc.createOffer({
                  offerToReceiveVideo: false,
                  offerToReceiveAudio: false,
                });
                await pc.setLocalDescription(offer);

                await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                  from: myId,
                  to: fromPeer,
                  type: 'screen-offer',
                  signal: JSON.stringify(offer),
                  time: new Date().toISOString(),
                });
              }
            } else if (data.type === 'screen-offer') {
              // Participant received screen offer from host
              console.log(`[ScreenShare] Participant received screen-offer from ${fromPeer}`);
              let pc = peerConnections.current[fromPeer];

              // If already connected and playing, ignore duplicate offer
              if (pc && pc.connectionState === 'connected' && hasStreamReadyRef.current) {
                console.log(`[ScreenShare] Already connected to ${fromPeer}, ignoring redundant offer`);
                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                continue;
              }

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
                pc = getOrCreatePeerConnection(fromPeer);
              }

              const offerDesc = new RTCSessionDescription(JSON.parse(data.signal));
              await pc.setRemoteDescription(offerDesc);
              drainPendingCandidates(fromPeer, pc);

              const answer = await pc.createAnswer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true,
              });
              await pc.setLocalDescription(answer);

              await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                from: myId,
                to: fromPeer,
                type: 'screen-answer',
                signal: JSON.stringify(answer),
                time: new Date().toISOString(),
              });
            } else if (data.type === 'screen-answer') {
              // Host received answer from participant
              console.log(`[ScreenShare] Host received screen-answer from ${fromPeer}`);
              const pc = peerConnections.current[fromPeer];
              if (pc && pc.signalingState === 'have-local-offer') {
                const answerDesc = new RTCSessionDescription(JSON.parse(data.signal));
                await pc.setRemoteDescription(answerDesc);
                drainPendingCandidates(fromPeer, pc);
              }
            } else if (data.type === 'screen-candidate') {
              const candidate = JSON.parse(data.signal);
              if (candidate && candidate.candidate) {
                const pc = peerConnections.current[fromPeer];
                if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
                    console.warn('[ScreenShare] Non-fatal candidate add error:', err);
                  });
                } else {
                  if (!pendingCandidates.current[fromPeer]) {
                    pendingCandidates.current[fromPeer] = [];
                  }
                  pendingCandidates.current[fromPeer].push(candidate);
                }
              }
            } else if (data.type === 'screen-stop') {
              // Host stopped sharing
              console.log(`[ScreenShare] Received screen-stop from ${fromPeer}`);
              if (onStreamReadyRef.current) onStreamReadyRef.current(null);
              setIsConnecting(false);
              hasStreamReadyRef.current = false;
              const pc = peerConnections.current[fromPeer];
              if (pc) {
                try {
                  pc.close();
                } catch {
                  // ignore
                }
                delete peerConnections.current[fromPeer];
                delete remoteStreams.current[fromPeer];
              }
            }
          } catch (err) {
            console.error('[ScreenShare] Error handling screen signal:', data.type, err);
          }

          // Clean up handled signal document from Firestore
          deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
        }
      }
    }, (err) => {
      console.warn('[ScreenShare] Signal listener warning:', err);
    });

    return () => {
      unsubscribe();
    };
  }, [cleanRoomId, myId, username, isHost, hostId, getOrCreatePeerConnection, drainPendingCandidates]);

  // Viewer/participant: if screen sharing is active in the room, request the stream from host
  useEffect(() => {
    if (isHost || !isScreenSharingActive || !cleanRoomId || !myId) {
      return;
    }

    const targetHost = hostId || 'host';

    const sendRequest = async () => {
      // If participant already has live stream, no need to request
      if (hasStreamReadyRef.current) return;

      const now = Date.now();
      if (now - lastRequestTimeRef.current < 2000) return;
      lastRequestTimeRef.current = now;

      try {
        setIsConnecting(true);
        console.log(`[ScreenShare] Sending screen-request to ${targetHost}`);
        await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: targetHost,
          type: 'screen-request',
          time: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[ScreenShare] Failed to send screen request:', err);
      }
    };

    sendRequest();

    // Periodic retry every 5 seconds if still not connected
    const interval = setInterval(() => {
      if (!hasStreamReadyRef.current) {
        console.log('[ScreenShare] Still waiting for host stream, retrying request...');
        sendRequest();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      setIsConnecting(false);
      hasStreamReadyRef.current = false;
    };
  }, [isHost, isScreenSharingActive, cleanRoomId, myId, hostId]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const stopSharing = useCallback(async () => {
    // Notify all peers that sharing stopped
    const usersSnap = await getDocs(collection(db, `watchRooms/${cleanRoomId}/users`)).catch(() => null);
    if (usersSnap) {
      for (const userDoc of usersSnap.docs) {
        if (userDoc.id !== myId) {
          addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
            from: myId,
            to: userDoc.id,
            type: 'screen-stop',
            time: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    }

    // Broadcast generic screen-stop to room
    addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
      from: myId,
      to: 'all',
      type: 'screen-stop',
      time: new Date().toISOString(),
    }).catch(() => {});

    cleanup();
    setIsSharing(false);
    if (onSharingStateChange) onSharingStateChange(false);

    if (isHost && cleanRoomId) {
      updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isScreenSharing: false,
        screenHostId: null
      }).catch(() => {});
    }
  }, [cleanRoomId, myId, cleanup, isHost, onSharingStateChange]);

  const startSharing = useCallback(async () => {
    setError(null);

    const isMobile = typeof navigator !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
    );

    // Screen sharing requires getDisplayMedia (never getUserMedia/camera)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      const msg = isMobile
        ? 'Screen broadcasting is not supported by your mobile browser. Please use Chrome on a desktop or laptop to share your screen.'
        : 'Screen sharing is not supported in this browser. Please use Chrome, Edge, or Firefox.';
      setError(msg);
      if (onToast) onToast(msg);
      return;
    }

    try {
      let stream: MediaStream | null = null;

      if (isMobile) {
        // Mobile browsers (Android Chrome 125+, iOS 17.2+):
        // Explicitly request displaySurface: 'monitor' with audio: false
        // This directs mobile OS to system screen capture and avoids camera delegation
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'monitor',
            } as MediaTrackConstraints,
            audio: false,
          });
        } catch (mobileErr: unknown) {
          const mErr = mobileErr as { name?: string };
          if (mErr?.name === 'NotAllowedError' || mErr?.name === 'AbortError') {
            console.log('[ScreenShare] User dismissed screen share prompt on mobile.');
            return;
          }
          // Fallback to simple { video: true } or parameterless getDisplayMedia
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
            });
          } catch (retryErr: unknown) {
            const rErr = retryErr as { name?: string };
            if (rErr?.name === 'NotAllowedError' || rErr?.name === 'AbortError') {
              return;
            }
            // Final fallback to parameterless
            try {
              stream = await navigator.mediaDevices.getDisplayMedia();
            } catch (finalErr: unknown) {
              const fErr = finalErr as { name?: string };
              if (fErr?.name === 'NotAllowedError' || fErr?.name === 'AbortError') {
                return;
              }
              throw finalErr;
            }
          }
        }
      } else {
        // Desktop browsers: capture with audio option, fallback to video-only if audio rejected
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 30, max: 30 },
            },
            audio: true,
          });
        } catch (desktopErr: unknown) {
          const dErr = desktopErr as { name?: string };
          if (dErr?.name === 'NotAllowedError' || dErr?.name === 'AbortError') {
            return;
          }
          console.warn('[ScreenShare] Desktop getDisplayMedia with audio failed, retrying video only:', desktopErr);
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
          });
        }
      }

      if (!stream) {
        throw new Error('Failed to acquire screen stream');
      }

      // Safety check: ensure the browser provided actual screen display capture, NOT device rear/front camera
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const track = videoTracks[0];
        const settings = track.getSettings ? track.getSettings() : {};
        const label = (track.label || '').toLowerCase();
        
        // If facingMode is present (e.g. 'environment', 'user') or track is labeled camera/back/rear
        if (
          settings.facingMode ||
          label.includes('camera') ||
          label.includes('rear') ||
          label.includes('back') ||
          label.includes('facing back')
        ) {
          console.error('[ScreenShare] Browser provided camera track instead of screen capture:', label);
          track.stop();
          stream.getTracks().forEach(t => t.stop());
          const msg = 'Mobile camera was triggered instead of screen broadcast. Please allow screen sharing in your mobile browser permissions.';
          setError(msg);
          if (onToast) onToast(msg);
          return;
        }
      }

      localStreamRef.current = stream;
      setIsSharing(true);
      if (onSharingStateChange) onSharingStateChange(true);
      if (onStreamReady) onStreamReady(stream);

      // Update room document in Firestore so all participants know screen share is active
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isScreenSharing: true,
        screenHostId: myId
      }).catch(err => console.warn('Failed to update room screen state:', err));

      // Broadcast offers to all currently active users in the room
      const usersSnap = await getDocs(collection(db, `watchRooms/${cleanRoomId}/users`)).catch(() => null);
      if (usersSnap) {
        for (const userDoc of usersSnap.docs) {
          const otherUserId = userDoc.id;
          if (otherUserId !== myId) {
            try {
              const pc = getOrCreatePeerConnection(otherUserId);

              // Attach stream tracks if not already present on this peer connection
              const senders = pc.getSenders();
              stream.getTracks().forEach(track => {
                const existing = senders.find(s => s.track?.id === track.id);
                if (!existing && track.readyState === 'live') {
                  try {
                    pc.addTrack(track, stream!);
                  } catch (e) {
                    console.warn('[ScreenShare] Non-fatal addTrack error:', e);
                  }
                }
              });

              offerTimestamps.current[otherUserId] = Date.now();
              const offer = await pc.createOffer({
                offerToReceiveVideo: false,
                offerToReceiveAudio: false,
              });
              await pc.setLocalDescription(offer);
              await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                from: myId,
                to: otherUserId,
                type: 'screen-offer',
                signal: JSON.stringify(offer),
                time: new Date().toISOString(),
              });
            } catch (offerErr) {
              console.warn(`[ScreenShare] Failed to send initial screen offer to ${otherUserId}:`, offerErr);
            }
          }
        }
      }

      // Listen for when host stops sharing via browser's native stop share bar
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopSharing();
        };
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      if (errorObj?.name === 'NotAllowedError' || errorObj?.name === 'AbortError') {
        console.log('[ScreenShare] User dismissed or cancelled screen sharing prompt.');
        return;
      }
      console.error('[ScreenShare] Error starting screen share:', err);
      const msg = isMobile
        ? 'Screen broadcasting is not available on this mobile browser. Please share your screen using Chrome on desktop.'
        : 'Unable to start screen share. Please check device permissions and try again.';
      setError(msg);
      if (onToast) onToast(msg);
    }
  }, [cleanRoomId, myId, onSharingStateChange, onStreamReady, getOrCreatePeerConnection, stopSharing, onToast]);

  // Re-request stream manual button for viewers
  const handleRefreshStream = useCallback(async () => {
    if (!isHost && cleanRoomId) {
      setIsConnecting(true);
      hasStreamReadyRef.current = false;
      const targetHost = hostId || 'host';
      try {
        await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: targetHost,
          type: 'screen-request',
          time: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[ScreenShare] Manual refresh request error:', err);
      }
    }
  }, [cleanRoomId, hostId, isHost, myId]);

  if (!isHost) {
    if (isScreenSharingActive) {
      return (
        <button
          onClick={handleRefreshStream}
          title="Refresh screen share stream"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all shrink-0"
        >
          <RefreshCw size={13} className={isConnecting ? 'animate-spin text-emerald-400' : ''} />
          <span>{isConnecting ? 'Connecting...' : 'Refresh'}</span>
        </button>
      );
    }
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 max-w-[180px] sm:max-w-[260px] truncate">
          <AlertCircle size={13} className="shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}
      <button
        onClick={isSharing ? stopSharing : startSharing}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 ${
          isSharing 
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
        }`}
        title={isSharing ? 'Stop Screen Share' : 'Share Screen'}
      >
        {isSharing ? <MonitorOff size={14} /> : <Monitor size={14} />}
        <span>{isSharing ? 'Stop Share' : 'Share Screen'}</span>
      </button>
    </div>
  );
};
