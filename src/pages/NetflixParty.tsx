import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Tv, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw, 
  Cpu, 
  Layers, 
  Play
} from 'lucide-react';
import { WatchPartyModal } from '../components/WatchPartyModal';
import { useExtensionBridge } from '../hooks/useExtensionBridge';

export const NetflixParty: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const extensionBridge = useExtensionBridge();

  return (
    <div className="min-h-screen pb-24 text-white">
      {/* Top Banner / Hero */}
      <section className="relative overflow-hidden pt-12 pb-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-black uppercase tracking-widest">
            <Tv size={14} /> Synora Companion Bridge
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
            Watch Netflix Together
          </h1>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            Synchronize your favorite Netflix shows and movies with friends in real time, keeping your account private and DRM secure.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2"
            >
              <Sparkles size={14} /> Start Netflix Room
            </button>
            <Link
              to="/how-it-works"
              className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-2"
            >
              <Cpu size={14} className="text-emerald-400" /> How Synora Works Under The Hood
            </Link>
          </div>
        </div>
      </section>

      {/* Extension Bridge Live Status Banner */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="p-4 sm:p-6 bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-3.5 h-3.5 rounded-full ${
              extensionBridge.isConnected ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-amber-500/80 animate-pulse'
            }`} />
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                Bridge Status: {extensionBridge.isConnected ? 'Extension Connected & Ready' : 'Looking for Extension Bridge'}
              </div>
              <p className="text-xs text-gray-400">
                {extensionBridge.isConnected 
                  ? 'Your browser companion is connected and ready to send & receive sync signals.'
                  : 'Install the companion extension locally to unlock synchronized Netflix controls.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => extensionBridge.pingExtension()}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw size={13} className={extensionBridge.isPinging ? 'animate-spin' : ''} />
            Check Connection
          </button>
        </div>
      </section>

      {/* 5-Step Visual Walkthrough */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-zinc-900/90 via-black to-zinc-950/90 border border-white/10 p-8 sm:p-12 shadow-2xl space-y-10">
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black uppercase tracking-wider">
              Step-by-Step Setup
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">
              How to Watch Netflix Together with Friends
            </h2>
            <p className="text-sm text-gray-400 mt-2 max-w-2xl">
              Setting up takes under a minute. Once the extension is loaded, playback controls stay synchronized automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">01</span>
              <h4 className="text-sm font-bold text-white">Build Extension</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Run <code className="text-emerald-400 bg-black/40 px-1 py-0.5 rounded text-[10px]">npm run build:extension</code> in the project root to generate the production manifest bundle in <code className="text-gray-300">extension/dist</code>.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">02</span>
              <h4 className="text-sm font-bold text-white">Load in Chrome</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Open <code className="text-gray-300">chrome://extensions</code>, enable <strong>Developer mode</strong>, and click <strong>Load unpacked</strong> selecting the <code className="text-emerald-400">extension/dist</code> directory.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">03</span>
              <h4 className="text-sm font-bold text-white">Open Netflix</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                In another browser tab, log into your own Netflix account and navigate to the show or film you want to watch with friends.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">04</span>
              <h4 className="text-sm font-bold text-white">Create Party</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Click <strong>Start Netflix Room</strong> on Synora, paste your Netflix URL or title, and send the room invite link to your group.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">05</span>
              <h4 className="text-sm font-bold text-white">Watch in Sync</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Whenever the host plays, pauses, or scrubs, the extension syncs everyone's local Netflix player seamlessly in real time.
              </p>
            </div>
          </div>

          {/* Privacy Guarantee Banner */}
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={26} />
            </div>
            <div className="text-xs leading-relaxed text-gray-300 space-y-1">
              <div className="font-bold text-white text-sm">100% Privacy-Preserving Guarantee</div>
              <div>
                Synora never asks for or collects Netflix passwords, cookies, or DRM keys. All video playback occurs strictly within your own authorized Netflix session in your personal browser tab. Synora never streams or proxies protected video through its servers.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold">
              <Play size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Independent High Definition</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Because video streams straight from Netflix's servers directly to each viewer's tab, everyone experiences pure 1080p or 4K HDR quality with their preferred subtitles and audio tracks.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <RefreshCw size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Smart Scrub & Seek Sync</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Skipping intro or scrubbing backward to rewatch an epic scene? When the host jumps to a new timestamp, all companion extensions sync within a fraction of a second.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
              <Layers size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Synchronized Social Layer</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Keep the Synora tab open alongside Netflix for low-latency WebRTC voice chat, text commentary, and floating emoji bursts without any clutter on your Netflix player.
            </p>
          </div>
        </div>
      </section>

      {/* Action Footer */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h3 className="text-2xl font-black text-white">Ready for Movie Night?</h3>
        <p className="text-sm text-gray-400">
          Create a room in seconds and invite friends with a single link.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2"
          >
            <Sparkles size={14} /> Start Netflix Watch Party
          </button>
        </div>
      </section>

      {/* Modal */}
      <WatchPartyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        defaultTab="netflix"
      />
    </div>
  );
};
