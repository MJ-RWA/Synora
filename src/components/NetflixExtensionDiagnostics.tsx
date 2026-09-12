import React, { useState, useRef } from 'react';
import { useExtensionBridge } from '../hooks/useExtensionBridge';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  RefreshCw, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Terminal, 
  MonitorPlay, 
  X,
  GripVertical,
  RotateCcw as ResetIcon,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';

const BRIDGE_POS_KEY = 'synora_netflix_bridge_pos_v2';
const BRIDGE_MODE_KEY = 'synora_netflix_bridge_mode';

interface BridgePos {
  x: number;
  y: number;
}

function getInitialPosition(): BridgePos {
  try {
    const raw = localStorage.getItem(BRIDGE_POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    }
  } catch (err) {
    console.debug('Failed to parse bridge position:', err);
  }
  return { x: 0, y: 0 };
}

function getInitialMode(): 'compact' | 'pill' {
  try {
    const mode = localStorage.getItem(BRIDGE_MODE_KEY);
    if (mode === 'compact' || mode === 'pill') return mode;
  } catch (err) {
    console.debug('Failed to parse bridge mode:', err);
  }
  return 'pill';
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export const NetflixExtensionDiagnostics: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [mode, setMode] = useState<'compact' | 'pill'>(getInitialMode);
  const [position, setPosition] = useState<BridgePos>(getInitialPosition);
  const [customSeekSeconds, setCustomSeekSeconds] = useState<string>('30');
  
  const isDraggingRef = useRef(false);
  const dragStartTimeRef = useRef(0);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [anchorDirection, setAnchorDirection] = useState<{ vertical: 'up' | 'down'; horizontal: 'left' | 'right' }>({
    vertical: 'up',
    horizontal: 'right'
  });

  const {
    isExtensionInstalled,
    extensionVersion,
    netflixState,
    isChecking,
    diagnosticLogs,
    requestPlaybackState,
    sendPlaybackControl,
    clearLogs,
  } = useExtensionBridge();

  const isPlayerActive = netflixState.isAvailable && Boolean(netflixState.state);
  const currentTime = netflixState.state?.currentTime || 0;
  const duration = netflixState.state?.duration || 0;
  const isPlaying = netflixState.state?.isPlaying || false;
  const isBuffering = netflixState.state?.isBuffering || false;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  // Calculate panel placement relative to viewport
  const updateAnchorDirection = () => {
    if (badgeRef.current && typeof window !== 'undefined') {
      const rect = badgeRef.current.getBoundingClientRect();
      const isCloserToTop = rect.top < window.innerHeight / 2;
      const isCloserToLeft = rect.left < window.innerWidth / 2;
      setAnchorDirection({
        vertical: isCloserToTop ? 'down' : 'up',
        horizontal: isCloserToLeft ? 'left' : 'right'
      });
    }
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
    dragStartTimeRef.current = Date.now();
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newX = position.x + info.offset.x;
    const newY = position.y + info.offset.y;

    // Viewport boundary guard
    const maxShiftX = window.innerWidth * 0.9;
    const maxShiftY = window.innerHeight * 0.9;
    const clampedX = Math.max(-maxShiftX, Math.min(maxShiftX, newX));
    const clampedY = Math.max(-maxShiftY, Math.min(maxShiftY, newY));

    const nextPos = { x: clampedX, y: clampedY };
    setPosition(nextPos);
    updateAnchorDirection();

    try {
      localStorage.setItem(BRIDGE_POS_KEY, JSON.stringify(nextPos));
    } catch (err) {
      console.debug('Failed to save bridge position:', err);
    }

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current || Date.now() - dragStartTimeRef.current < 200) {
      return;
    }
    updateAnchorDirection();
    setIsOpen(prev => !prev);
  };

  const handleToggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMode = mode === 'compact' ? 'pill' : 'compact';
    setMode(nextMode);
    try {
      localStorage.setItem(BRIDGE_MODE_KEY, nextMode);
    } catch (err) {
      console.debug('Failed to save bridge mode:', err);
    }
  };

  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPosition({ x: 0, y: 0 });
    try {
      localStorage.removeItem(BRIDGE_POS_KEY);
    } catch (err) {
      console.debug('Failed to remove bridge position:', err);
    }
  };

  // Status indicators
  const statusColor = isPlayerActive
    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
    : isExtensionInstalled
    ? 'bg-amber-400'
    : 'bg-rose-500';

  const statusLabel = isPlayerActive
    ? 'Streaming'
    : isExtensionInstalled
    ? 'Ready'
    : 'Extension Offline';

  // Panel anchoring classes
  const panelVerticalClass = anchorDirection.vertical === 'up'
    ? 'bottom-full mb-3'
    : 'top-full mt-3';

  const panelHorizontalClass = anchorDirection.horizontal === 'right'
    ? 'right-0'
    : 'left-0';

  return (
    <div className="fixed bottom-24 right-4 sm:bottom-20 sm:right-6 md:bottom-8 md:right-8 z-50 pointer-events-none select-none">
      <motion.div
        ref={badgeRef}
        drag
        dragMomentum={false}
        dragElastic={0.08}
        animate={{ x: position.x, y: position.y }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="pointer-events-auto relative inline-flex flex-col items-end cursor-grab active:cursor-grabbing"
      >
        {/* Floating Movable Badge */}
        {mode === 'compact' ? (
          <motion.div
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="group relative flex items-center"
          >
            <button
              type="button"
              id="netflix-bridge-compact-btn"
              onClick={handleToggleClick}
              title="Netflix Bridge (Drag anywhere to move • Click to inspect)"
              aria-label="Netflix Bridge status"
              className="relative w-11 h-11 rounded-2xl bg-zinc-950/95 border border-red-500/40 hover:border-red-500 text-white shadow-2xl backdrop-blur-xl flex items-center justify-center transition-all group-hover:scale-105 active:scale-95 group-hover:shadow-red-950/50"
            >
              {/* Netflix 'N' emblem */}
              <div className="w-5 h-5 rounded bg-gradient-to-b from-red-600 to-red-700 flex items-center justify-center font-black text-white text-xs tracking-tighter shadow-inner">
                N
              </div>

              {/* Status pulse dot */}
              <span
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-950 ${statusColor}`}
              />
            </button>

            {/* Quick expand button on hover */}
            <button
              type="button"
              onClick={handleToggleMode}
              title="Expand to label mode"
              aria-label="Expand Netflix Bridge label"
              className="absolute -left-6 top-2.5 p-1 rounded-full bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Maximize2 className="w-2.5 h-2.5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="group relative flex items-center"
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-zinc-950/95 border border-red-500/40 hover:border-red-500/70 text-white shadow-2xl backdrop-blur-xl transition-all group-hover:shadow-red-950/40">
              {/* Drag Handle Indicator */}
              <div 
                className="text-zinc-500 hover:text-zinc-300 pr-0.5"
                title="Drag to reposition anywhere"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              {/* Main button to toggle panel */}
              <button
                type="button"
                id="netflix-bridge-pill-btn"
                onClick={handleToggleClick}
                className="flex items-center gap-2 text-xs font-semibold text-left focus:outline-none"
                title="Netflix Bridge (Drag to move • Click to inspect)"
              >
                {/* Netflix emblem with status dot */}
                <div className="relative flex items-center justify-center">
                  <div className="w-4 h-4 rounded bg-gradient-to-b from-red-600 to-red-700 flex items-center justify-center font-black text-white text-[10px] tracking-tighter">
                    N
                  </div>
                  <span
                    className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-zinc-950 ${statusColor}`}
                  />
                </div>

                <span className="text-zinc-200 font-bold whitespace-nowrap">
                  Netflix Bridge
                </span>

                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-zinc-300 border border-zinc-800">
                  {statusLabel}
                </span>

                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              {/* Minimize mode toggle button */}
              <button
                type="button"
                onClick={handleToggleMode}
                title="Minimize into compact icon"
                aria-label="Minimize into compact icon"
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors ml-1"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Slide-out Diagnostic & Control Panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: anchorDirection.vertical === 'up' ? 12 : -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: anchorDirection.vertical === 'up' ? 12 : -12, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className={`absolute ${panelVerticalClass} ${panelHorizontalClass} w-[380px] max-w-[92vw] bg-zinc-950/95 border border-zinc-800 rounded-3xl shadow-2xl p-4 text-zinc-200 backdrop-blur-2xl flex flex-col gap-3 font-sans max-h-[78vh] overflow-y-auto cursor-default z-50`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-red-600 flex items-center justify-center font-black text-white text-[11px] tracking-tighter">
                    N
                  </div>
                  <h3 className="font-bold text-sm text-white">Netflix Player Bridge</h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isExtensionInstalled
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {isExtensionInstalled ? `v${extensionVersion || '1.0'}` : 'Offline'}
                  </span>

                  {/* Reset Position Button */}
                  {(position.x !== 0 || position.y !== 0) && (
                    <button
                      type="button"
                      onClick={handleResetPosition}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Reset badge position to default"
                      aria-label="Reset position"
                    >
                      <ResetIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Close Panel Button */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    aria-label="Close diagnostics"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Movable hint */}
              <div className="text-[11px] text-zinc-400 bg-zinc-900/60 rounded-xl px-2.5 py-1.5 border border-zinc-800/60 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <GripVertical className="w-3 h-3 text-zinc-500" />
                  Tip: Drag the icon anywhere on screen to clear reading space
                </span>
                {(position.x !== 0 || position.y !== 0) && (
                  <button
                    type="button"
                    onClick={handleResetPosition}
                    className="text-red-400 hover:text-red-300 text-[10px] font-semibold underline underline-offset-2 ml-2"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Extension Connection Status */}
              {!isExtensionInstalled ? (
                <div className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-3.5 text-xs flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-rose-300 font-semibold">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Synora Extension Not Detected</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Install the Synora Chrome Extension to link Netflix playback with watch parties across all browsers.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={requestPlaybackState}
                      disabled={isChecking}
                      className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                      <span>Retry Handshake</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Netflix Playback Status */
                <div className="flex flex-col gap-2.5">
                  {/* Active Netflix Title Card */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Active Stream
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isBuffering
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : isPlaying
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : isPlayerActive
                            ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50'
                        }`}
                      >
                        {isBuffering ? 'Buffering' : isPlaying ? 'Playing' : isPlayerActive ? 'Paused' : 'Idle / Inactive'}
                      </span>
                    </div>

                    {isPlayerActive ? (
                      <div>
                        <div className="text-sm font-semibold text-white truncate">
                          {netflixState.content?.title || 'Active Netflix Video'}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5 font-mono">
                          <span>ID: {netflixState.content?.id || '--'}</span>
                          {netflixState.content?.season && <span>S{netflixState.content.season}</span>}
                          {netflixState.content?.episode && <span>E{netflixState.content.episode}</span>}
                        </div>

                        {/* Progress Bar & Time */}
                        <div className="mt-2.5 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-emerald-400 font-bold">{formatDuration(currentTime)}</span>
                            <span className="text-zinc-400">{formatDuration(duration)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center flex flex-col items-center gap-1 text-zinc-400 text-xs">
                        <MonitorPlay className="w-5 h-5 text-zinc-600 mb-1" />
                        <p>No active Netflix playback stream detected.</p>
                        <span className="text-[11px] text-zinc-400">
                          Open a video on <code className="text-zinc-300">netflix.com/watch/:id</code>
                        </span>
                      </div>
                    )}

                    {/* Playback Controls */}
                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-zinc-800/80">
                      <button
                        type="button"
                        disabled={!isPlayerActive || isPlaying}
                        onClick={() => sendPlaybackControl('play')}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Play</span>
                      </button>

                      <button
                        type="button"
                        disabled={!isPlayerActive || !isPlaying}
                        onClick={() => sendPlaybackControl('pause')}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>

                      <button
                        type="button"
                        disabled={!isPlayerActive}
                        onClick={() => sendPlaybackControl('seek', Math.max(0, currentTime - 10))}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>-10s</span>
                      </button>

                      <button
                        type="button"
                        disabled={!isPlayerActive}
                        onClick={() => sendPlaybackControl('seek', duration > 0 ? Math.min(duration, currentTime + 10) : currentTime + 10)}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold transition-colors"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>+10s</span>
                      </button>
                    </div>

                    {/* Manual Seek Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="0"
                        max={duration || 7200}
                        value={customSeekSeconds}
                        onChange={(e) => setCustomSeekSeconds(e.target.value)}
                        placeholder="Seconds"
                        className="w-20 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                      />
                      <button
                        type="button"
                        disabled={!isPlayerActive || !customSeekSeconds}
                        onClick={() => {
                          const target = parseFloat(customSeekSeconds);
                          if (!isNaN(target)) {
                            sendPlaybackControl('seek', target);
                          }
                        }}
                        className="flex-1 py-1 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 disabled:opacity-40 transition-colors"
                      >
                        Seek to {customSeekSeconds}s
                      </button>
                      <button
                        type="button"
                        onClick={requestPlaybackState}
                        title="Refresh State"
                        className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Event & Diagnostic Log */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Terminal className="w-3 h-3 text-zinc-400" />
                        <span className="font-semibold text-zinc-300">Diagnostic Event Log</span>
                      </div>
                      <button
                        type="button"
                        onClick={clearLogs}
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="h-24 overflow-y-auto font-mono text-[10px] flex flex-col gap-1 text-zinc-400 pr-1">
                      {diagnosticLogs.length === 0 ? (
                        <span className="text-zinc-400 italic">No bridge events logged yet.</span>
                      ) : (
                        diagnosticLogs.map((log) => (
                          <div key={log.id} className="flex items-start gap-1.5 leading-tight">
                            <span className="text-zinc-400 flex-shrink-0">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span
                              className={
                                log.type === 'success'
                                  ? 'text-emerald-400'
                                  : log.type === 'warn'
                                  ? 'text-amber-400'
                                  : log.type === 'error'
                                  ? 'text-rose-400'
                                  : 'text-zinc-300'
                              }
                            >
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
