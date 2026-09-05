import React, { useEffect, useRef, useState, useCallback } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Mic, MicOff, Phone, PhoneOff, AlertCircle } from 'lucide-react';
import { WatchRoomVoiceSignal } from '../types';

export interface VoiceChatProps {
  roomId: string;
  userId: string;
  username: string;
  muted?: boolean;
  onMuteChange?: (muted: boolean) => void;
  onMuteToggle?: (muted: boolean) => void;
  onSpeaking?: (userId: string) => void;
  compact?: boolean;
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
  ];

  if (customTurnUrl) {
    servers.push({
      urls: customTurnUrl,
      username: customTurnUsername,
      credential: customTurnCredential,
    });
  }

  return { iceServers: servers };
};

export const VoiceChat: React.FC<VoiceChatProps> = ({ 
  roomId, 
  userId, 
  username, 
  muted = false, 
  onMuteChange,
  onMuteToggle,
  onSpeaking, 
  compact,
  onToast 
}) => {
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activePeers, setActivePeers] = useState<string[]>([]);
  const [micActive, setMicActive] = useState(!muted);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});
  const remoteAudiosRef = useRef<{ [peerId: string]: HTMLAudioElement }>({});
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const unsubscribeSignalsRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingDetectionActiveRef = useRef<boolean>(false);

  const cleanRoomId = roomId ? decodeURIComponent(roomId).trim() : '';
  const myId = userId || username;

  const cleanup = useCallback(() => {
    speakingDetectionActiveRef.current = false;
    
    if (unsubscribeSignalsRef.current) {
      unsubscribeSignalsRef.current();
      unsubscribeSignalsRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    Object.values(peerConnections.current).forEach(pc => {
      try {
        pc.close();
      } catch (err) {
        console.warn("Error closing RTCPeerConnection:", err);
      }
    });
    peerConnections.current = {};
    pendingCandidates.current = {};

    Object.values(remoteAudiosRef.current).forEach(audio => {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {
        // ignore
      }
    });
    remoteAudiosRef.current = {};

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    setActivePeers([]);
    setIsJoined(false);
    setIsConnecting(false);

    if (cleanRoomId && myId) {
      updateDoc(doc(db, `watchRooms/${cleanRoomId}/users`, myId), {
        speaking: false
      }).catch(() => {});
    }
  }, [cleanRoomId, myId]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const drainPendingCandidates = (targetId: string, pc: RTCPeerConnection) => {
    const list = pendingCandidates.current[targetId];
    if (list && list.length > 0) {
      list.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => 
          console.warn("Error adding queued ICE candidate:", e)
        );
      });
      delete pendingCandidates.current[targetId];
    }
  };

  const createPeerConnection = useCallback((targetUserId: string): RTCPeerConnection => {
    if (peerConnections.current[targetUserId]) {
      return peerConnections.current[targetUserId];
    }

    const config = getIceServers();
    const pc = new RTCPeerConnection(config);
    peerConnections.current[targetUserId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && cleanRoomId) {
        addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: targetUserId,
          type: 'candidate',
          signal: JSON.stringify(event.candidate),
          time: new Date().toISOString(),
        }).catch(err => console.warn("Failed to send ICE candidate:", err));
      }
    };

    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable' && pc.remoteDescription) {
        drainPendingCandidates(targetUserId, pc);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setActivePeers(prev => [...new Set([...prev, targetUserId])]);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setActivePeers(prev => prev.filter(id => id !== targetUserId));
        if (remoteAudiosRef.current[targetUserId]) {
          try {
            remoteAudiosRef.current[targetUserId].pause();
            remoteAudiosRef.current[targetUserId].srcObject = null;
            remoteAudiosRef.current[targetUserId].remove();
          } catch {
            // ignore
          }
          delete remoteAudiosRef.current[targetUserId];
        }
      }
    };

    pc.ontrack = (event) => {
      if (!event.streams || event.streams.length === 0) return;
      const remoteStream = event.streams[0];

      if (!remoteAudiosRef.current[targetUserId]) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.srcObject = remoteStream;
        audio.volume = 1.0;
        
        if (audioContainerRef.current) {
          audioContainerRef.current.appendChild(audio);
        } else {
          document.body.appendChild(audio);
        }
        
        audio.play().catch(e => {
          console.warn("Remote audio play deferred by browser:", e);
        });

        remoteAudiosRef.current[targetUserId] = audio;
        setActivePeers(prev => [...new Set([...prev, targetUserId])]);
      } else {
        const existingAudio = remoteAudiosRef.current[targetUserId];
        existingAudio.srcObject = remoteStream;
        existingAudio.play().catch(() => {});
      }
    };

    // Attach local audio track if available
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  }, [cleanRoomId, myId]);

  // Speaking Detection
  const startSpeakingDetection = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let isSpeaking = false;
      let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
      speakingDetectionActiveRef.current = true;

      const checkVolume = () => {
        if (!speakingDetectionActiveRef.current || !analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        const isMutedNow = localStreamRef.current?.getAudioTracks()[0]?.enabled === false;

        if (average > 20 && !isMutedNow) {
          if (!isSpeaking) {
            isSpeaking = true;
            onSpeaking?.(myId);
            if (cleanRoomId && myId) {
              updateDoc(doc(db, `watchRooms/${cleanRoomId}/users`, myId), { speaking: true }).catch(() => {});
            }
          }
          if (silenceTimeout) clearTimeout(silenceTimeout);
          silenceTimeout = setTimeout(() => {
            isSpeaking = false;
            if (cleanRoomId && myId) {
              updateDoc(doc(db, `watchRooms/${cleanRoomId}/users`, myId), { speaking: false }).catch(() => {});
            }
          }, 1500);
        }

        requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn("Audio analyzer setup failed:", err);
    }
  };

  const startVoiceChat = async () => {
    if (isConnecting || isJoined) return;
    setIsConnecting(true);
    setPermissionError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Voice chat requires a secure connection (HTTPS or localhost) and microphone support.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (advancedErr) {
        console.warn("Advanced audio constraints failed, trying basic audio constraints:", advancedErr);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }

      localStreamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !muted;
        setMicActive(audioTrack.enabled);
      }

      startSpeakingDetection(stream);
      setIsJoined(true);
      setIsConnecting(false);
      onToast?.("Connected to Voice Chat");

      // Listen for incoming WebRTC signals
      const signalsQuery = query(
        collection(db, `watchRooms/${cleanRoomId}/signals`),
        where('to', '==', myId)
      );

      if (unsubscribeSignalsRef.current) {
        unsubscribeSignalsRef.current();
      }

      unsubscribeSignalsRef.current = onSnapshot(signalsQuery, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const signalDocId = change.doc.id;
            const data = change.doc.data() as WatchRoomVoiceSignal;
            const fromPeerId = data.from;

            // Do not delete or handle screen share signals in VoiceChat
            if (data.type?.startsWith('screen-')) {
              continue;
            }

            // Delete voice signal after fetching to avoid reprocessing
            deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, signalDocId)).catch(() => {});

            if (!fromPeerId || fromPeerId === myId) continue;

            if (data.type === 'voice-leave') {
              if (peerConnections.current[fromPeerId]) {
                try {
                  peerConnections.current[fromPeerId].close();
                } catch {
                  // ignore
                }
                delete peerConnections.current[fromPeerId];
              }
              if (remoteAudiosRef.current[fromPeerId]) {
                try {
                  remoteAudiosRef.current[fromPeerId].pause();
                  remoteAudiosRef.current[fromPeerId].srcObject = null;
                  remoteAudiosRef.current[fromPeerId].remove();
                } catch {
                  // ignore
                }
                delete remoteAudiosRef.current[fromPeerId];
              }
              setActivePeers(prev => prev.filter(id => id !== fromPeerId));
              continue;
            }

            const pc = createPeerConnection(fromPeerId);

            if (data.type === 'voice-ready') {
              // Initiator rule: if myId > fromPeerId, send offer
              if (myId > fromPeerId) {
                try {
                  const offer = await pc.createOffer();
                  await pc.setLocalDescription(offer);
                  await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                    from: myId,
                    to: fromPeerId,
                    type: 'offer',
                    signal: JSON.stringify(offer),
                    time: new Date().toISOString(),
                  });
                } catch (offerInitErr) {
                  console.warn("Failed to create offer on voice-ready:", offerInitErr);
                }
              }
            } else if (data.type === 'offer') {
              try {
                const offerDesc = new RTCSessionDescription(JSON.parse(data.signal));
                
                // If in collision / glare state
                if (pc.signalingState !== 'stable') {
                  if (myId > fromPeerId) {
                    // Polite peer yields
                    await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
                  } else {
                    // Impolite peer ignores offer
                    continue;
                  }
                }

                await pc.setRemoteDescription(offerDesc);
                drainPendingCandidates(fromPeerId, pc);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                  from: myId,
                  to: fromPeerId,
                  type: 'answer',
                  signal: JSON.stringify(answer),
                  time: new Date().toISOString(),
                });
              } catch (offerErr) {
                console.error("Error processing voice offer:", offerErr);
              }
            } else if (data.type === 'answer') {
              try {
                if (pc.signalingState === 'have-local-offer') {
                  const answerDesc = new RTCSessionDescription(JSON.parse(data.signal));
                  await pc.setRemoteDescription(answerDesc);
                  drainPendingCandidates(fromPeerId, pc);
                }
              } catch (answerErr) {
                console.error("Error processing voice answer:", answerErr);
              }
            } else if (data.type === 'candidate') {
              try {
                const candidateInit = JSON.parse(data.signal);
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
                } else {
                  if (!pendingCandidates.current[fromPeerId]) {
                    pendingCandidates.current[fromPeerId] = [];
                  }
                  pendingCandidates.current[fromPeerId].push(candidateInit);
                }
              } catch (candErr) {
                console.error("Error adding voice candidate:", candErr);
              }
            }
          }
        }
      }, (err) => {
        console.warn("Voice signals listener error:", err);
      });

      // Announce readiness and connect with participants in the room
      try {
        const usersSnap = await getDocs(collection(db, `watchRooms/${cleanRoomId}/users`));
        for (const userDoc of usersSnap.docs) {
          const otherUserId = userDoc.id;
          if (otherUserId !== myId) {
            // Send voice-ready signal so peers know this client joined voice
            addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
              from: myId,
              to: otherUserId,
              type: 'voice-ready',
              time: new Date().toISOString(),
            }).catch(() => {});

            // Deterministic initiator rule
            if (myId > otherUserId) {
              const pc = createPeerConnection(otherUserId);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
                from: myId,
                to: otherUserId,
                type: 'offer',
                signal: JSON.stringify(offer),
                time: new Date().toISOString(),
              });
            }
          }
        }
      } catch (userScanErr) {
        console.warn("User scan error on voice join:", userScanErr);
      }

    } catch (err: unknown) {
      console.error("Error starting voice chat:", err);
      setIsConnecting(false);
      setIsJoined(false);

      const error = err as { name?: string; message?: string };
      let userFriendlyMsg = "Could not access microphone.";
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        userFriendlyMsg = "Microphone permission was denied. Please allow microphone access in your browser.";
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        userFriendlyMsg = "No microphone was found on this device.";
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        userFriendlyMsg = "Microphone is currently in use by another application.";
      } else if (error?.message) {
        userFriendlyMsg = error.message;
      }

      setPermissionError(userFriendlyMsg);
      onToast?.(userFriendlyMsg);
    }
  };

  // Sync external `muted` prop with local audio track
  useEffect(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !muted;
        setMicActive(audioTrack.enabled);
      }
    }
  }, [muted]);

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const nextState = !audioTrack.enabled;
      audioTrack.enabled = nextState;
      setMicActive(nextState);
      const isMuted = !nextState;
      onMuteChange?.(isMuted);
      onMuteToggle?.(isMuted);
      onToast?.(nextState ? "Microphone unmuted" : "Microphone muted");
    }
  };

  const leaveVoiceChat = () => {
    if (cleanRoomId && myId && activePeers.length > 0) {
      activePeers.forEach(peerId => {
        addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: peerId,
          type: 'voice-leave',
          time: new Date().toISOString(),
        }).catch(() => {});
      });
    }
    cleanup();
    onToast?.("Left Voice Chat");
  };

  return (
    <div className={`flex items-center gap-2 sm:gap-3 bg-white/5 rounded-2xl border border-white/5 ${compact ? 'p-1.5' : 'p-2 sm:p-3'}`}>
      <div ref={audioContainerRef} className="hidden" aria-hidden="true" />
      
      {!compact && (
        <div className="hidden sm:flex flex-col">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Voice</span>
          <span className="text-xs text-emerald-500 font-bold">
            {isJoined ? `${activePeers.length + 1} in call` : 'Ready'}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        {!isJoined ? (
          <button 
            onClick={startVoiceChat}
            disabled={isConnecting}
            className="h-9 sm:h-10 px-2.5 sm:px-3 flex items-center gap-1.5 sm:gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl transition-all shadow-lg shadow-emerald-900/20 text-white font-bold text-xs"
            title="Join Voice Chat"
          >
            {isConnecting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Phone size={15} />
            )}
            <span className={compact ? 'hidden' : 'inline'}>{isConnecting ? 'Connecting...' : 'Join Voice'}</span>
          </button>
        ) : (
          <>
            <button 
              onClick={toggleMic}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all font-bold ${
                micActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
              title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micActive ? <Mic size={17} /> : <MicOff size={17} />}
            </button>
            <button 
              onClick={leaveVoiceChat}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-900/20 text-white"
              title="Leave Voice Chat"
            >
              <PhoneOff size={17} />
            </button>
          </>
        )}

        {permissionError && (
          <div className="relative group">
            <AlertCircle size={18} className="text-amber-500 cursor-help" />
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 p-2 bg-black/90 border border-white/10 rounded-xl text-[11px] text-amber-300 z-50 shadow-xl">
              {permissionError}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
