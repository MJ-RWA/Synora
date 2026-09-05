import React, { useEffect, useRef, useState, useCallback } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Monitor, MonitorOff, RefreshCw, AlertCircle } from 'lucide-react';
import { WatchRoomVoiceSignal } from '../types';

interface ScreenShareProps {
  roomId: string;
  userId: string;
  username: string;
  isHost: boolean;
  isScreenSharingActive?: boolean;
  hostId?: string | null;
  onStreamReady?: (stream: MediaStream | null) => void;
  onSharingStateChange?: (isSharing: boolean) => void;
}

const iceServers: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ],
};

export const ScreenShare: React.FC<ScreenShareProps> = ({ 
  roomId, 
  userId, 
  username, 
  isHost, 
  isScreenSharingActive = false,
  hostId,
  onStreamReady,
  onSharingStateChange
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});
  const hasRequestedStreamRef = useRef(false);

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
    if (onStreamReady) onStreamReady(null);
  }, [onStreamReady]);

  // Create or retrieve an RTCPeerConnection for a specific remote peer
  const getOrCreatePeerConnection = useCallback((targetUserId: string) => {
    if (peerConnections.current[targetUserId]) {
      return peerConnections.current[targetUserId];
    }

    const pc = new RTCPeerConnection(iceServers);
    peerConnections.current[targetUserId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && cleanRoomId) {
        addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: targetUserId,
          type: 'screen-candidate',
          signal: JSON.stringify(event.candidate),
          time: new Date().toISOString(),
        }).catch((err) => {
          console.warn('Failed to send ICE candidate:', err);
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        try {
          pc.close();
        } catch {
          // ignore
        }
        delete peerConnections.current[targetUserId];
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setIsConnecting(false);
        if (onStreamReady) {
          onStreamReady(event.streams[0]);
        }
      }
    };

    // If host has active screen stream, attach all tracks to this peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  }, [cleanRoomId, myId, onStreamReady]);

  // Process queued ICE candidates after remote description is set
  const processPendingCandidates = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidates.current[peerId];
    if (queue && queue.length > 0) {
      queue.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
          console.warn('Error adding queued ICE candidate:', err);
        });
      });
      delete pendingCandidates.current[peerId];
    }
  }, []);

  // Universal signal listener: runs for BOTH host and participants
  useEffect(() => {
    if (!cleanRoomId || !myId) return;

    const q = query(
      collection(db, `watchRooms/${cleanRoomId}/signals`),
      where('to', '==', myId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const docId = change.doc.id;
          const data = change.doc.data() as WatchRoomVoiceSignal;

          // Process only screen sharing signals
          if (!data.type || !data.type.startsWith('screen-')) continue;

          const fromPeer = data.from;

          try {
            if (data.type === 'screen-request') {
              // Participant joined and requested screen stream from host
              if (localStreamRef.current) {
                const pc = getOrCreatePeerConnection(fromPeer);
                const offer = await pc.createOffer();
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
              const pc = getOrCreatePeerConnection(fromPeer);
              if (pc.signalingState !== 'stable') {
                await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
              }
              const offerDesc = new RTCSessionDescription(JSON.parse(data.signal));
              await pc.setRemoteDescription(offerDesc);
              processPendingCandidates(fromPeer, pc);

              const answer = await pc.createAnswer();
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
              const pc = peerConnections.current[fromPeer];
              if (pc && pc.signalingState === 'have-local-offer') {
                const answerDesc = new RTCSessionDescription(JSON.parse(data.signal));
                await pc.setRemoteDescription(answerDesc);
                processPendingCandidates(fromPeer, pc);
              }
            } else if (data.type === 'screen-candidate') {
              const candidate = JSON.parse(data.signal);
              const pc = peerConnections.current[fromPeer];
              if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                if (!pendingCandidates.current[fromPeer]) {
                  pendingCandidates.current[fromPeer] = [];
                }
                pendingCandidates.current[fromPeer].push(candidate);
              }
            } else if (data.type === 'screen-stop') {
              // Host stopped sharing
              if (onStreamReady) onStreamReady(null);
              setIsConnecting(false);
              const pc = peerConnections.current[fromPeer];
              if (pc) {
                try {
                  pc.close();
                } catch {
                  // ignore
                }
                delete peerConnections.current[fromPeer];
              }
            }
          } catch (err) {
            console.error('Error handling screen signal:', data.type, err);
          }

          // Clean up handled signal document
          deleteDoc(doc(db, `watchRooms/${cleanRoomId}/signals`, docId)).catch(() => {});
        }
      }
    }, (err) => {
      console.warn('ScreenShare signal listener error:', err);
    });

    return () => {
      unsubscribe();
    };
  }, [cleanRoomId, myId, getOrCreatePeerConnection, processPendingCandidates, onStreamReady]);

  // If user is a viewer/participant and the room has active screen sharing, request the stream from host
  useEffect(() => {
    if (isHost || !isScreenSharingActive || !cleanRoomId || !myId) return;

    const targetHost = hostId;
    if (!targetHost) return;

    // Send request to host
    const requestStream = async () => {
      try {
        setIsConnecting(true);
        await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
          from: myId,
          to: targetHost,
          type: 'screen-request',
          time: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Failed to send screen request:', err);
      }
    };

    if (!hasRequestedStreamRef.current) {
      hasRequestedStreamRef.current = true;
      requestStream();
    }

    const interval = setInterval(() => {
      // Periodic retry if still connecting after 5 seconds
      if (isConnecting) {
        requestStream();
      }
    }, 6000);

    return () => {
      clearInterval(interval);
      hasRequestedStreamRef.current = false;
    };
  }, [isHost, isScreenSharingActive, cleanRoomId, myId, hostId, isConnecting]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startSharing = async () => {
    setError(null);

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen sharing is not supported in this browser. Please use a desktop browser like Chrome or Edge.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { max: 30 },
        },
        audio: true
      });

      localStreamRef.current = stream;
      setIsSharing(true);
      if (onSharingStateChange) onSharingStateChange(true);
      if (onStreamReady) onStreamReady(stream);

      // Update room document in Firestore
      await updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isScreenSharing: true,
        screenHostId: myId
      }).catch(err => console.warn('Failed to update room screen state:', err));

      // Broadcast offers to all currently active users in the room
      const usersSnap = await getDocs(collection(db, `watchRooms/${cleanRoomId}/users`));
      for (const userDoc of usersSnap.docs) {
        const otherUserId = userDoc.id;
        if (otherUserId !== myId) {
          try {
            const pc = getOrCreatePeerConnection(otherUserId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
              from: myId,
              to: otherUserId,
              type: 'screen-offer',
              signal: JSON.stringify(offer),
              time: new Date().toISOString(),
            });
          } catch (offerErr) {
            console.warn(`Failed to send initial screen offer to ${otherUserId}:`, offerErr);
          }
        }
      }

      // Listen for when host stops sharing via browser bar
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopSharing();
        };
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      if (errorObj?.name !== 'NotAllowedError') {
        console.error('Error starting screen share:', err);
        setError('Failed to start screen share. Please grant screen recording permissions.');
      }
    }
  };

  const stopSharing = async () => {
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

    cleanup();
    setIsSharing(false);
    if (onSharingStateChange) onSharingStateChange(false);

    if (isHost && cleanRoomId) {
      updateDoc(doc(db, 'watchRooms', cleanRoomId), {
        isScreenSharing: false,
        screenHostId: null
      }).catch(() => {});
    }
  };

  // Re-request stream manual button for viewers
  const handleRefreshStream = async () => {
    if (!isHost && hostId && cleanRoomId) {
      setIsConnecting(true);
      await addDoc(collection(db, `watchRooms/${cleanRoomId}/signals`), {
        from: myId,
        to: hostId,
        type: 'screen-request',
        time: new Date().toISOString(),
      }).catch(() => {});
    }
  };

  if (!isHost) {
    if (isScreenSharingActive) {
      return (
        <button
          onClick={handleRefreshStream}
          title="Refresh screen share stream"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all"
        >
          <RefreshCw size={13} className={isConnecting ? 'animate-spin text-emerald-400' : ''} />
          <span className="hidden sm:inline">{isConnecting ? 'Connecting...' : 'Refresh Screen'}</span>
        </button>
      );
    }
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">
          <AlertCircle size={13} />
          <span className="max-w-[200px] truncate">{error}</span>
        </div>
      )}
      <button
        onClick={isSharing ? stopSharing : startSharing}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
          isSharing 
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
        }`}
      >
        {isSharing ? <MonitorOff size={14} /> : <Monitor size={14} />}
        <span>{isSharing ? 'Stop Screen Share' : 'Share Screen'}</span>
      </button>
    </div>
  );
};
