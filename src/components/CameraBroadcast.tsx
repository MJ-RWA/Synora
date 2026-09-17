import React, { useEffect, useRef, useState, useCallback } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Camera, CameraOff, RefreshCw, Mic, MicOff, AlertCircle } from 'lucide-react';
import { WatchRoomVoiceSignal } from '../types';

export interface CameraBroadcastProps {
  roomId: string;
  userId: string;
  username: string;
  isHost: boolean;
  isCameraActive?: boolean;
  cameraHostId?: string | null;
  onStreamReady?: (stream: MediaStream | null) => void;
  onSharingStateChange?: (isActive: boolean) => void;
  onToast?: (message: string) => void;
  facingMode?: 'user' | 'environment';
  onFacingModeChange?: (mode: 'user' | 'environment') => void;
  autoStart?: boolean;
  isHostOnline?: boolean;
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
    {
      urls: [
        'stun:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
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

export const CameraBroadcast: React.FC<CameraBroadcastProps> = ({
  roomId,
  userId,
  username,
  isHost,
  isCameraActive = false,
  cameraHostId,
  onStreamReady,
  onSharingStateChange,
  onToast,
  facingMode = 'user',
  onFacingModeChange,
  autoStart = false,
  isHostOnline = true,
}) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>(facingMode);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});
  const remoteStreams = useRef<{ [peerId: string]: MediaStream }>({});
  const processedSignals = useRef<Set<string>>(new Set());
  const offerTimestamps = useRef<{ [peerId: string]: number }>({});
  const lastRequestTimeRef = useRef<number>(0);
  const pendingRequestsRef = useRef<Set<string>>(new Set());
  const hasStreamReadyRef = useRef<boolean>(false);

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
    pendingRequestsRef.current.clear();
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
        if (!candidate || !candidate.candidate) return;
        try {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
            console.debug('[CameraBroadcast] ICE candidate add note:', err);
          });
        } catch (e) {
          console.debug('[CameraBroadcast] Candidate processing note:', e);
        }
      });
    }
  }, []);

  // Create or retrieve RTCPeerConnection
  const getOrCreatePeerConnection = useCallback((targetUserId: string) => {
    if (peerConnections.current[targetUserId]) {
      return peerConnections.current[targetUserId];
    }

    const pc = new RTCPeerConnection(getIceServers());
    peerConnections.current[targetUserId] = pc;

    // Viewers declare receive-only transceivers for audio & video to guarantee SDP negotiation
    if (!isHost) {
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch (transceiverErr) {
        console.debug('[CameraBroadcast] Transceiver note:', transceiverErr);
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && cleanRoomId && myId) {
        addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: targetUserId,
          type: 'camera-candidate',
          signal: JSON.stringify(event.candidate),
          time: new Date().toISOString(),
        }).catch(err => {
          console.debug('[CameraBroadcast] Failed to send candidate:', err);
        });
      }
    };

    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable' && pc.remoteDescription) {
        drainPendingCandidates(targetUserId, pc);
      }
    };

    pc.onconnectionstatechange = () => {
      console.debug(`[CameraBroadcast] Connection state with ${targetUserId}:`, pc.connectionState);
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
        hasStreamReadyRef.current = false;
      }
    };

    pc.ontrack = (event) => {
      console.debug(`[CameraBroadcast] Received remote track (${event.track.kind}):`, event.track.id);
      let stream = remoteStreams.current[targetUserId];
      if (!stream) {
        stream = new MediaStream();
        remoteStreams.current[targetUserId] = stream;
      }
      if (!stream.getTracks().some(t => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      event.track.onended = () => {
        console.debug(`[CameraBroadcast] Remote track ended (${event.track.kind})`);
        const s = remoteStreams.current[targetUserId];
        const live = s ? s.getTracks().filter(t => t.readyState === 'live') : [];
        if (live.length === 0) {
          hasStreamReadyRef.current = false;
          delete remoteStreams.current[targetUserId];
          if (onStreamReadyRef.current) {
            onStreamReadyRef.current(null);
          }
        }
      };

      setIsConnecting(false);
      hasStreamReadyRef.current = true;
      // Wrap in new MediaStream so React detects state reference change and mounts <video> srcObject!
      if (onStreamReadyRef.current) {
        onStreamReadyRef.current(new MediaStream(stream.getTracks()));
      }
    };

    // If local stream exists and we are host, add tracks
    if (localStreamRef.current && isHost) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch (e) {
          console.debug('[CameraBroadcast] Add track error:', e);
        }
      });
    }

    return pc;
  }, [cleanRoomId, drainPendingCandidates, isHost, myId]);

  // Host sends WebRTC offer to target viewer
  const sendOffer = useCallback(async (targetUserId: string) => {
    if (!localStreamRef.current || !isHost) return;

    try {
      const pc = getOrCreatePeerConnection(targetUserId);
      if (localStreamRef.current) {
        const senders = pc.getSenders();
        localStreamRef.current.getTracks().forEach(track => {
          if (!senders.some(s => s.track && s.track.kind === track.kind)) {
            try {
              pc.addTrack(track, localStreamRef.current!);
            } catch (e) {
              console.debug('[CameraBroadcast] Add track error in sendOffer:', e);
            }
          }
        });
      }

      offerTimestamps.current[targetUserId] = Date.now();

      const offer = await pc.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false,
      });
      await pc.setLocalDescription(offer);

      await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
        from: myId,
        to: targetUserId,
        type: 'camera-offer',
        signal: JSON.stringify(offer),
        time: new Date().toISOString(),
      });
      console.debug(`[CameraBroadcast] Sent camera-offer to ${targetUserId}`);
    } catch (err) {
      console.error(`[CameraBroadcast] Failed to send offer to ${targetUserId}:`, err);
    }
  }, [cleanRoomId, getOrCreatePeerConnection, isHost, myId]);

  // Listener for Firestore WebRTC signals
  useEffect(() => {
    if (!cleanRoomId || !myId) return;

    const targetSet = new Set<string>();
    if (myId) targetSet.add(myId);
    if (username) targetSet.add(username);
    if (isHost) {
      targetSet.add('host');
      if (cameraHostId) targetSet.add(cameraHostId);
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

          // Only process camera signals
          if (!data.type || !data.type.startsWith('camera-')) continue;

          if (processedSignals.current.has(docId)) continue;

          const fromPeer = data.from;
          if (!fromPeer || fromPeer === myId) {
            deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
            continue;
          }

          try {
            if (data.type === 'camera-request') {
              if (isHost) {
                // If local stream isn't ready yet, queue the peer request and do NOT drop it!
                if (!localStreamRef.current) {
                  pendingRequestsRef.current.add(fromPeer);
                  continue;
                }

                processedSignals.current.add(docId);
                console.debug(`[CameraBroadcast] Host received camera-request from ${fromPeer}`);
                const existingPc = peerConnections.current[fromPeer];
                const lastOfferTime = offerTimestamps.current[fromPeer] || 0;
                const timeSinceLast = Date.now() - lastOfferTime;

                if (existingPc && existingPc.connectionState === 'connected') {
                  deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                  continue;
                }

                if (existingPc && timeSinceLast < 2000 && existingPc.connectionState !== 'failed') {
                  deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                  continue;
                }

                if (existingPc) {
                  try { existingPc.close(); } catch { /* ignore */ }
                  delete peerConnections.current[fromPeer];
                  delete pendingCandidates.current[fromPeer];
                }

                await sendOffer(fromPeer);
                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
              }
            } else if (data.type === 'camera-offer') {
              if (!isHost) {
                processedSignals.current.add(docId);
                console.debug(`[CameraBroadcast] Viewer received camera-offer from ${fromPeer}`);
                let pc = peerConnections.current[fromPeer];
                if (pc && pc.connectionState === 'connected' && hasStreamReadyRef.current) {
                  deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
                  continue;
                }

                if (pc && pc.signalingState !== 'stable') {
                  try { pc.close(); } catch { /* ignore */ }
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
                  type: 'camera-answer',
                  signal: JSON.stringify(answer),
                  time: new Date().toISOString(),
                });

                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
              }
            } else if (data.type === 'camera-answer') {
              if (isHost) {
                processedSignals.current.add(docId);
                console.debug(`[CameraBroadcast] Host received camera-answer from ${fromPeer}`);
                const pc = peerConnections.current[fromPeer];
                if (pc && pc.signalingState === 'have-local-offer') {
                  const answerDesc = new RTCSessionDescription(JSON.parse(data.signal));
                  await pc.setRemoteDescription(answerDesc);
                  drainPendingCandidates(fromPeer, pc);
                }
                deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
              }
            } else if (data.type === 'camera-candidate') {
              processedSignals.current.add(docId);
              const pc = peerConnections.current[fromPeer];
              const candidate = JSON.parse(data.signal);

              if (candidate && candidate.candidate) {
                if (pc && pc.remoteDescription) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (e) {
                    console.debug('[CameraBroadcast] Candidate note:', e);
                  }
                } else {
                  if (!pendingCandidates.current[fromPeer]) {
                    pendingCandidates.current[fromPeer] = [];
                  }
                  pendingCandidates.current[fromPeer].push(candidate);
                }
              }
              deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
            }
          } catch (sigErr) {
            console.error('[CameraBroadcast] Signal error:', sigErr);
            deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [cameraHostId, cleanRoomId, drainPendingCandidates, getOrCreatePeerConnection, isHost, myId, sendOffer, username]);

  // Viewer: Continuously request camera stream until stream is established
  useEffect(() => {
    if (isHost || !isCameraActive || !cleanRoomId || !myId) return;

    const targetHost = cameraHostId || 'host';

    const sendRequest = async () => {
      if (hasStreamReadyRef.current) return;
      const now = Date.now();
      if (now - lastRequestTimeRef.current < 2000) return;
      lastRequestTimeRef.current = now;

      setIsConnecting(true);
      try {
        console.debug(`[CameraBroadcast] Sending camera-request to ${targetHost}`);
        await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: targetHost,
          type: 'camera-request',
          time: new Date().toISOString(),
        });
        if (targetHost !== 'host') {
          await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
            from: myId,
            to: 'host',
            type: 'camera-request',
            time: new Date().toISOString(),
          }).catch(() => {});
        }
      } catch (err) {
        console.debug('[CameraBroadcast] Failed to send camera-request:', err);
      }
    };

    sendRequest();

    // Periodic heartbeat request if stream is not established yet
    const interval = setInterval(() => {
      if (!hasStreamReadyRef.current) {
        sendRequest();
      }
    }, 3500);

    return () => {
      clearInterval(interval);
    };
  }, [cameraHostId, cleanRoomId, isCameraActive, isHost, myId]);

  // Host starts camera broadcasting
  const startBroadcasting = useCallback(async (desiredMode: 'user' | 'environment' = currentFacingMode) => {
    setError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: desiredMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });
      } catch (err1) {
        console.warn('[CameraBroadcast] High quality capture failed, trying basic:', err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (err2) {
          console.warn('[CameraBroadcast] Audio failed, falling back to video only:', err2);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      localStreamRef.current = stream;
      setIsBroadcasting(true);
      setCurrentFacingMode(desiredMode);
      setIsMuted(!stream.getAudioTracks().some(t => t.enabled));
      if (onSharingStateChange) onSharingStateChange(true);
      if (onFacingModeChange) onFacingModeChange(desiredMode);

      // Immediately pass local stream to parent video player stage!
      if (onStreamReadyRef.current) {
        onStreamReadyRef.current(stream);
      }

      // Immediately answer any pending viewer requests that arrived before camera was active!
      if (pendingRequestsRef.current.size > 0) {
        const waitingPeers = Array.from(pendingRequestsRef.current);
        pendingRequestsRef.current.clear();
        waitingPeers.forEach(peerId => {
          sendOffer(peerId);
        });
      }

      // Update Firestore room status
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isCameraActive: true,
        cameraHostId: myId,
        isScreenSharing: false, // Turn off screen sharing if switching to camera
      });

      if (onToast) onToast('Camera broadcast started! Streaming to room video player.');
    } catch (err: unknown) {
      console.error('[CameraBroadcast] Media error:', err);
      const errorObj = err as { name?: string; message?: string };
      let msg = 'Could not access camera.';
      if (errorObj.name === 'NotAllowedError' || errorObj.name === 'PermissionDeniedError') {
        msg = 'Camera access was denied. Please allow camera and mic permissions.';
      } else if (errorObj.name === 'NotFoundError') {
        msg = 'No camera found on your device.';
      }
      setError(msg);
      if (onToast) onToast(msg);
    }
  }, [cleanRoomId, currentFacingMode, myId, onFacingModeChange, onSharingStateChange, onToast, sendOffer]);

  // Host stops camera broadcasting
  const stopBroadcasting = useCallback(async () => {
    cleanup();
    setIsBroadcasting(false);
    if (onSharingStateChange) onSharingStateChange(false);

    try {
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isCameraActive: false,
        cameraHostId: null,
      });
      if (onToast) onToast('Camera broadcast stopped.');
    } catch (err) {
      console.debug('Failed to update camera state on stop:', err);
    }
  }, [cleanRoomId, cleanup, onSharingStateChange, onToast]);

  // Flip front / rear camera
  const toggleFacingMode = async () => {
    const nextMode = currentFacingMode === 'user' ? 'environment' : 'user';
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    await startBroadcasting(nextMode);
  };

  // Toggle microphone
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newMuted = !isMuted;
      audioTracks.forEach(t => {
        t.enabled = !newMuted;
      });
      setIsMuted(newMuted);
      if (onToast) onToast(newMuted ? 'Microphone muted' : 'Microphone unmuted');
    }
  };

  // Host autoStart broadcasting when requested (e.g. Live Broadcast)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (autoStart && isHost && !isBroadcasting && !localStreamRef.current && !error) {
      timeoutId = setTimeout(() => {
        startBroadcasting(currentFacingMode);
      }, 50);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [autoStart, isHost, isBroadcasting, error, currentFacingMode, startBroadcasting]);

  // Auto clean up on component unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Sync state if remote room stops camera
  useEffect(() => {
    if (!isCameraActive && !isHost && remoteStreams.current) {
      remoteStreams.current = {};
      hasStreamReadyRef.current = false;
      if (onStreamReadyRef.current) {
        onStreamReadyRef.current(null);
      }
    }
  }, [isCameraActive, isHost]);

  // If not host, viewer gets reconnection trigger or status
  if (!isHost) {
    if (!isCameraActive) return null;
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl border text-[11px] sm:text-xs font-bold shrink-0 whitespace-nowrap ${
            isHostOnline === false
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
          title={isHostOnline === false ? 'Host is offline (Broadcast paused)' : 'Host Live Camera'}
        >
          {isHostOnline === false ? (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          ) : (
            <Camera size={13} className="animate-pulse shrink-0 text-emerald-400" />
          )}
          <span className="hidden sm:inline whitespace-nowrap">
            {isHostOnline === false ? 'Host Offline (Paused)' : 'Host Live Camera'}
          </span>
          <span className="sm:hidden whitespace-nowrap">
            {isHostOnline === false ? 'Host Offline' : 'Host Live'}
          </span>
        </span>
        {isConnecting && isHostOnline !== false && (
          <button
            onClick={() => {
              const targetHost = cameraHostId || 'host';
              addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                from: myId,
                to: targetHost,
                type: 'camera-request',
                time: new Date().toISOString(),
              }).catch(() => {});
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold border border-white/10 shrink-0 whitespace-nowrap"
            title="Reconnect stream"
          >
            <RefreshCw size={12} className="animate-spin text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Connecting...</span>
          </button>
        )}
      </div>
    );
  }

  // HOST CONTROLS
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      {error && (
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-red-400">
          <AlertCircle size={12} /> {error}
        </span>
      )}

      {isBroadcasting ? (
        <>
          <button
            type="button"
            onClick={stopBroadcasting}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-950/40 cursor-pointer shrink-0"
            title="Stop camera broadcast"
          >
            <CameraOff size={14} />
            <span className="hidden sm:inline">Stop Camera</span>
          </button>

          <button
            type="button"
            onClick={toggleFacingMode}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer shrink-0"
            title={`Switch to ${currentFacingMode === 'user' ? 'rear' : 'front'} camera`}
          >
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            onClick={toggleMic}
            className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => startBroadcasting('user')}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-950/30 cursor-pointer shrink-0"
          title="Broadcast your camera directly to the room's video player"
        >
          <Camera size={14} />
          <span>Camera</span>
        </button>
      )}
    </div>
  );
};
