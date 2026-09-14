import React, { useState } from 'react';
import { 
  Sparkles, 
  Tv, 
  Mic, 
  MessageSquare, 
  Monitor, 
  ArrowRight, 
  Check, 
  Share2, 
  LogIn, 
  Radio,
  Shield,
  Film,
  Lock,
  Play,
  HelpCircle,
  ChevronDown,
  Youtube,
  CheckCircle2,
  Award,
  Clock,
  Cpu,
  Users
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { WatchPartyModal } from './WatchPartyModal';
import { JoinPartyModal } from './JoinPartyModal';
import { motion } from 'framer-motion';

export const PublicLanding: React.FC = () => {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<'custom' | 'embed' | 'screen' | 'netflix'>('embed');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const handleOpenCreateWithTab = (tab: 'custom' | 'embed' | 'screen' | 'netflix') => {
    setCreateModalTab(tab);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:py-28 overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-wider border border-emerald-500/20 mb-8"
          >
            <Radio size={14} className="animate-pulse text-emerald-400" />
            Live Co-Watching & Real-Time Sync
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white tracking-tight leading-[1.08] max-w-5xl mx-auto"
          >
            Watch together. <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
              Talk together.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed"
          >
            Create private Watch Parties, invite your friends, and experience supported content together in real time with synchronized playback, live chat, crystal-clear WebRTC voice, and emoji reactions.
          </motion.p>

          {/* Action CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto sm:max-w-none"
          >
            <button 
              id="heroCreatePartyBtn"
              onClick={() => handleOpenCreateWithTab('embed')}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
            >
              <Sparkles size={18} />
              Create a Watch Party
            </button>

            <button 
              id="heroHowItWorksBtn"
              onClick={() => navigate('/how-it-works')}
              className="w-full sm:w-auto px-7 py-4 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-2xl font-black text-base transition-all border border-white/10 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 backdrop-blur-md"
            >
              <HelpCircle size={18} />
              How It Works
            </button>

            <button 
              id="heroJoinCodeBtn"
              onClick={() => setIsJoinModalOpen(true)}
              className="w-full sm:w-auto px-7 py-4 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-2xl font-black text-base transition-all border border-white/10 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 backdrop-blur-md"
            >
              <LogIn size={18} />
              Join with Code
            </button>
          </motion.div>

          {/* Quick Metrics / Guarantees */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs text-gray-400 uppercase tracking-wider font-semibold">
            <span className="flex items-center gap-2">
              <Check size={14} className="text-emerald-400" /> Host Player Controls
            </span>
            <span className="flex items-center gap-2">
              <Check size={14} className="text-emerald-400" /> Low-Latency WebRTC Voice
            </span>
            <span className="flex items-center gap-2">
              <Check size={14} className="text-emerald-400" /> No Sign-Up Needed to Join
            </span>
            <span className="flex items-center gap-2">
              <Check size={14} className="text-emerald-400" /> Private Invite Links
            </span>
          </div>
        </div>
      </section>

      {/* 1. Get Started in 3 Steps */}
      <section id="get-started" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
            Simple Onboarding
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 tracking-tight">
            Get Started in 3 Steps
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            No complex setup or software installations required. Jump right into your private theater.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-3xl p-8 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-black text-lg border border-emerald-500/30">
                01
              </div>
              <h3 className="text-xl font-bold text-white">Create a Watch Party</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Choose your content source—YouTube, a Netflix watch link via our extension, custom video streams, or your live screen. Set your room title and nickname.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 size={14} /> Public or Private (Invite-Only)
            </div>
          </div>

          <div className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-3xl p-8 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center font-black text-lg border border-blue-500/30">
                02
              </div>
              <h3 className="text-xl font-bold text-white">Invite Your Friends</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Copy your unique room link. If your room is private, the link automatically includes your secure invite code token so only invited friends can enter.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-semibold text-blue-400">
              <Share2 size={14} /> One-Click Instant Access
            </div>
          </div>

          <div className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-3xl p-8 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-black text-lg border border-purple-500/30">
                03
              </div>
              <h3 className="text-xl font-bold text-white">Watch Together in Sync</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                As host, your play, pause, and seek commands automatically keep everyone aligned. Chat live, hop onto voice, and fire floating emoji reactions together.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-semibold text-purple-400">
              <Play size={14} /> Latency-Compensated Sync
            </div>
          </div>
        </div>
      </section>

      {/* 2. Choose How You Watch */}
      <section id="how-to-watch" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="px-3.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-black uppercase tracking-widest">
            Supported Sources
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 tracking-tight">
            Choose How You Watch
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            Synora supports several media options tailored to what you and your friends want to watch.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: YouTube */}
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-red-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
                <Youtube size={24} />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
                YouTube
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Watch supported YouTube videos together through Synora's embedded player with host play/pause/seek sync.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => handleOpenCreateWithTab('embed')}
                className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/30"
              >
                Launch YouTube Party <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Card 2: Netflix */}
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Tv size={24} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                  Companion App
                </span>
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                Netflix
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Connect the Synora companion extension to synchronize playback with friends using your own personal Netflix account.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2">
              <button
                onClick={() => navigate('/netflix')}
                className="flex-1 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-emerald-500/30"
              >
                Netflix Guide <ArrowRight size={12} />
              </button>
              <button
                onClick={() => handleOpenCreateWithTab('netflix')}
                className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10"
                title="Create Netflix Room"
              >
                <Sparkles size={14} />
              </button>
            </div>
          </div>

          {/* Card 3: Custom Stream */}
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-blue-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Film size={24} />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                Custom Stream & HLS
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Synchronize any direct video URL—including `.mp4`, `.webm`, or live `.m3u8` HLS streaming feeds with full room alignment.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => handleOpenCreateWithTab('custom')}
                className="w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-blue-500/30"
              >
                Launch Stream Party <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Card 4: Screen Share */}
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-purple-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Monitor size={24} />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                Live Screen Share
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Stream any browser tab, desktop application, gameplay, or presentation directly to your room over low-latency WebRTC.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => handleOpenCreateWithTab('screen')}
                className="w-full py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-purple-500/30"
              >
                Share Screen Party <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. YouTube Guide */}
      <section id="youtube-guide" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-red-950/20 via-black to-zinc-950/40 border border-white/10 rounded-[36px] p-8 sm:p-12">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-black uppercase tracking-wider">
                  Zero Extensions Needed
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
                Watch YouTube Together
              </h2>
              <p className="text-sm text-gray-400 mt-2 max-w-2xl">
                Stream podcasts, music videos, documentaries, and community clips together in real time with the embedded YouTube player.
              </p>
            </div>

            <button
              onClick={() => handleOpenCreateWithTab('embed')}
              className="px-6 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/20 flex items-center gap-2 self-start lg:self-center"
            >
              <Youtube size={16} /> Start YouTube Room
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h4 className="text-base font-bold text-white">Paste Any Public URL</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Paste any standard YouTube link (`youtube.com/watch?v=...` or `youtu.be/...`). Synora automatically extracts the video ID.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h4 className="text-base font-bold text-white">Embedded Sync Player</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Powered by the official YouTube IFrame Player API. The host controls play, pause, and seek commands for the entire room.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h4 className="text-base font-bold text-white">Automatic Drift Correction</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                If a guest’s video falls behind due to network buffering, the player automatically snaps back into sync with the host.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Watch Party Platform Showcase */}
      <section id="social-features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
            Social Platform
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 tracking-tight">
            More Than Just Playback
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            Synora bridges the gap between streaming and social connection. Build your profile, track viewing time, and foster private communities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Clock size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Watch Time & Stats
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Automatically tracks your total hours spent co-watching with friends across movies, YouTube, and streams.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Live Profile Tracking
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-amber-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Award size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                Badges & Achievements
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Unlock badges like First Sync, Movie Marathoner, and Night Owl as you host parties and watch with your squad.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Milestone Unlocks
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-blue-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                Friend Network & Presence
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Add friends directly from your room. See who is online or currently watching, and send instant room invites.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[11px] font-semibold text-blue-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Real-Time Presence
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-purple-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Shield size={24} />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                Host Moderation Tools
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Hosts retain full control over room audio with individual participant muting, kick options, and private room codes.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[11px] font-semibold text-purple-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Host-Authoritative
            </div>
          </div>
        </div>
      </section>

      {/* Learn More & Architecture Guides */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/30 via-zinc-900 to-black border border-white/10 p-8 flex flex-col justify-between hover:border-emerald-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Cpu size={24} />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                How Synora Works Under The Hood
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Explore our host-authoritative timecode broadcast, automatic drift compensation, and zero-server peer-to-peer WebRTC mesh architecture.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5">
              <Link
                to="/how-it-works"
                className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Read Full Architecture Guide <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-950/30 via-zinc-900 to-black border border-white/10 p-8 flex flex-col justify-between hover:border-red-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
                <Tv size={24} />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
                Watch Netflix Together Companion Guide
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Step-by-step setup for the Manifest V3 companion extension, local developer installation, and our 100% privacy-preserving security guarantees.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5">
              <Link
                to="/netflix"
                className="inline-flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
              >
                Open Netflix Companion Guide <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
            Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
            Designed for Seamless Co-Watching
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            Built from the ground up for real-time social interaction and low latency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Play size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Host-Authoritative Player Sync</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              When the host plays, pauses, or seeks, participants stay in step automatically with timestamp drift compensation.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3 hover:border-blue-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Mic size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Crystal-Clear WebRTC Voice</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              High-fidelity peer-to-peer audio with active speaker rings, individual volume sliders, and instant mute controls.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3 hover:border-purple-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <MessageSquare size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Live Chat & Floating Reactions</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Express your reactions with real-time room messaging, system event notices, and floating emoji bursts across the screen.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3 hover:border-indigo-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Monitor size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">High-Def Screen Sharing</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Broadcast gameplay streams, browser tabs, or slide presentations straight from your browser window directly to your friends.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3 hover:border-pink-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
              <Shield size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Persistent Rooms & Reconnection</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Accidentally refreshed your tab? The room stays alive in Firestore until the host deliberately ends the party.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 space-y-3 hover:border-teal-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Lock size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Private Invite-Only Rooms</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Toggle private mode to hide rooms from the public lobby. Only guests with your invite link and secure invite code token can enter.
            </p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) */}
      <section id="faq" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
            Answers
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            Everything you need to know about rooms, content sources, sync, and privacy.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "What is Synora?",
              a: "Synora is an open-source, real-time social Watch Party platform that allows friends and communities to watch supported content together in perfect sync, accompanied by live text chat, floating animated emoji reactions, crystal-clear WebRTC voice chat, and live screen sharing."
            },
            {
              q: "How do I create a Watch Party?",
              a: "Click 'Create a Watch Party' anywhere on Synora. Pick a supported media source (an embedded YouTube link, a custom MP4/HLS stream URL, live screen sharing, or Netflix with our companion extension). Choose a room title and nickname, select whether the party is Public or Private, and launch!"
            },
            {
              q: "Are Watch Parties private?",
              a: "Yes! When creating a room, toggle the 'Private (Invite-Only)' option. Private rooms never appear on the public homepage. Only people with your unique invite link (which includes your secure 12-character invite code token) can join."
            },
            {
              q: "How do I invite friends to my room?",
              a: "Once inside your Watch Party, click the 'Copy Link' button in the header. Send this link to your friends. If your room is private, the unique invite code token is embedded in the link automatically so they can enter with a single click."
            },
            {
              q: "Does Synora host or pirate movies?",
              a: "No, absolutely not. Synora does not store, host, or distribute video files. Synora only synchronizes playback timestamps, play/pause commands, chat messages, and WebRTC peer connections. All video is streamed directly from legal origin sources (e.g., YouTube, public domain video hosts, or your own local Netflix session)."
            },
            {
              q: "How does the Netflix integration work?",
              a: "Netflix integration uses the Synora Watch Party Bridge Chrome extension. The extension communicates between Synora and your active Netflix browser tab to synchronize play, pause, and seek commands. You must install the extension locally in Developer Mode and have Netflix open in your browser."
            },
            {
              q: "Do I need my own Netflix account?",
              a: "Yes. Every participant in a Netflix Watch Party must be signed into their own authorized Netflix subscription. Synora never proxies Netflix video streams and never requests, captures, or stores Netflix credentials, cookies, or DRM keys."
            },
            {
              q: "How does YouTube integration work?",
              a: "Simply paste any standard public YouTube URL (such as youtube.com/watch?v=... or youtu.be/...) when creating a room. Synora embeds the video using the official YouTube IFrame Player API. When the host plays, pauses, or scrubs the video, all participants sync automatically with latency drift correction."
            },
            {
              q: "Do I need the browser extension for everything?",
              a: "No! The browser extension is only needed for Netflix synchronization. YouTube, custom direct streaming URLs (.mp4, .m3u8), screen sharing, voice chat, and live chat work out-of-the-box in any modern desktop or mobile browser with zero extensions installed."
            },
            {
              q: "Can I use voice chat and share my screen?",
              a: "Yes! Synora includes built-in WebRTC voice chat with microphone mute/unmute and speaking indicators. Desktop hosts can also share any browser tab, application window, or full desktop screen with the room."
            }
          ].map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div 
                key={index}
                className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden transition-colors hover:border-white/20"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4"
                >
                  <span className="font-bold text-white text-base sm:text-lg">
                    {faq.q}
                  </span>
                  <div className={`p-1.5 rounded-lg bg-white/5 text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-400' : ''}`}>
                    <ChevronDown size={18} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-[36px] bg-gradient-to-r from-emerald-900/40 via-zinc-900 to-blue-900/40 border border-white/10 p-10 sm:p-16 text-center shadow-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-wider">
            <Sparkles size={14} /> Ready to Watch?
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-2xl mx-auto">
            Create Your First Watch Party in Seconds
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
            Choose your movie, invite your friends, and enjoy synchronized streaming with voice and chat.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => handleOpenCreateWithTab('embed')}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-emerald-950/40 flex items-center justify-center gap-2"
            >
              <Sparkles size={18} /> Start Watching Together
            </button>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-2xl font-black text-base transition-all border border-white/10 flex items-center justify-center gap-2"
            >
              <LogIn size={18} /> Sign In to Synora
            </Link>
          </div>
        </div>
      </section>

      {/* Modals */}
      <WatchPartyModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        defaultTab={createModalTab}
      />

      <JoinPartyModal 
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  );
};
