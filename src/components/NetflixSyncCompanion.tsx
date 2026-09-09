import React, { useState, useEffect } from 'react';
import { WatchRoom, NetflixRoomPlayback } from '../types';
import { ExtensionBridgeStatus } from '../hooks/useExtensionBridge';
import { 
  Play, 
  Pause, 
  RotateCw, 
  ExternalLink, 
  AlertCircle, 
  Sliders, 
  Clock, 
  RefreshCw,
  Info
} from 'lucide-react';

interface NetflixSyncCompanionProps {
  room: WatchRoom;
  isHost: boolean;
  extensionBridge: ExtensionBridgeStatus;
  onManualSync: () => void;
  syncDrift: number | null;
  isSynced: boolean;
  contentMismatch: boolean;
  autoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
  onToast: (msg: string) => void;
}

export const NetflixSyncCompanion: React.FC<NetflixSyncCompanionProps> = ({
  room,
  isHost,
  extensionBridge,
  onManualSync,
  syncDrift,
  isSynced,
  contentMismatch,
  autoSyncEnabled,
  onToggleAutoSync,
  onToast,
}) => {
  const [seekingTime, setSeekingTime] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const netflixPlayback: NetflixRoomPlayback | null = room.netflixPlayback || null;
  const isExtensionInstalled = extensionBridge.isExtensionInstalled;
  const netflixState = extensionBridge.netflixState;
  const isNetflixAvailable = netflixState.isAvailable;
  const localContent = netflixState.content;
  const localState = netflixState.state;

  // Expected position calculation for host
  const remoteTime = netflixPlayback?.position || room.currentTime || 0;
  const remoteUpdatedAt = netflixPlayback?.updatedAt || room.updatedAt || now;
  const isRemotePlaying = netflixPlayback ? netflixPlayback.status === 'playing' : room.playing;
  const expectedPosition = isRemotePlaying 
    ? Math.max(0, remoteTime + (now - remoteUpdatedAt) / 1000) 
    : remoteTime;

  const currentDisplayTime = isHost 
    ? (localState?.currentTime ?? expectedPosition)
    : (localState?.currentTime ?? expectedPosition);

  const duration = localState?.duration || 3600;

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const title = netflixPlayback?.contentTitle || localContent?.title || room.title;
  const contentId = netflixPlayback?.contentId || localContent?.id || '';
  const netflixWatchUrl = netflixPlayback?.rawUrl || (contentId ? `https://www.netflix.com/watch/${contentId}` : 'https://www.netflix.com');

  const handleHostPlayToggle = () => {
    if (!isHost) return;
    if (localState?.isPlaying) {
      extensionBridge.sendPlaybackControl('pause');
      onToast('Sent Pause command to your Netflix playback');
    } else {
      extensionBridge.sendPlaybackControl('play');
      onToast('Sent Play command to your Netflix playback');
    }
  };

  const handleHostSeek = (time: number) => {
    if (!isHost) return;
    extensionBridge.sendPlaybackControl('seek', time);
    setSeekingTime(null);
    onToast(`Seeked host Netflix playback to ${formatTime(time)}`);
  };

  return (
    <div className="w-full h-full bg-[#0a0a0a] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none">
      {/* Subtle background ambient graphic */}
      <div className="absolute inset-0 bg-gradient-to-tr from-red-950/20 via-black to-neutral-950 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Telemetry & State Badges */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-red-950/40 shrink-0">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
                Netflix Watch Party
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-xs font-bold text-gray-300">
                {isHost ? 'Host Authoritative Mode' : 'Participant Lockstep'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white line-clamp-1">
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Extension & Netflix Readiness status */}
          {!isExtensionInstalled ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertCircle size={13} />
              Extension Not Detected
            </span>
          ) : !isNetflixAvailable ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Clock size={13} />
              Waiting for Netflix Tab
            </span>
          ) : contentMismatch ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 border border-red-500/40 text-red-300 animate-pulse">
              <AlertCircle size={13} />
              Content Mismatch
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {isHost ? 'Broadcasting Playback' : isSynced ? 'Synchronized' : 'Sync Active'}
            </span>
          )}

          <a
            href={netflixWatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all shrink-0"
            title="Open Netflix Title in Browser"
          >
            <span>Open Netflix</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Main Center Stage */}
      <div className="relative z-10 my-auto py-6 sm:py-8 flex flex-col items-center text-center max-w-2xl mx-auto space-y-5">
        {/* Content Mismatch Warning Banner */}
        {contentMismatch && (
          <div className="w-full p-4 bg-red-950/40 border border-red-500/40 rounded-2xl text-left space-y-2">
            <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
              <AlertCircle size={15} />
              <span>Different Netflix Title Detected</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Your Netflix tab is playing a different title than the host. Synchronization is paused to avoid interrupting your playback.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
              <div className="text-gray-400">
                <div>Host title: <strong className="text-white">{title}</strong> {contentId ? `(ID: ${contentId})` : ''}</div>
                {localContent?.title && (
                  <div>Your title: <strong className="text-white">{localContent.title}</strong> (ID: {localContent.id})</div>
                )}
              </div>
              <a
                href={netflixWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-md shadow-red-950/40"
              >
                <span>Switch to Host's Title</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}

        {/* Extension Not Installed Guide */}
        {!isExtensionInstalled && (
          <div className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Info size={15} />
              <span>Synora Browser Extension Required</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Because Netflix operates under strict browser security and DRM, synchronization requires the lightweight Synora Chrome Extension to detect and coordinate playback across tabs.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => extensionBridge.requestPlaybackState()}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={13} /> Check Connection
              </button>
            </div>
          </div>
        )}

        {/* Center Display: Playback Status & Large Position Clock */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRemotePlaying ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
            <span className="text-xs font-black uppercase tracking-widest text-gray-300">
              {isRemotePlaying ? 'Host is Playing' : 'Host has Paused'}
            </span>
            {syncDrift !== null && (
              <span className="text-xs font-mono text-gray-400">
                (Drift: {syncDrift >= 0 ? '+' : ''}{syncDrift.toFixed(1)}s)
              </span>
            )}
          </div>

          <div className="text-4xl sm:text-6xl font-black tracking-tight text-white font-mono">
            {formatTime(seekingTime !== null ? seekingTime : currentDisplayTime)}
          </div>

          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {isHost
              ? 'You are authoritative. Play, pause, or seek your Netflix tab or use the controls below to synchronize all participants.'
              : 'Playback stays in lockstep with the host. You can click "Sync with Host" at any time if you fall behind.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {isHost ? (
            <button
              onClick={handleHostPlayToggle}
              disabled={!isNetflixAvailable}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-red-950/40 flex items-center gap-2"
            >
              {localState?.isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              <span>{localState?.isPlaying ? 'Pause Netflix' : 'Play Netflix'}</span>
            </button>
          ) : (
            <button
              onClick={onManualSync}
              disabled={!isNetflixAvailable || contentMismatch}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2"
            >
              <RotateCw size={18} />
              <span>Sync with Host</span>
            </button>
          )}

          {!isHost && (
            <button
              onClick={onToggleAutoSync}
              className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all border flex items-center gap-2 ${
                autoSyncEnabled 
                  ? 'bg-white/10 border-white/20 text-white' 
                  : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
              }`}
            >
              <Sliders size={14} />
              <span>Auto-Sync: {autoSyncEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Scrubber & Telemetry */}
      <div className="relative z-10 border-t border-white/5 pt-4 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
          <span>{formatTime(currentDisplayTime)}</span>
          <span className="text-[10px] text-gray-500 font-sans uppercase tracking-wider">
            {isHost ? 'Host Scrubber' : 'Lockstep Reference'}
          </span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Scrubber Range */}
        <input
          type="range"
          min="0"
          max={duration || 3600}
          step="1"
          value={seekingTime !== null ? seekingTime : currentDisplayTime}
          onChange={(e) => {
            if (isHost) setSeekingTime(parseFloat(e.target.value));
          }}
          onMouseUp={(e) => {
            if (isHost && seekingTime !== null) {
              handleHostSeek(parseFloat((e.target as HTMLInputElement).value));
            }
          }}
          onTouchEnd={(e) => {
            if (isHost && seekingTime !== null) {
              handleHostSeek(parseFloat((e.target as HTMLInputElement).value));
            }
          }}
          disabled={!isHost || !isNetflixAvailable}
          className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-600 disabled:cursor-not-allowed ${
            isHost ? 'hover:h-2 transition-all' : 'opacity-60'
          }`}
        />
      </div>
    </div>
  );
};
