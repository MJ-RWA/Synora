import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, AlertCircle, RefreshCw } from 'lucide-react';

interface YouTubeSyncPlayerProps {
  videoId: string;
  isHost: boolean;
  roomPlaying?: boolean;
  roomCurrentTime?: number;
  roomUpdatedAt?: number;
  playing?: boolean;
  currentTime?: number;
  updatedAt?: number;
  onPlaybackChange?: (playing: boolean, time: number) => void;
  onHostPlaybackChange?: (playing: boolean, time: number) => void;
  onSyncReady?: (syncFn: () => void) => void;
  isRemoteSyncRef?: React.MutableRefObject<boolean>;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  destroy: () => void;
}

export const YouTubeSyncPlayer: React.FC<YouTubeSyncPlayerProps> = ({
  videoId,
  isHost,
  roomPlaying,
  roomCurrentTime,
  roomUpdatedAt,
  playing,
  currentTime,
  updatedAt,
  onPlaybackChange,
  onHostPlaybackChange,
  onSyncReady
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAutoplayMuted, setIsAutoplayMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const playerId = `yt-player-${videoId}`;

  const onPlaybackChangeRef = useRef(onPlaybackChange);
  const onHostPlaybackChangeRef = useRef(onHostPlaybackChange);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    onPlaybackChangeRef.current = onPlaybackChange;
    onHostPlaybackChangeRef.current = onHostPlaybackChange;
    isHostRef.current = isHost;
  });

  const effectivePlaying = Boolean(roomPlaying ?? playing);
  const effectiveCurrentTime = roomCurrentTime ?? currentTime ?? 0;
  const effectiveUpdatedAt = roomUpdatedAt ?? updatedAt ?? 0;

  const playbackRef = useRef({
    playing: effectivePlaying,
    currentTime: effectiveCurrentTime,
    updatedAt: effectiveUpdatedAt
  });

  useEffect(() => {
    playbackRef.current = {
      playing: effectivePlaying,
      currentTime: effectiveCurrentTime,
      updatedAt: effectiveUpdatedAt
    };
  }, [effectivePlaying, effectiveCurrentTime, effectiveUpdatedAt]);

  const handlePlaybackChange = useCallback((isPlayingState: boolean, time: number) => {
    setIsPlaying(isPlayingState);
    if (typeof onPlaybackChangeRef.current === 'function') {
      onPlaybackChangeRef.current(isPlayingState, time);
    } else if (typeof onHostPlaybackChangeRef.current === 'function') {
      onHostPlaybackChangeRef.current(isPlayingState, time);
    }
  }, []);

  // Manual Sync function exposed to parent
  const executeSync = useCallback(() => {
    if (!playerRef.current || !isPlayerReady) return;
    const player = playerRef.current;
    if (typeof player.seekTo !== 'function') return;

    const now = Date.now();
    const { playing: p, currentTime: c, updatedAt: u } = playbackRef.current;
    const referenceTime = u > 0 ? u : now;
    const elapsed = Math.max(0, (now - referenceTime) / 1000);
    const expectedTime = p ? (c || 0) + elapsed : (c || 0);

    isApplyingRemoteRef.current = true;
    try {
      player.seekTo(expectedTime, true);
      if (p) {
        if (typeof player.playVideo === 'function') player.playVideo();
        setIsPlaying(true);
      } else {
        if (typeof player.pauseVideo === 'function') player.pauseVideo();
        setIsPlaying(false);
      }
    } catch {
      try {
        if (typeof player.mute === 'function') player.mute();
        if (typeof player.playVideo === 'function') player.playVideo();
        setIsMuted(true);
        setIsAutoplayMuted(true);
        setIsPlaying(true);
      } catch {
        // ignore
      }
    }
    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 1200);
  }, [isPlayerReady]);

  const onSyncReadyRef = useRef(onSyncReady);
  useEffect(() => {
    onSyncReadyRef.current = onSyncReady;
  }, [onSyncReady]);

  useEffect(() => {
    if (onSyncReadyRef.current) {
      onSyncReadyRef.current(executeSync);
    }
  }, [executeSync]);

  const togglePlay = () => {
    if (!playerRef.current || !isPlayerReady) return;
    const player = playerRef.current;
    if (typeof player.getCurrentTime !== 'function') return;
    const curTime = (() => {
      try {
        return player.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    })();

    if (isPlaying) {
      try {
        if (typeof player.pauseVideo === 'function') player.pauseVideo();
      } catch {
        // ignore
      }
      setIsPlaying(false);
      if (isHostRef.current) {
        handlePlaybackChange(false, curTime);
      }
    } else {
      try {
        if (typeof player.playVideo === 'function') player.playVideo();
        setIsPlaying(true);
      } catch {
        try {
          if (typeof player.mute === 'function') player.mute();
          if (typeof player.playVideo === 'function') player.playVideo();
          setIsMuted(true);
          setIsAutoplayMuted(true);
          setIsPlaying(true);
        } catch {
          // ignore
        }
      }
      if (isHostRef.current) {
        handlePlaybackChange(true, curTime);
      }
    }
  };

  const handleUnmute = () => {
    if (!playerRef.current || !isPlayerReady) return;
    try {
      if (typeof playerRef.current.unMute === 'function') {
        playerRef.current.unMute();
      }
      if (typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(80);
      }
      setIsMuted(false);
      setIsAutoplayMuted(false);
    } catch (e) {
      console.warn("Unmute failed:", e);
    }
  };

  const toggleMute = () => {
    if (!playerRef.current || !isPlayerReady) return;
    if (isMuted) {
      handleUnmute();
    } else {
      try {
        if (typeof playerRef.current.mute === 'function') {
          playerRef.current.mute();
        }
      } catch {
        // ignore
      }
      setIsMuted(true);
    }
  };

  // Load YouTube Iframe API if not present and create player ONCE per videoId
  useEffect(() => {
    let isCancelled = false;
    let pollInterval: NodeJS.Timeout | null = null;
    const initPlayer = () => {
      if (isCancelled || !containerRef.current || !window.YT || !window.YT.Player) return;
      setErrorMessage(null);

      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch {
          // ignore
        }
        playerRef.current = null;
      }

      try {
        playerRef.current = new window.YT.Player(playerId, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1
          },
          events: {
            onReady: (event) => {
              if (isCancelled) return;
              playerRef.current = event.target;
              setIsPlayerReady(true);
              const now = Date.now();
              const { playing: p, currentTime: c, updatedAt: u } = playbackRef.current;
              const referenceTime = u > 0 ? u : now;
              const elapsed = Math.max(0, (now - referenceTime) / 1000);
              const expectedTime = p ? (c || 0) + elapsed : (c || 0);

              isApplyingRemoteRef.current = true;
              if (expectedTime > 0 && typeof event.target.seekTo === 'function') {
                try {
                  event.target.seekTo(expectedTime, true);
                } catch {
                  // ignore
                }
              }

              // Always attempt playback if room is playing or by default for host
              if (p || isHostRef.current) {
                try {
                  if (typeof event.target.playVideo === 'function') event.target.playVideo();
                  setIsPlaying(true);
                } catch {
                  // If browser blocks unmuted playback, mute and play
                  try {
                    if (typeof event.target.mute === 'function') event.target.mute();
                    if (typeof event.target.playVideo === 'function') event.target.playVideo();
                    setIsMuted(true);
                    setIsAutoplayMuted(true);
                    setIsPlaying(true);
                  } catch {
                    // ignore
                  }
                }
              } else {
                try {
                  if (typeof event.target.pauseVideo === 'function') event.target.pauseVideo();
                } catch {
                  // ignore
                }
                setIsPlaying(false);
              }

              setTimeout(() => {
                isApplyingRemoteRef.current = false;
              }, 1200);
            },
            onStateChange: (event) => {
              if (isCancelled) return;
              const state = event.data;

              // Ignore state changes while applying remote sync
              if (isApplyingRemoteRef.current) return;

              if (state === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                if (isHostRef.current) {
                  const curPos = typeof event.target.getCurrentTime === 'function' ? event.target.getCurrentTime() : 0;
                  handlePlaybackChange(true, curPos);
                }
              } else if (state === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                if (isHostRef.current) {
                  const curPos = typeof event.target.getCurrentTime === 'function' ? event.target.getCurrentTime() : 0;
                  handlePlaybackChange(false, curPos);
                }
              }
            },
            onError: (event) => {
              console.warn("YouTube player error event code:", event.data);
              if (event.data === 101 || event.data === 150) {
                setErrorMessage("The owner of this YouTube video does not allow embedded streaming in third-party apps.");
              } else if (event.data === 2) {
                setErrorMessage("Invalid YouTube video ID or URL.");
              } else {
                setErrorMessage("Playback error encountered from YouTube.");
              }
            }
          }
        });
      } catch (err) {
        console.error("Failed to initialize YouTube Player:", err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Ensure script tag exists
      if (!document.getElementById('youtube-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // Poll until window.YT.Player is available (safe against race conditions)
      pollInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          if (pollInterval) clearInterval(pollInterval);
          initPlayer();
        }
      }, 150);
    }

    return () => {
      isCancelled = true;
      setIsPlayerReady(false);
      if (pollInterval) clearInterval(pollInterval);
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId, playerId, handlePlaybackChange]);

  // Sync participant playback with authoritative room state
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || isHostRef.current) return;

    const player = playerRef.current;
    if (typeof player.getCurrentTime !== 'function' || typeof player.getPlayerState !== 'function' || typeof player.seekTo !== 'function') {
      return;
    }

    // Skip if actively applying a recent sync
    if (isApplyingRemoteRef.current) return;

    const now = Date.now();
    const referenceTime = effectiveUpdatedAt > 0 ? effectiveUpdatedAt : now;
    const elapsed = Math.max(0, (now - referenceTime) / 1000);
    const expectedTime = effectivePlaying ? (effectiveCurrentTime || 0) + elapsed : (effectiveCurrentTime || 0);

    const currentActualTime = (() => {
      try {
        return player.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    })();
    const drift = Math.abs(currentActualTime - expectedTime);

    // Only seek on significant drift (> 3.5s) to avoid playback jitter
    if (drift > 3.5) {
      isApplyingRemoteRef.current = true;
      try {
        player.seekTo(expectedTime, true);
      } catch {
        // ignore
      }
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 1200);
    }

    const state = (() => {
      try {
        return player.getPlayerState();
      } catch {
        return -1;
      }
    })();

    // Avoid issuing play while buffering
    if (effectivePlaying && state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
      isApplyingRemoteRef.current = true;
      try {
        if (typeof player.playVideo === 'function') player.playVideo();
      } catch {
        try {
          if (typeof player.mute === 'function') player.mute();
          if (typeof player.playVideo === 'function') player.playVideo();
          setTimeout(() => {
            setIsMuted(true);
            setIsAutoplayMuted(true);
          }, 0);
        } catch {
          // ignore
        }
      }
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 1200);
    } else if (!effectivePlaying && state === window.YT.PlayerState.PLAYING) {
      isApplyingRemoteRef.current = true;
      try {
        if (typeof player.pauseVideo === 'function') player.pauseVideo();
      } catch {
        // ignore
      }
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 1200);
    }
  }, [isPlayerReady, effectivePlaying, effectiveCurrentTime, effectiveUpdatedAt]);

  // Periodic heartbeat sync for Host while playing
  useEffect(() => {
    if (!isHost || !isPlayerReady || !playerRef.current) return;

    const interval = setInterval(() => {
      if (playerRef.current && !isApplyingRemoteRef.current) {
        const player = playerRef.current;
        if (typeof player.getPlayerState === 'function' && typeof player.getCurrentTime === 'function') {
          try {
            const state = player.getPlayerState();
            if (state === window.YT.PlayerState.PLAYING) {
              const curPos = player.getCurrentTime();
              if (typeof curPos === 'number' && !isNaN(curPos)) {
                handlePlaybackChange(true, curPos);
              }
            }
          } catch (e) {
            console.warn("Heartbeat sync error:", e);
          }
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isHost, isPlayerReady, handlePlaybackChange]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black group">
      {/* YouTube Iframe Host element */}
      <div id={playerId} className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0" />

      {/* Unmute prompt badge if browser blocked sound */}
      {isAutoplayMuted && (
        <button
          onClick={handleUnmute}
          className="absolute top-4 left-4 z-20 px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 backdrop-blur-md transition-all animate-bounce"
        >
          <VolumeX size={16} />
          <span>Click to Unmute Audio</span>
        </button>
      )}

      {/* Error Message Overlay */}
      {errorMessage && (
        <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <AlertCircle size={36} className="text-amber-400" />
          <p className="text-white font-bold text-sm max-w-md">{errorMessage}</p>
          <p className="text-xs text-gray-400">Please choose another video or paste a direct .mp4 or .m3u8 link.</p>
        </div>
      )}

      {/* Floating Interactive Quick Bar (Overlay controls for sync) */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-3 px-4 py-2 bg-black/70 backdrop-blur-md rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={toggleMute}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={18} className="text-amber-400" /> : <Volume2 size={18} />}
          </button>
          <span className="text-[11px] font-semibold text-gray-300">
            {isHost ? 'Host Controls Active' : 'Synced with Room'}
          </span>
        </div>

        {!isHost && (
          <button
            onClick={executeSync}
            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={12} /> Sync
          </button>
        )}
      </div>
    </div>
  );
};
