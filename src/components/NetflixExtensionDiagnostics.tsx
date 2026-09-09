import React, { useState } from 'react';
import { useExtensionBridge } from '../hooks/useExtensionBridge';
import { Play, Pause, RotateCcw, RotateCw, Activity, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Terminal, MonitorPlay } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [customSeekSeconds, setCustomSeekSeconds] = useState<string>('30');
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

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Floating Toggle Button */}
      <button
        type="button"
        id="toggleNetflixDiagnosticsBtn"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/95 border border-emerald-500/40 text-white shadow-xl hover:bg-slate-800 transition-all text-xs font-semibold backdrop-blur-md"
      >
        <div className="relative flex items-center justify-center">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span
            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
              isPlayerActive
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : isExtensionInstalled
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }`}
          />
        </div>
        <span className="text-slate-200">Netflix Bridge</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400 border border-emerald-500/20">
          Phase 4
        </span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {/* Slide-out Diagnostic Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-12 right-0 w-[380px] max-w-[95vw] bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl p-4 text-slate-200 backdrop-blur-xl flex flex-col gap-3 font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Netflix Player Diagnostics</h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isExtensionInstalled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                {isExtensionInstalled ? `Bridge v${extensionVersion || '1.0'}` : 'Extension Offline'}
              </span>
            </div>

            {/* Extension Connection Status */}
            {!isExtensionInstalled ? (
              <div className="bg-rose-950/30 border border-rose-500/20 rounded-xl p-3 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2 text-rose-300 font-semibold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Synora Chrome Extension Not Detected</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Load <code className="bg-slate-900 px-1 py-0.5 rounded text-rose-200">extension/dist</code> as an Unpacked Extension in{' '}
                  <code className="bg-slate-900 px-1 py-0.5 rounded text-rose-200">chrome://extensions</code> to connect browser playback.
                </p>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={requestPlaybackState}
                    disabled={isChecking}
                    className="flex items-center gap-1 text-[11px] font-semibold text-rose-300 hover:text-rose-200"
                  >
                    <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                    <span>Retry Handshake</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Netflix Playback Status */
              <div className="flex flex-col gap-2.5">
                {/* Active Netflix Title Card */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Active Stream
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isBuffering
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : isPlaying
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : isPlayerActive
                          ? 'bg-slate-800 text-slate-300 border-slate-700'
                          : 'bg-slate-800/60 text-slate-400 border-slate-700/50'
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
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                        <span>ID: {netflixState.content?.id || '--'}</span>
                        {netflixState.content?.season && <span>S{netflixState.content.season}</span>}
                        {netflixState.content?.episode && <span>E{netflixState.content.episode}</span>}
                      </div>

                      {/* Progress Bar & Time */}
                      <div className="mt-2.5 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-emerald-400 font-bold">{formatDuration(currentTime)}</span>
                          <span className="text-slate-400">{formatDuration(duration)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 text-center flex flex-col items-center gap-1 text-slate-400 text-xs">
                      <p>No active Netflix playback stream detected.</p>
                      <span className="text-[11px] text-slate-400">
                        Open a video on <code className="text-slate-300">netflix.com/watch/:id</code>
                      </span>
                    </div>
                  )}

                  {/* Playback Controls */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={!isPlayerActive || isPlaying}
                      onClick={() => sendPlaybackControl('play')}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Play</span>
                    </button>

                    <button
                      type="button"
                      disabled={!isPlayerActive || !isPlaying}
                      onClick={() => sendPlaybackControl('pause')}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>

                    <button
                      type="button"
                      disabled={!isPlayerActive}
                      onClick={() => sendPlaybackControl('seek', Math.max(0, currentTime - 10))}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>-10s</span>
                    </button>

                    <button
                      type="button"
                      disabled={!isPlayerActive}
                      onClick={() => sendPlaybackControl('seek', duration > 0 ? Math.min(duration, currentTime + 10) : currentTime + 10)}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold"
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
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
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
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 disabled:opacity-40"
                    >
                      Seek to {customSeekSeconds}s
                    </button>
                    <button
                      type="button"
                      onClick={requestPlaybackState}
                      title="Refresh State"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Event & Diagnostic Log */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <Terminal className="w-3 h-3 text-slate-400" />
                      <span className="font-semibold text-slate-300">Diagnostic Event Log</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearLogs}
                      className="text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="h-28 overflow-y-auto font-mono text-[10px] flex flex-col gap-1 text-slate-400 pr-1">
                    {diagnosticLogs.length === 0 ? (
                      <span className="text-slate-400 italic">No bridge events logged yet.</span>
                    ) : (
                      diagnosticLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-1.5 leading-tight">
                          <span className="text-slate-400 flex-shrink-0">
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
                                : 'text-slate-300'
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
    </div>
  );
};
