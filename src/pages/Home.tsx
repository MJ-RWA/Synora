import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { WatchRoom } from '../types';
import { SAMPLE_MEDIA, SampleMedia } from '../config/sampleMedia';
import { 
  Users, 
  Play, 
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
  Film
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WatchPartyModal } from '../components/WatchPartyModal';
import { JoinPartyModal } from '../components/JoinPartyModal';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeRooms, setActiveRooms] = useState<WatchRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedSampleForParty, setSelectedSampleForParty] = useState<SampleMedia | null>(null);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  // Real-time listener for active rooms
  useEffect(() => {
    const q = query(
      collection(db, 'watchRooms'), 
      where('isActive', '==', true),
      limit(12)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchRoom));
      // Sort client-side by updatedAt/createdAt
      rooms.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setActiveRooms(rooms);
      setLoadingRooms(false);
    }, (err) => {
      console.error('Error listening to active rooms:', err);
      setLoadingRooms(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCopyLink = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/watchparty/${roomId}`);
    setCopiedRoomId(roomId);
    setTimeout(() => setCopiedRoomId(null), 2000);
  };

  const handleStartWithSample = (sample: SampleMedia) => {
    setSelectedSampleForParty(sample);
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
            Watch Together, <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
              Wherever You Are.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            Synchronize video playback in real time with high-quality voice chat, live text messaging, floating emoji reactions, and screen sharing.
          </motion.p>

          {/* Action CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none"
          >
            <button 
              onClick={() => {
                setSelectedSampleForParty(null);
                setIsCreateModalOpen(true);
              }}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
            >
              <Sparkles size={18} />
              Create a Watch Party
            </button>

            <button 
              onClick={() => setIsJoinModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-black text-base transition-all border border-white/10 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 backdrop-blur-md"
            >
              <LogIn size={18} />
              Join with Code / Link
            </button>
          </motion.div>

          {/* Quick Metrics / Guarantees */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-xs text-gray-500 uppercase tracking-widest font-bold">
            <span className="flex items-center gap-2">
              <Check size={14} className="text-emerald-400" /> Host Player Controls
            </span>
            <span className="flex items-center gap-2">
              <Check size={14} className="text-emerald-400" /> Low Latency WebRTC Voice
            </span>
            <span className="flex items-center gap-2">
              <Check size={14} className="text-emerald-400" /> No Sign-Up Needed to Join
            </span>
          </div>
        </div>
      </section>

      {/* Active Watch Rooms Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-2xl sm:text-3xl font-black text-white">Active Watch Parties</h2>
            </div>
            <p className="text-sm text-gray-400 mt-1">Jump into ongoing sessions or return to your active room</p>
          </div>

          <button 
            onClick={() => {
              setSelectedSampleForParty(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all self-start sm:self-auto"
          >
            <Sparkles size={14} className="text-emerald-400" /> Start New Room
          </button>
        </div>

        {loadingRooms ? (
          <div className="py-20 flex justify-center">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeRooms.map((room) => {
              const isUserHost = user?.uid === room.hostId;
              return (
                <div 
                  key={room.id}
                  onClick={() => navigate(`/watchparty/${room.id}`)}
                  className={`group relative bg-white/[0.03] hover:bg-white/[0.06] border rounded-3xl p-6 transition-all cursor-pointer flex flex-col justify-between shadow-xl ${
                    isUserHost 
                      ? 'border-emerald-500/50 hover:border-emerald-500 shadow-emerald-950/20' 
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                          {room.playing ? 'Playing' : 'In Session'}
                        </span>
                      </div>

                      {isUserHost && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                          Your Room
                        </span>
                      )}
                    </div>

                    {/* Room Info */}
                    <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {room.title}
                    </h3>
                    
                    <p className="text-xs text-gray-400 mt-1">
                      Hosted by <span className="text-gray-200 font-bold">{room.hostName || 'Host'}</span>
                    </p>
                  </div>

                  {/* Room Meta & Action */}
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-bold">
                      <Users size={14} className="text-emerald-400" />
                      <span>{room.usersCount || 1} participant{(room.usersCount || 1) > 1 ? 's' : ''}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleCopyLink(room.id, e)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
                        title="Copy Room Link"
                      >
                        {copiedRoomId === room.id ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <Share2 size={14} />
                        )}
                      </button>

                      <span className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                        isUserHost 
                          ? 'bg-emerald-600 group-hover:bg-emerald-500 text-white shadow-md' 
                          : 'bg-white/10 group-hover:bg-white/20 text-white'
                      }`}>
                        {isUserHost ? 'Return to Room' : 'Enter Room'}
                        <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-3xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <Tv size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No Active Rooms Right Now</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                Be the first to start a watch party! Choose a video below or stream your screen.
              </p>
            </div>
            <button 
              onClick={() => {
                setSelectedSampleForParty(null);
                setIsCreateModalOpen(true);
              }}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/20"
            >
              Start First Party
            </button>
          </div>
        )}
      </section>

      {/* Quick Launch Free Sample Movies */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <Film size={20} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">Quick Start Sample Media</h2>
            </div>
            <p className="text-sm text-gray-400 mt-1">One-click instant watch rooms with high-quality public domain films</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {SAMPLE_MEDIA.map((item) => (
            <div 
              key={item.id}
              onClick={() => handleStartWithSample(item)}
              className="group relative bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-emerald-500/50 rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col shadow-xl"
            >
              <div className="aspect-[16/9] relative overflow-hidden bg-black/40">
                <img 
                  src={item.poster} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                    {item.category}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                    {item.duration}
                  </span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                  <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-900/40 group-hover:scale-110 transition-transform">
                    <Play size={24} fill="currentColor" className="ml-1" />
                  </div>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-bold">Free Open Film</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Launch Room <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-emerald-950/40 via-black to-blue-950/40 border border-white/10 p-8 sm:p-12 lg:p-16 shadow-2xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">How It Works</h2>
            <p className="text-gray-400 text-sm mt-3">Three simple steps to stream in perfect harmony with anyone around the world.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xl border border-emerald-500/30">
                1
              </div>
              <h3 className="text-xl font-bold text-white">Create a Room</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Choose any sample video, custom streaming URL (.mp4, .m3u8), or start a live screen share session.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xl border border-blue-500/30">
                2
              </div>
              <h3 className="text-xl font-bold text-white">Invite Friends</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Share your instant room link or short code. Friends can join with a single click as guests or with their user accounts.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-xl border border-purple-500/30">
                3
              </div>
              <h3 className="text-xl font-bold text-white">Watch & React in Sync</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Playback is host-synchronized. Chat live, hop onto voice chat, and trigger floating emoji reactions in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-white">Designed for Seamless Co-Watching</h2>
          <p className="text-gray-400 text-sm mt-3">Built from the ground up for real-time interaction and low latency.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Play size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Host-Authoritative Player Sync</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              When the host plays, pauses, or seeks, participants stay in step automatically with timestamp latency compensation.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Mic size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Crystal-Clear WebRTC Voice</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              High-fidelity peer-to-peer audio with speaking indicators, individual volume controls, and instant mic mute/unmute.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <MessageSquare size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Live Chat & Floating Reactions</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Express your feelings with real-time room chat, typing indicators, and animated emoji fireworks floating across the screen.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Monitor size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">High-Def Screen Sharing</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Share game streams, YouTube clips, browser tabs, or presentations straight from your browser with your audience.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
              <Shield size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Persistent Rooms & Reconnection</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Accidentally refreshed? No problem! The room stays active until the host chooses to end the party.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Users size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Friends & Notifications</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Connect with friends, send in-app watch party invitations, and see when your crew is online and watching.
            </p>
          </div>
        </div>
      </section>

      {/* Modals */}
      <WatchPartyModal 
        isOpen={isCreateModalOpen} 
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedSampleForParty(null);
        }}
        defaultSample={selectedSampleForParty}
        defaultVideoUrl={selectedSampleForParty?.videoUrl}
        defaultTitle={selectedSampleForParty?.title}
      />

      <JoinPartyModal 
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  );
};
