import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export const SYNORA_PWA_MESSAGE_SOURCE = 'SYNORA_WATCH_PARTY_PWA';
export const SYNORA_EXTENSION_MESSAGE_SOURCE = 'SYNORA_EXTENSION';

export interface PlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  timestamp: number;
}

export interface ContentIdentity {
  site: string;
  id: string;
  title?: string;
  season?: number;
  episode?: number;
  rawUrl: string;
}

export interface NetflixPlaybackBridgeState {
  isAvailable: boolean;
  state: PlaybackState | null;
  content: ContentIdentity | null;
  lastUpdated: number;
}

export interface ExtensionBridgeStatus {
  isExtensionInstalled: boolean;
  extensionVersion: string | null;
  netflixState: NetflixPlaybackBridgeState;
  isChecking: boolean;
  connectedRoomId: string | null;
  diagnosticLogs: Array<{ id: string; timestamp: number; message: string; type: 'info' | 'success' | 'warn' | 'error' }>;
  requestPlaybackState: () => void;
  sendPlaybackControl: (action: 'play' | 'pause' | 'seek', time?: number) => void;
  joinRoomWithExtension: (roomId: string, roomTitle?: string, isHost?: boolean) => void;
  leaveRoomWithExtension: (roomId?: string) => void;
  clearLogs: () => void;
}

/**
 * useExtensionBridge Hook
 * Connects the Synora Watch Party PWA to the Chrome Extension bridge via window.postMessage
 */
