import React, { useEffect, useRef, useState, useCallback } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Mic, MicOff, Phone, PhoneOff, AlertCircle, ShieldAlert } from 'lucide-react';
import { WatchRoomVoiceSignal } from '../types';

export interface VoiceChatProps {
  roomId: string;
  userId: string;
  username: string;
  muted?: boolean;
  mutedByHost?: boolean;
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
  mutedByHost = false,
  onMuteChange,
  onMuteToggle,
  onSpeaking, 
  compact,
  onToast 
}) => {
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activePeers, setActivePeers] = useState<string[]>([]);
  const [micActive, setMicActive] = useState(!muted && !mutedByHost);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});
  const remoteAudiosRef = useRef<{ [peerId: string]: HTMLAudioElement }>({});
  const remoteAudioNodesRef = useRef<{
    [peerId: string]: {
      source: MediaStreamAudioSourceNode;
      gain: GainNode;
      compressor: DynamicsCompressorNode;
    };
  }>({});
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const prevHostMutedRef = useRef<boolean>(mutedByHost);
  const unsubscribeSignalsRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingDetectionActiveRef = useRef<boolean>(false);

  const cleanRoomId = roomId ? decodeURIComponent(roomId).trim() : '';
  const myId = userId || username;

  const ensureAudioContext = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      return audioContextRef.current;
    } catch (e) {
      console.warn("AudioContext setup warning:", e);
      return null;
    }
  }, []);

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

    // Disconnect and clean up remote Web Audio nodes
    Object.values(remoteAudioNodesRef.current).forEach(({ source, gain, compressor }) => {
      try {
        source.disconnect();
        gain.disconnect();
        compressor.disconnect();
      } catch {
        // ignore
      }
    });
    remoteAudioNodesRef.current = {};

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
        if (remoteAudioNodesRef.current[targetUserId]) {
          try {
            const { source, gain, compressor } = remoteAudioNodesRef.current[targetUserId];
            source.disconnect();
            gain.disconnect();
            compressor.disconnect();
          } catch {
            // ignore
          }
          delete remoteAudioNodesRef.current[targetUserId];
        }
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

      let usingWebAudio = false;
      const audioCtx = ensureAudioContext();
      if (audioCtx) {
        try {
          if (remoteAudioNodesRef.current[targetUserId]) {
            try {
              const old = remoteAudioNodesRef.current[targetUserId];
              old.source.disconnect();
              old.gain.disconnect();
              old.compressor.disconnect();
            } catch {
              // ignore
            }
          }

          const source = audioCtx.createMediaStreamSource(remoteStream);
          const gainNode = audioCtx.createGain();

          // Apply clean vocal gain boost (+5.1 dB) so conversational speech is clearly audible while video is playing
          gainNode.gain.setValueAtTime(1.8, audioCtx.currentTime);

          // Dynamics compressor prevents distortion, ear fatigue, or clipping if someone laughs or speaks loudly
          const compressor = audioCtx.createDynamicsCompressor();
          compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
          compressor.knee.setValueAtTime(10, audioCtx.currentTime);
          compressor.ratio.setValueAtTime(3.5, audioCtx.currentTime);
          compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
          compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

          source.connect(gainNode);
          gainNode.connect(compressor);
          compressor.connect(audioCtx.destination);

          remoteAudioNodesRef.current[targetUserId] = {
            source,
            gain: gainNode,
            compressor,
          };
          usingWebAudio = true;
        } catch (audioCtxErr) {
          console.warn("Web Audio pipeline setup for remote stream failed, falling back to direct audio tag:", audioCtxErr);
        }
      }

      if (!remoteAudiosRef.current[targetUserId]) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.srcObject = remoteStream;
        // When Web Audio pipeline is active, set audio element volume to 0 to keep WebRTC decoding active without duplicate sound
        // If Web Audio failed, fallback to volume 1.0 for reliable playback
        audio.volume = usingWebAudio ? 0 : 1.0;
        
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
        existingAudio.volume = usingWebAudio ? 0 : 1.0;
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
  }, [cleanRoomId, myId, ensureAudioContext]);

  // Speaking Detection
  const startSpeakingDetection = (stream: MediaStream) => {
    try {
      const audioCtx = ensureAudioContext();
      if (!audioCtx) return;

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

  // Resume AudioContext on any user interaction while in voice chat
  useEffect(() => {
    if (!isJoined) return;
    const resumeAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
  }, [isJoined]);

  const startVoiceChat = async () => {
    if (isConnecting || isJoined) return;
    setIsConnecting(true);
    setPermissionError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Voice chat requires a secure connection (HTTPS or localhost) and microphone support.");
      }

      // Initialize or resume AudioContext within user click gesture
      ensureAudioContext();

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch (advancedErr) {
        console.warn("Advanced audio constraints failed, trying standard audio constraints:", advancedErr);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      }

      // Explicitly enforce track constraints to ensure browser driver enables AGC, AEC, and NS
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && audioTrack.applyConstraints) {
        audioTrack.applyConstraints({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }).catch(() => {});
      }

      localStreamRef.current = stream;
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

            // Do not delete or handle screen share or camera broadcast signals in VoiceChat
            if (data.type?.startsWith('screen-') || data.type?.startsWith('camera-')) {
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
              if (remoteAudioNodesRef.current[fromPeerId]) {
                try {
                  const { source, gain, compressor } = remoteAudioNodesRef.current[fromPeerId];
                  source.disconnect();
                  gain.disconnect();
                  compressor.disconnect();
                } catch {
                  // ignore
                }
                delete remoteAudioNodesRef.current[fromPeerId];
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

  // Sync external `muted` and `mutedByHost` props with local audio track
  useEffect(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const shouldBeActive = !muted && !mutedByHost;
        audioTrack.enabled = shouldBeActive;
        setMicActive(shouldBeActive);
      }
    }

    // Check host mute transitions
    if (prevHostMutedRef.current !== mutedByHost) {
      if (mutedByHost) {
        onToast?.("You were muted by the room host.");
        onMuteChange?.(true);
        onMuteToggle?.(true);
      } else if (prevHostMutedRef.current) {
        onToast?.("Host removed mute restriction. You can now turn your microphone back on.");
      }
      prevHostMutedRef.current = mutedByHost;
    }
  }, [muted, mutedByHost, onToast, onMuteChange, onMuteToggle]);

  const toggleMic = () => {
    if (mutedByHost) {
      onToast?.("You have been muted by the room host.");
      return;
    }
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

      if (cleanRoomId && myId) {
        updateDoc(doc(db, `watchRooms/${cleanRoomId}/users`, myId), {
          micActive: nextState,
          isMuted,
        }).catch(() => {});
      }
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
      <div ref={audioContainerRef} className="fixed -top-96 -left-96 w-1 h-1 opacity-0 pointer-events-none overflow-hidden" aria-hidden="true" />
      
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
              id="voicechat-mic-btn"
              onClick={toggleMic}
              disabled={mutedByHost}
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all font-bold ${
                mutedByHost 
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed opacity-90'
                  : micActive 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
              title={
                mutedByHost 
                  ? 'Muted by Room Host (Cannot unmute until host unlocks)' 
                  : micActive 
                  ? 'Mute Microphone' 
                  : 'Unmute Microphone'
              }
            >
              {mutedByHost ? <ShieldAlert size={17} /> : micActive ? <Mic size={17} /> : <MicOff size={17} />}
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
