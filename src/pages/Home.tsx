import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, limit, doc, getDoc, deleteDoc } from 'firebase/firestore';
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
  Film,
  Trash2,
  Lock,
  Globe,
  RotateCw,
  HelpCircle,
  ChevronDown,
  Youtube,
  Layers,
  CheckCircle2,
  Laptop,
  ShieldCheck,
  PlayCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WatchPartyModal } from '../components/WatchPartyModal';
import { JoinPartyModal } from '../components/JoinPartyModal';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeRooms, setActiveRooms] = useState<WatchRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [myWatchParties, setMyWatchParties] = useState<WatchRoom[]>([]);
  const [loadingMyParties, setLoadingMyParties] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<'sample' | 'custom' | 'embed' | 'screen' | 'netflix'>('sample');
  const [selectedSampleForParty, setSelectedSampleForParty] = useState<SampleMedia | null>(null);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<WatchRoom | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOpenCreateWithTab = (tab: 'sample' | 'custom' | 'embed' | 'screen' | 'netflix') => {
    setSelectedSampleForParty(null);
    setCreateModalTab(tab);
    setIsCreateModalOpen(true);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Helper to fetch rooms from both Firestore queries and local storage backup
  const fetchAllUserRooms = useCallback(async () => {
    setIsRefreshing(true);
    const roomMap = new Map<string, WatchRoom>();

    // 1. Check local storage for previously created or saved rooms
    try {
      const savedIds: string[] = JSON.parse(localStorage.getItem('synora_saved_room_ids') || '[]');
      const createdRooms: { id: string; title?: string }[] = JSON.parse(localStorage.getItem('synora_created_rooms') || '[]');
      const allLocalIds = Array.from(new Set([...savedIds, ...createdRooms.map(r => r.id)]));

      // 1. Check local storage for previously created or saved rooms
      const snapPromises = allLocalIds.slice(0, 15).map(async (roomId) => {
        if (!roomId) return null;
        try {
          const roomSnap = await getDoc(doc(db, 'watchRooms', roomId));
          if (roomSnap.exists()) {
            return { id: roomSnap.id, ...roomSnap.data() } as WatchRoom;
          }
        } catch (singleErr) {
          console.warn('Note retrieving room from localStorage cache:', roomId, singleErr);
        }
        return null;
      });
      const resolvedRooms = await Promise.all(snapPromises);
      resolvedRooms.forEach(roomItem => {
        if (roomItem && roomItem.id) {
          roomMap.set(roomItem.id, roomItem);
        }
      });
    } catch (storageErr) {
      console.warn('LocalStorage scan note:', storageErr);
    }

    // 2. If user is logged in, query rooms where user is host or owner
    if (user?.uid) {
      try {
        const qHost = query(collection(db, 'watchRooms'), where('hostId', '==', user.uid));
        const qOwner = query(collection(db, 'watchRooms'), where('ownerId', '==', user.uid));
        
        // Use real-time snapshot or one-time get
        const [snapHost, snapOwner] = await Promise.all([
          new Promise<WatchRoom[]>((resolve) => {
            const unsub = onSnapshot(qHost, (s) => {
              resolve(s.docs.map(d => ({ id: d.id, ...d.data() } as WatchRoom)));
              unsub();
            }, () => resolve([]));
          }),
          new Promise<WatchRoom[]>((resolve) => {
            const unsub = onSnapshot(qOwner, (s) => {
              resolve(s.docs.map(d => ({ id: d.id, ...d.data() } as WatchRoom)));
              unsub();
            }, () => resolve([]));
          })
        ]);

        [...snapHost, ...snapOwner].forEach(r => {
          if (r.id) roomMap.set(r.id, r);
        });
      } catch (authFetchErr) {
        console.warn('Error fetching user rooms by auth uid:', authFetchErr);
      }
    }

    const combined = Array.from(roomMap.values()).filter(r => r.isActive !== false);
    combined.sort((a, b) => {
      const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });

    setMyWatchParties(combined);
    setLoadingMyParties(false);
    setIsRefreshing(false);
  }, [user?.uid]);

  // Real-time listener for current user's owned/hosted rooms ("My Watch Parties")
  useEffect(() => {
    fetchAllUserRooms();

    if (!user?.uid) return;

    const qHost = query(collection(db, 'watchRooms'), where('hostId', '==', user.uid));
    const qOwner = query(collection(db, 'watchRooms'), where('ownerId', '==', user.uid));

    let roomsByHost: WatchRoom[] = [];
    let roomsByOwner: WatchRoom[] = [];

    const mergeAndSetRooms = () => {
      setMyWatchParties(prev => {
        const roomMap = new Map<string, WatchRoom>();
        // Preserve rooms found via localStorage
        prev.forEach(r => roomMap.set(r.id, r));
        [...roomsByHost, ...roomsByOwner].forEach(r => {
          if (r.id) roomMap.set(r.id, r);
        });

        const combined = Array.from(roomMap.values());
        combined.sort((a, b) => {
          const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeB - timeA;
        });
        return combined;
      });
      setLoadingMyParties(false);
    };

    const unsubHost = onSnapshot(qHost, (snapshot) => {
      roomsByHost = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WatchRoom));
      mergeAndSetRooms();
    }, (err) => {
      console.warn('Error listening to user rooms by hostId:', err);
      setLoadingMyParties(false);
    });

    const unsubOwner = onSnapshot(qOwner, (snapshot) => {
      roomsByOwner = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WatchRoom));
      mergeAndSetRooms();
    }, (err) => {
      console.warn('Error listening to user rooms by ownerId:', err);
      setLoadingMyParties(false);
    });

    return () => {
      unsubHost();
      unsubOwner();
    };
  }, [user?.uid, fetchAllUserRooms]);

  // Real-time listener for active rooms (public only)
  useEffect(() => {
    const q = query(
      collection(db, 'watchRooms'), 
      where('isActive', '==', true),
      where('isPrivate', '==', false),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchRoom));
      const visible = allDocs.filter(r => r.isActive !== false);

      visible.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setActiveRooms(visible);
      setLoadingRooms(false);
    }, (err) => {
      console.warn('Notice listening to active rooms:', err);
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

  const handleReopenParty = async (roomItem: WatchRoom, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isOwner = Boolean(user?.uid && (user.uid === roomItem.hostId || user.uid === roomItem.ownerId));
    if (isOwner && roomItem.isActive === false) {
      updateDoc(doc(db, 'watchRooms', roomItem.id), { isActive: true }).catch(() => {});
    }
    navigate(`/watchparty/${roomItem.id}`, { 
      state: { 
        initialRoom: { ...roomItem, isActive: true },
        isHostCreation: isOwner
      } 
    });
  };

  const handleStartWithSample = (sample: SampleMedia) => {
    setSelectedSampleForParty(sample);
    setIsCreateModalOpen(true);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete?.id) return;
    try {
      setIsDeletingRoom(true);
      await deleteDoc(doc(db, 'watchRooms', roomToDelete.id));
      setRoomToDelete(null);
    } catch (err) {
      console.error('Error deleting watch room:', err);
    } finally {
      setIsDeletingRoom(false);
    }
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
              onClick={() => handleOpenCreateWithTab('sample')}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
            >
              <Sparkles size={18} />
              Create a Watch Party
            </button>

            <button 
              id="heroHowItWorksBtn"
              onClick={() => scrollToSection('how-it-works')}
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
                Choose your content source—YouTube, a Netflix watch link via the extension, open sample films, custom video streams, or your live screen. Set your room title and nickname.
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

          {/* Card 2: Netflix (Experimental) */}
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-all group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Tv size={24} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
                  Experimental
                </span>
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                Netflix
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Connect the Synora browser extension to synchronize playback with friends using your own authorized Netflix session.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => scrollToSection('netflix-guide')}
                className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-emerald-500/30"
              >
                Extension Guide <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Card 3: Free Sample Media */}
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-blue-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Film size={24} />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                Open Films & HLS
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Jump right in with public domain films (*Big Buck Bunny*, *Sintel*) or paste any direct custom `.mp4` or `.m3u8` HLS URL.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => scrollToSection('sample-media')}
                className="w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-blue-500/30"
              >
                Browse Films <ArrowRight size={12} />
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

      {/* 3. Netflix Extension Guide (Visual Walkthrough) */}
      <section id="netflix-guide" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-zinc-900/90 via-black to-zinc-950/90 border border-white/10 p-8 sm:p-12 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
            <div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black uppercase tracking-wider">
                  Experimental Developer Preview
                </span>
                <span className="text-xs text-gray-400">Chrome Extension Manifest V3</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
                Watch Netflix Together
              </h2>
              <p className="text-sm text-gray-400 mt-2 max-w-2xl">
                The Synora Watch Party Bridge connects your active Netflix playback with your Synora room while keeping your session completely private.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenCreateWithTab('netflix')}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2"
              >
                <Sparkles size={14} /> Start Netflix Room
              </button>
            </div>
          </div>

          {/* 5-Step Visual Sequence */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">01</span>
              <h4 className="text-sm font-bold text-white">Install Extension</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Available for local installation during development (`npm run build:extension` → Chrome Developer Mode → Load unpacked `extension/dist`).
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">02</span>
              <h4 className="text-sm font-bold text-white">Connect to Synora</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Open Synora. The bridge communicates automatically; verify the green indicator in the bottom-right diagnostics panel.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">03</span>
              <h4 className="text-sm font-bold text-white">Open Netflix</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                In another browser tab, log into your own Netflix account and navigate to the show or film you want to watch.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">04</span>
              <h4 className="text-sm font-bold text-white">Create / Join Room</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Create a Synora Watch Party with your Netflix URL, or join your host's party link.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-mono font-black text-emerald-400">05</span>
              <h4 className="text-sm font-bold text-white">Watch in Sync</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Whenever the host plays, pauses, or scrubs, the extension syncs your local Netflix player seamlessly.
              </p>
            </div>
          </div>

          {/* Privacy Guarantee Banner */}
          <div className="mt-8 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div className="text-xs leading-relaxed text-gray-300">
              <span className="font-bold text-white">100% Privacy-Preserving Guarantee: </span>
              Synora never asks for or collects Netflix passwords, cookies, or DRM keys. All video playback occurs strictly within your own authorized Netflix session. Synora never streams or proxies video through its servers.
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

      {/* My Watch Parties Section (For Authenticated Users and Local Session Creators) */}
      {(user || myWatchParties.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">My Watch Parties</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  {myWatchParties.length}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Your saved rooms and live sessions. Reopen anytime, manage access, or invite guests.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => fetchAllUserRooms()}
                disabled={isRefreshing}
                title="Refresh rooms"
                className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all border border-white/10 flex items-center gap-1.5 text-xs font-bold disabled:opacity-50"
              >
                <RotateCw size={14} className={isRefreshing ? 'animate-spin text-emerald-400' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button 
                onClick={() => {
                  setSelectedSampleForParty(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/30"
              >
                <Sparkles size={14} /> Create Watch Party
              </button>
            </div>
          </div>

          {loadingMyParties ? (
            <div className="py-16 flex justify-center">
              <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myWatchParties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myWatchParties.map((room) => {
                const isOnline = room.isActive !== false;
                const isPrivate = room.isPrivate;
                const mediaLabel = room.movieTitle || (room.videoUrl?.includes('netflix.com') ? 'Netflix Stream' : room.videoUrl?.includes('youtube') ? 'YouTube Stream' : room.videoUrl ? 'Custom Video' : 'Live Screen Share / Stream');

                return (
                  <div 
                    key={room.id}
                    onClick={() => handleReopenParty(room)}
                    className="group relative bg-[#141414] hover:bg-[#1a1a1a] border border-emerald-500/30 hover:border-emerald-500/80 rounded-3xl p-6 transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-2xl hover:shadow-emerald-950/20"
                  >
                    <div>
                      {/* Status and Privacy Badges */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-gray-500'}`} />
                          <span className={`text-[11px] font-black uppercase tracking-wider ${isOnline ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {isOnline ? 'Active Session' : 'Saved Room'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isPrivate ? (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              <Lock size={11} /> Private (Invite Only)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                              <Globe size={11} /> Public
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Room Title */}
                      <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors line-clamp-1 mb-1">
                        {room.title || 'Untitled Watch Party'}
                      </h3>

                      {/* Media Title */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4 line-clamp-1">
                        <Film size={13} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{mediaLabel}</span>
                      </div>

                      {/* Metadata Row */}
                      <div className="flex items-center justify-between py-3 border-y border-white/5 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-emerald-400" />
                          <span>{room.usersCount || 0} participants</span>
                        </div>
                        {room.inviteCode && (
                          <div className="font-mono text-[11px] text-gray-300 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                            Code: {room.inviteCode}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-6 pt-2 flex items-center justify-between gap-3">
                      <button
                        onClick={(e) => handleReopenParty(room, e)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950/20"
                      >
                        <Play size={13} fill="currentColor" /> Reopen Party
                      </button>

                      <button
                        onClick={(e) => handleCopyLink(room.id, e)}
                        title="Copy Invite Link"
                        className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all border border-white/5 shrink-0"
                      >
                        {copiedRoomId === room.id ? (
                          <Check size={16} className="text-emerald-400" />
                        ) : (
                          <Share2 size={16} />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoomToDelete(room);
                        }}
                        title="Delete Room Permanently"
                        className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all border border-red-500/10 shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <Film size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No Saved Watch Parties</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Start your own watch party! Rooms you create stay saved so you and your friends can return to them anytime.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSampleForParty(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                <Sparkles size={14} /> Start Your First Watch Party
              </button>
            </div>
          )}
        </section>
      )}

      {/* Active Watch Rooms Section */}
      <section id="active-rooms" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-2xl sm:text-3xl font-black text-white">Active Watch Parties</h2>
            </div>
            <p className="text-sm text-gray-400 mt-1">Jump into ongoing sessions or return to your active room</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => fetchAllUserRooms()}
              disabled={isRefreshing}
              title="Refresh active rooms"
              className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all border border-white/10 flex items-center gap-1.5 text-xs font-bold disabled:opacity-50"
            >
              <RotateCw size={14} className={isRefreshing ? 'animate-spin text-emerald-400' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button 
              onClick={() => {
                setSelectedSampleForParty(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Sparkles size={14} className="text-emerald-400" /> Start New Room
            </button>
          </div>
        </div>

        {loadingRooms ? (
          <div className="py-20 flex justify-center">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeRooms.map((room) => {
              const isUserHost = Boolean(user?.uid && (user.uid === room.hostId || user.uid === room.ownerId));
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

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/watchparty/${room.id}`);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                          isUserHost 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md' 
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {isUserHost ? 'Return to Room' : 'Enter Room'}
                        <ArrowRight size={12} />
                      </button>
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
      <section id="sample-media" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

      {/* How It Works & Architecture Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-emerald-950/40 via-black to-blue-950/40 border border-white/10 p-8 sm:p-12 lg:p-16 shadow-2xl space-y-16">
          <div className="text-center max-w-3xl mx-auto">
            <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest">
              Under The Hood
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-3">
              How Synora Works
            </h2>
            <p className="text-gray-400 text-sm mt-3">
              Synora coordinates playback timing, social interactions, and peer-to-peer audio without hosting copyrighted media or running heavy video proxies.
            </p>
          </div>

          {/* Architecture Visual Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                <Laptop size={20} />
              </div>
              <h4 className="text-base font-bold text-white">Synora Web App</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Modern React single-page app managing room state, media player controls, floating reactions, and participant rosters.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">
                <Radio size={20} />
              </div>
              <h4 className="text-base font-bold text-white">Firestore Sync Engine</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Lightweight real-time listener synchronization for player timestamps, play/pause states, and chat messages.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                <Mic size={20} />
              </div>
              <h4 className="text-base font-bold text-white">WebRTC Mesh</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Direct peer-to-peer audio and screen sharing with STUN/TURN traversal. Audio and video streams never touch central servers.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                <Layers size={20} />
              </div>
              <h4 className="text-base font-bold text-white">Extension Bridge</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Manifest V3 companion extension synchronizing commands with your local Netflix tab. Completely isolated and password-free.
              </p>
            </div>
          </div>

          {/* Simple Step Sequence */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-lg font-bold text-white mb-6 text-center">Room Workflow</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-2">
                <div className="text-emerald-400 text-xs font-black uppercase tracking-wider">Step 1</div>
                <div className="text-sm font-bold text-white">Host Creates Room</div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Host configures the room type, selects content, and initiates the real-time session.
                </p>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-2">
                <div className="text-blue-400 text-xs font-black uppercase tracking-wider">Step 2</div>
                <div className="text-sm font-bold text-white">Friends Join Instantly</div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Participants connect via invite link or room code with guest names or Google profiles.
                </p>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-2">
                <div className="text-purple-400 text-xs font-black uppercase tracking-wider">Step 3</div>
                <div className="text-sm font-bold text-white">Synchronized Co-Watching</div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Playback updates sync instantly while everyone talks on voice and reacts with floating emojis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid (Strictly Implemented Features) */}
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

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-3 hover:border-teal-500/30 transition-all">
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
              a: "Click 'Create a Watch Party' anywhere on Synora. Pick a supported media source (a sample open film, a custom MP4/HLS stream URL, an embedded YouTube link, live screen sharing, or Netflix with the browser extension). Choose a room title and nickname, select whether the party is Public or Private, and launch!"
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
              a: "No! The browser extension is only needed for Netflix synchronization. YouTube, sample films, custom direct streaming URLs (.mp4, .m3u8), screen sharing, voice chat, and live chat work out-of-the-box in any modern desktop or mobile browser with zero extensions installed."
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
              onClick={() => handleOpenCreateWithTab('sample')}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-emerald-950/40 flex items-center justify-center gap-2"
            >
              <Sparkles size={18} /> Start Watching Together
            </button>
            <button
              onClick={() => scrollToSection('active-rooms')}
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-2xl font-black text-base transition-all border border-white/10 flex items-center justify-center gap-2"
            >
              <PlayCircle size={18} /> Browse Active Rooms
            </button>
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
        defaultTab={createModalTab}
      />

      <JoinPartyModal 
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />

      {/* Delete Room Confirmation Modal */}
      <AnimatePresence>
        {roomToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRoomToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5"
            >
              <div className="w-16 h-16 bg-red-500/15 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">Delete Watch Party?</h3>
                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                  Are you sure you want to delete <span className="text-white font-bold">"{roomToDelete.title || 'Untitled'}"</span>? This will permanently remove the room, chat history, and invite links.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  disabled={isDeletingRoom}
                  onClick={handleConfirmDeleteRoom}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-950/30 text-sm flex items-center justify-center gap-2"
                >
                  {isDeletingRoom ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={16} /> Delete Permanently
                    </>
                  )}
                </button>
                <button
                  disabled={isDeletingRoom}
                  onClick={() => setRoomToDelete(null)}
                  className="w-full py-2.5 text-gray-400 font-bold hover:text-white transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