export function useExtensionBridge(): ExtensionBridgeStatus {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean>(false);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [connectedRoomId, setConnectedRoomId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  const [netflixState, setNetflixState] = useState<NetflixPlaybackBridgeState>({
    isAvailable: false,
    state: null,
    content: null,
    lastUpdated: 0,
  });

  const [diagnosticLogs, setDiagnosticLogs] = useState<
    Array<{ id: string; timestamp: number; message: string; type: 'info' | 'success' | 'warn' | 'error' }>
  >([]);

  const addLog = useCallback(
    (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        message,
        type,
      };
      setDiagnosticLogs((prev) => [entry, ...prev].slice(0, 50));
    },
    []
  );
  const addLogRef = useRef(addLog);
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  const lastLoggedStateRef = useRef<{
    isPlaying?: boolean;
    isBuffering?: boolean;
    contentId?: string;
    isAvailable?: boolean;
  }>({});

  const handshakeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper for secure target origin
  const getTargetOrigin = () => {
    return typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : '*';
  };

  // Request latest playback state from extension
  const requestPlaybackState = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.postMessage(
      {
        source: SYNORA_PWA_MESSAGE_SOURCE,
        type: 'SYNORA_GET_PLAYBACK_STATE',
      },
      getTargetOrigin()
    );
  }, []);

  // Send playback control commands (play, pause, seek)
  const sendPlaybackControl = useCallback(
    (action: 'play' | 'pause' | 'seek', time?: number) => {
      if (typeof window === 'undefined') return;
      addLogRef.current(
        `Dispatching playback control '${action}'${time !== undefined ? ` at ${time.toFixed(1)}s` : ''} to extension`,
        'info'
      );
      window.postMessage(
        {
          source: SYNORA_PWA_MESSAGE_SOURCE,
          type: 'SYNORA_PLAYBACK_CONTROL',
          payload: {
            action,
            time,
          },
        },
        getTargetOrigin()
      );
    },
    []
  );

  // Send room join notification to extension
  const joinRoomWithExtension = useCallback(
    (roomId: string, roomTitle?: string, isHost = false) => {
      if (typeof window === 'undefined') return;
      addLogRef.current(`Notifying extension of room join: ${roomId}`, 'info');
      window.postMessage(
        {
          source: SYNORA_PWA_MESSAGE_SOURCE,
          type: 'SYNORA_ROOM_JOIN',
          payload: {
            roomId,
            roomTitle,
            isHost,
          },
        },
        getTargetOrigin()
      );
    },
    []
  );

  // Send room leave notification to extension
  const leaveRoomWithExtension = useCallback(
    (roomId?: string) => {
      if (typeof window === 'undefined') return;
      addLogRef.current('Notifying extension of room leave', 'info');
      window.postMessage(
        {
          source: SYNORA_PWA_MESSAGE_SOURCE,
          type: 'SYNORA_ROOM_LEAVE',
          payload: {
            roomId,
          },
        },
        getTargetOrigin()
      );
    },
    []
  );

  const clearLogs = useCallback(() => {
    setDiagnosticLogs([]);
  }, []);

  // Listen for extension responses and broadcast messages
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.source !== window ||
        !event.data ||
        event.data.source !== SYNORA_EXTENSION_MESSAGE_SOURCE
      ) {
        return;
      }

      const { type, payload } = event.data;

      switch (type) {
        case 'SYNORA_HANDSHAKE_RESPONSE': {
          setIsExtensionInstalled(true);
          setExtensionVersion(payload.extensionVersion || '1.0.0');
          setConnectedRoomId(payload.connectedRoomId || null);
          setIsChecking(false);
          addLogRef.current(
            `Synora Chrome Extension connected (v${payload.extensionVersion})`,
            'success'
          );
          // Request initial playback state once connected
          requestPlaybackState();
          break;
        }

        case 'SYNORA_PLAYBACK_STATE': {
          const { isAvailable, state, content } = payload;
          setNetflixState((prev) => {
            const sameAvail = prev.isAvailable === Boolean(isAvailable);
            const samePlay = prev.state?.isPlaying === state?.isPlaying;
            const sameBuffer = prev.state?.isBuffering === state?.isBuffering;
            const sameContent = prev.content?.id === content?.id;
            const timeDiff = Math.abs((prev.state?.currentTime || 0) - (state?.currentTime || 0));

            // Avoid recreating state object on redundant ticks if unchanged and drift < 0.25s
            if (sameAvail && samePlay && sameBuffer && sameContent && timeDiff < 0.25) {
              return prev;
            }

            return {
              isAvailable: Boolean(isAvailable),
              state: state || null,
              content: content || null,
              lastUpdated: Date.now(),
            };
          });

          // Only log state transitions to avoid re-render storms on every 500ms time tick
          const lastLogged = lastLoggedStateRef.current;
          const statusChanged =
            lastLogged.isAvailable !== Boolean(isAvailable) ||
            lastLogged.isPlaying !== state?.isPlaying ||
            lastLogged.isBuffering !== state?.isBuffering ||
            lastLogged.contentId !== content?.id;

          if (statusChanged) {
            lastLoggedStateRef.current = {
              isAvailable: Boolean(isAvailable),
              isPlaying: state?.isPlaying,
              isBuffering: state?.isBuffering,
              contentId: content?.id,
            };

            if (isAvailable && state) {
              const timeStr = `${Math.floor(state.currentTime)}s / ${Math.floor(state.duration)}s`;
              const statusStr = state.isBuffering ? 'buffering' : state.isPlaying ? 'playing' : 'paused';
              addLogRef.current(
                `Netflix [${statusStr}]: ${content?.title || 'Video'} (${timeStr})`,
                'info'
              );
            } else if (isAvailable) {
              addLogRef.current('Netflix watch page detected (waiting for player load)', 'warn');
            } else {
              addLogRef.current('Netflix playback inactive or no video element active', 'info');
            }
          }
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Initial handshake ping
    const sendHandshake = () => {
      window.postMessage(
        {
          source: SYNORA_PWA_MESSAGE_SOURCE,
          type: 'SYNORA_HANDSHAKE_REQUEST',
          payload: {
            appVersion: '1.0.0',
          },
        },
        getTargetOrigin()
      );
    };

    sendHandshake();

    // Re-attempt handshake 3 times in first few seconds in case content script was starting
    let attempts = 0;
    handshakeTimerRef.current = setInterval(() => {
      attempts += 1;
      if (attempts >= 3) {
        if (handshakeTimerRef.current) {
          clearInterval(handshakeTimerRef.current);
          handshakeTimerRef.current = null;
        }
        setIsChecking(false);
      } else {
        sendHandshake();
      }
    }, 1200);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (handshakeTimerRef.current) {
        clearInterval(handshakeTimerRef.current);
        handshakeTimerRef.current = null;
      }
    };
  }, [requestPlaybackState]);

  return useMemo(
    () => ({
      isExtensionInstalled,
      extensionVersion,
      netflixState,
      isChecking,
      connectedRoomId,
      diagnosticLogs,
      requestPlaybackState,
      sendPlaybackControl,
      joinRoomWithExtension,
      leaveRoomWithExtension,
      clearLogs,
    }),
    [
      isExtensionInstalled,
      extensionVersion,
      netflixState,
      isChecking,
      connectedRoomId,
      diagnosticLogs,
      requestPlaybackState,
      sendPlaybackControl,
      joinRoomWithExtension,
      leaveRoomWithExtension,
      clearLogs,
    ]
  );
}
