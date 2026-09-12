import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Laptop, 
  Radio, 
  Mic, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Tv, 
  Cpu, 
  ChevronDown
} from 'lucide-react';
import { WatchPartyModal } from '../components/WatchPartyModal';

export const HowItWorks: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'embed' | 'custom' | 'screen' | 'netflix'>('embed');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const handleOpenCreate = (tab: 'embed' | 'custom' | 'screen' | 'netflix' = 'embed') => {
    setActiveTab(tab);
    setIsCreateModalOpen(true);
  };

  const faqs = [
    {
      q: "Does Synora host or store the copyrighted movies or TV shows?",
      a: "No, never. Synora is a real-time synchronization layer and peer-to-peer communication bridge. All media streams are delivered directly to each user's browser—either through official public players (like YouTube), authorized direct streams, WebRTC screen sharing, or their own authenticated Netflix subscription via our companion extension. Synora servers never ingest, transcode, or proxy protected video content."
    },
    {
      q: "How does player synchronization actually work?",
      a: "The host's player periodically reports its timestamp, playback state (playing or paused), and rate to the room document in Firestore. Participant browsers monitor this document in real time. If a participant's player drifts by more than 1.5 to 2.5 seconds due to network buffering, our intelligent drift compensation algorithm smoothly adjusts the playback speed or snaps back to the host's timestamp."
    },
    {
      q: "How does WebRTC Voice and Screen Sharing protect privacy?",
      a: "Audio chat and screen streams are established directly peer-to-peer using standard WebRTC peer connections. Synora uses Google STUN servers solely to help peers discover their connection paths through NAT firewalls. Once the connection is open, the audio and video packets flow directly between viewers with end-to-end encryption (DTLS-SRTP), never passing through any intermediary Synora servers."
    },
    {
      q: "Is an extension required for all watch party types?",
      a: "No! The browser extension is only needed for Netflix synchronization. YouTube, direct video URLs (.mp4, .m3u8), screen sharing, peer voice chat, and live text chat work out-of-the-box in any modern desktop or mobile browser with zero extensions installed."
    },
    {
      q: "What happens if a participant's Internet buffers or lags?",
      a: "Synora's drift engine detects when a viewer falls behind. Small micro-drifts (under 1.5s) are smoothed out, while larger lag spikes trigger an automatic jump to align with the host. Participants also have a dedicated 'Sync with Host' button in the player controls to manually force an instant re-sync at any time."
    }
  ];

  return (
    <div className="min-h-screen pb-24 text-white">
      {/* Top Banner / Hero */}
      <section className="relative overflow-hidden pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
            <Cpu size={14} /> Under The Hood Architecture
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
            How Synora Works
          </h1>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            Synora coordinates playback timing, social interactions, and peer-to-peer media without hosting copyrighted media or running heavy video proxies.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={() => handleOpenCreate('embed')}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2"
            >
              <Sparkles size={14} /> Create a Watch Party
            </button>
            <Link
              to="/netflix"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-2"
            >
              <Tv size={14} className="text-emerald-400" /> Netflix Companion Guide
            </Link>
          </div>
        </div>
      </section>

      {/* 4 Core Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-emerald-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
              <Laptop size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Synora Web App</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Modern React single-page app managing room state, media player controls, floating reactions, and participant rosters with zero bloat.
            </p>
            <div className="pt-2 text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> Responsive Client-Side UI
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-blue-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">
              <Radio size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Firestore Sync Engine</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Lightweight real-time listener synchronization for player timestamps, play/pause states, and chat messages with low latency.
            </p>
            <div className="pt-2 text-[11px] text-blue-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> Millisecond Event Dispatch
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-purple-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
              <Mic size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">WebRTC Mesh</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Direct peer-to-peer audio and screen sharing with STUN/TURN traversal. Audio and video streams never touch central servers.
            </p>
            <div className="pt-2 text-[11px] text-purple-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> End-to-End Encrypted
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-amber-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              <Layers size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Extension Bridge</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Manifest V3 companion extension synchronizing commands with your local Netflix tab. Completely isolated and password-free.
            </p>
            <div className="pt-2 text-[11px] text-amber-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> Privacy-First Architecture
            </div>
          </div>
        </div>
      </section>

      {/* Deep Dive Architecture Card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-emerald-950/40 via-black to-blue-950/40 border border-white/10 p-8 sm:p-12 lg:p-16 shadow-2xl space-y-12">
          <div className="max-w-3xl">
            <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
              Synchronization Mechanics
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-3">
              Host-Authoritative Player Sync with Drift Compensation
            </h2>
            <p className="text-gray-400 text-sm mt-3 leading-relaxed">
              Unlike legacy screen-broadcasting tools that turn video into a blurry, laggy stream, Synora uses an authoritative timecode broadcast protocol.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black/50 border border-white/10 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm">
                1
              </div>
              <h4 className="text-base font-bold text-white">Authoritative State</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                The room creator acts as the authoritative host. When they play, pause, or seek, the timestamp and play state update in the cloud room document.
              </p>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-sm">
                2
              </div>
              <h4 className="text-base font-bold text-white">Continuous Drift Detection</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Participant browsers calculate local elapsed time versus the host timestamp. If local playback deviates by more than 2 seconds, the client initiates a jump.
              </p>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-sm">
                3
              </div>
              <h4 className="text-base font-bold text-white">Zero Server Ingestion</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Each participant streams video in crisp native 1080p/4K directly from the content source, avoiding the heavy bandwidth and degradation of screen capturing.
              </p>
            </div>
          </div>

          {/* Simple Step Sequence */}
          <div className="pt-8 border-t border-white/10">
            <h3 className="text-lg font-bold text-white mb-6">Standard Room Workflow</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-2">
                <div className="text-emerald-400 text-xs font-black uppercase tracking-wider">Step 1</div>
                <div className="text-sm font-bold text-white">Host Creates Room</div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Host configures the room type, selects content (YouTube, stream URL, screen share, or Netflix), and initiates the party.
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-2">
                <div className="text-blue-400 text-xs font-black uppercase tracking-wider">Step 2</div>
                <div className="text-sm font-bold text-white">Friends Join Instantly</div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Participants connect via invite link or room code with guest names or Google profiles in one click.
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-2">
                <div className="text-purple-400 text-xs font-black uppercase tracking-wider">Step 3</div>
                <div className="text-sm font-bold text-white">Synchronized Co-Watching</div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Playback updates sync automatically while everyone talks over crystal-clear voice chat and sends floating reactions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Privacy Commitment */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 sm:p-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div className="space-y-2">
              <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
                Privacy By Design
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white">Our Architectural Security Guarantees</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={28} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-400 leading-relaxed">
            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5">
              <h4 className="font-bold text-white text-sm">No Credential Interception</h4>
              <p>
                Synora never requests, touches, or stores credentials, cookies, or DRM tokens from Netflix or any other streaming service.
              </p>
            </div>
            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5">
              <h4 className="font-bold text-white text-sm">P2P Voice Encryption</h4>
              <p>
                Voice streams travel directly between peers over encrypted WebRTC channels (DTLS-SRTP), bypassing central servers entirely.
              </p>
            </div>
            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5">
              <h4 className="font-bold text-white text-sm">Zero Copyright Hosting</h4>
              <p>
                We do not host, store, or stream copyright-protected video files. Only public APIs, user-shared screens, or client-side playback bridges are used.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
            Architecture FAQ
          </span>
          <h2 className="text-3xl font-black text-white mt-3">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div 
                key={index}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-emerald-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className={`shrink-0 transition-transform duration-200 text-gray-400 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-gray-300 leading-relaxed border-t border-white/5 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Create Modal */}
      <WatchPartyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        defaultTab={activeTab}
      />
    </div>
  );
};
