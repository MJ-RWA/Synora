import React, { useState, useEffect, useCallback } from 'react';
import { 
  Radio, 
  Sparkles, 
  Users, 
  Tv, 
  Plus, 
  Clock, 
  Lock, 
  Globe, 
  Share2, 
  Check, 
  Film, 
  Youtube, 
  Monitor, 
  LogIn, 
  Trash2, 
  Play, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Award, 
  User as UserIcon, 
  LogOut, 
  ShieldCheck 
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { WatchRoom } from '../types';
import { WatchPartyModal } from './WatchPartyModal';
import { JoinPartyModal } from './JoinPartyModal';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeToggle } from './ThemeToggle';
import { PaginationControls } from './PaginationControls';
import { isRoomInactiveFor24Hours } from '../services/roomCleanup';
import { motion, AnimatePresence } from 'framer-motion';

export const AuthenticatedApp: React.FC = () => {
  const { user, userData, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  // State
  const [activeRooms, setActiveRooms] = useState<WatchRoom[]>([]);
  const [myWatchParties, setMyWatchParties] = useState<WatchRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingMyRooms, setIsLoadingMyRooms] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modals & Navigation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<'custom' | 'embed' | 'screen' | 'netflix'>('embed');
  const [roomToDelete, setRoomToDelete] = useState<WatchRoom | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'all' | 'my' | 'active'>('all');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  // Pagination State
  const [myPage, setMyPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Reset pagination when search query or tab changes
  useEffect(() => {
    setMyPage(1);
    setActivePage(1);
  }, [searchQuery, selectedTab]);

  // User watch time calculations
  const totalMinutes = Math.floor((userData?.totalWatchSeconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const watchTimeFormatted = `${hours}h ${minutes}m`;

  // Fetch User's Created/Saved Rooms
  const fetchAllUserRooms = useCallback(async () => {
    setIsLoadingMyRooms(true);
    try {
      const foundRooms: Map<string, WatchRoom> = new Map();

      // 1. Check localStorage for rooms saved / created by user on this client
      try {
        const savedIdsRaw = localStorage.getItem('synora_saved_room_ids');
        const savedIds: string[] = savedIdsRaw ? JSON.parse(savedIdsRaw) : [];
        
        const createdRoomsRaw = localStorage.getItem('synora_created_rooms');
        const createdRooms: WatchRoom[] = createdRoomsRaw ? JSON.parse(createdRoomsRaw) : [];
        createdRooms.forEach(r => {
          if (r && r.id) foundRooms.set(r.id, r);
        });

        if (savedIds.length > 0) {
          for (const rId of savedIds.slice(0, 15)) {
            if (!foundRooms.has(rId)) {
              try {
                const rSnap = await getDoc(doc(db, 'watchRooms', rId));
                if (rSnap.exists()) {
                  foundRooms.set(rId, { id: rSnap.id, ...rSnap.data() } as WatchRoom);
                }
              } catch (err) {
                console.warn(`Could not fetch saved room ${rId}:`, err);
              }
            }
          }
        }
      } catch (localErr) {
        console.warn('Error reading local saved rooms:', localErr);
      }

      // 2. Query Firestore for rooms where user is hostId or ownerId
      if (user?.uid) {
        try {
          const hostQuery = query(
            collection(db, 'watchRooms'),
            where('hostId', '==', user.uid)
          );
          const hostSnap = await getDocs(hostQuery);
          hostSnap.forEach(docSnap => {
            foundRooms.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as WatchRoom);
          });

          const ownerQuery = query(
            collection(db, 'watchRooms'),
            where('ownerId', '==', user.uid)
          );
          const ownerSnap = await getDocs(ownerQuery);
          ownerSnap.forEach(docSnap => {
            foundRooms.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as WatchRoom);
          });
        } catch (firestoreErr) {
          console.warn('Error querying user rooms by hostId/ownerId:', firestoreErr);
        }
      }

      const roomsList = Array.from(foundRooms.values());
      roomsList.sort((a, b) => {
        const timeA = a.updatedAt || a.createdAt || 0;
        const timeB = b.updatedAt || b.createdAt || 0;
        return timeB - timeA;
      });

      setMyWatchParties(roomsList);
    } catch (err) {
      console.error('Error fetching my watch parties:', err);
    } finally {
      setIsLoadingMyRooms(false);
    }
  }, [user?.uid]);

  // Real-time listener for user rooms
  useEffect(() => {
    fetchAllUserRooms();

    if (!user?.uid) return;

    const qHost = query(
      collection(db, 'watchRooms'),
      where('hostId', '==', user.uid)
    );

    const unsubHost = onSnapshot(qHost, (snap) => {
      setMyWatchParties(prev => {
        const map = new Map(prev.map(r => [r.id, r]));
        snap.forEach(d => {
          map.set(d.id, { id: d.id, ...d.data() } as WatchRoom);
        });
        const list = Array.from(map.values());
        list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        return list;
      });
    }, (err) => console.warn('Error in host listener:', err));

    const qOwner = query(
      collection(db, 'watchRooms'),
      where('ownerId', '==', user.uid)
    );

    const unsubOwner = onSnapshot(qOwner, (snap) => {
      setMyWatchParties(prev => {
        const map = new Map(prev.map(r => [r.id, r]));
        snap.forEach(d => {
          map.set(d.id, { id: d.id, ...d.data() } as WatchRoom);
        });
        const list = Array.from(map.values());
        list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        return list;
      });
    }, (err) => console.warn('Error in owner listener:', err));

    return () => {
      unsubHost();
      unsubOwner();
    };
  }, [user?.uid, fetchAllUserRooms]);

  // Real-time listener for active rooms (public only, visible strictly to authenticated users)
  useEffect(() => {
    setIsLoadingRooms(true);
    const q = query(
      collection(db, 'watchRooms'),
      where('isActive', '==', true),
      where('isPrivate', '==', false),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms: WatchRoom[] = [];
      snapshot.forEach((docSnap) => {
        const roomData = { id: docSnap.id, ...docSnap.data() } as WatchRoom;
        if (isRoomInactiveFor24Hours(roomData)) {
          // Automatically delete public rooms inactive for 24+ hours
          deleteDoc(doc(db, 'watchRooms', docSnap.id)).catch((err) => {
            console.warn('[AutoClean] Could not delete inactive room:', docSnap.id, err);
          });
        } else {
          rooms.push(roomData);
        }
      });
      rooms.sort((a, b) => (b.lastActivity || b.updatedAt || 0) - (a.lastActivity || a.updatedAt || 0));
      setActiveRooms(rooms);
      setIsLoadingRooms(false);
    }, (err) => {
      console.error("Firestore rooms subscription error:", err);
      setIsLoadingRooms(false);
    });

    return () => unsubscribe();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllUserRooms();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleOpenCreateWithTab = (tab: 'custom' | 'embed' | 'screen' | 'netflix') => {
    setCreateModalTab(tab);
    setIsCreateModalOpen(true);
  };

  const handleCopyLink = (roomId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `${window.location.origin}/watchparty/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedRoomId(roomId);
    setTimeout(() => {
      setCopiedRoomId(null);
    }, 2500);
  };

  const handleReopenParty = async (roomItem: WatchRoom) => {
    try {
      const isOwner = user?.uid === roomItem.hostId || user?.uid === roomItem.ownerId;
      if (isOwner && !roomItem.isActive) {
        await updateDoc(doc(db, 'watchRooms', roomItem.id), {
          isActive: true,
          updatedAt: Date.now(),
          lastActivity: Date.now()
        });
      }
      navigate(`/watchparty/${roomItem.id}`, {
        state: { 
          initialRoom: { ...roomItem, isActive: true },
          isHostCreation: isOwner
        }
      });
    } catch (err) {
      console.warn("Could not reactivate room document before navigation:", err);
      navigate(`/watchparty/${roomItem.id}`);
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'watchRooms', roomToDelete.id));

      try {
        const savedIdsRaw = localStorage.getItem('synora_saved_room_ids');
        if (savedIdsRaw) {
          const ids: string[] = JSON.parse(savedIdsRaw);
          localStorage.setItem('synora_saved_room_ids', JSON.stringify(ids.filter(id => id !== roomToDelete.id)));
        }
        const createdRaw = localStorage.getItem('synora_created_rooms');
        if (createdRaw) {
          const rooms: WatchRoom[] = JSON.parse(createdRaw);
          localStorage.setItem('synora_created_rooms', JSON.stringify(rooms.filter(r => r.id !== roomToDelete.id)));
        }
      } catch (storageErr) {
        console.warn("Error cleaning local room storage:", storageErr);
      }

      setMyWatchParties(prev => prev.filter(r => r.id !== roomToDelete.id));
      setActiveRooms(prev => prev.filter(r => r.id !== roomToDelete.id));
      setRoomToDelete(null);
    } catch (err) {
      console.error("Failed to delete watch room:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered lists based on search and tab
  const filteredMyParties = myWatchParties.filter(room => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (room.title && room.title.toLowerCase().includes(q)) ||
      (room.hostName && room.hostName.toLowerCase().includes(q)) ||
      (room.mediaType && room.mediaType.toLowerCase().includes(q)) ||
      (room.mediaTitle && room.mediaTitle.toLowerCase().includes(q))
    );
  });

  const filteredActiveRooms = activeRooms.filter(room => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (room.title && room.title.toLowerCase().includes(q)) ||
      (room.hostName && room.hostName.toLowerCase().includes(q)) ||
      (room.mediaType && room.mediaType.toLowerCase().includes(q)) ||
      (room.mediaTitle && room.mediaTitle.toLowerCase().includes(q))
    );
  });

  // Pagination slices & calculations
  const totalMyPages = Math.ceil(filteredMyParties.length / pageSize) || 1;
  const paginatedMyParties = filteredMyParties.slice((myPage - 1) * pageSize, myPage * pageSize);

  const totalActivePages = Math.ceil(filteredActiveRooms.length / pageSize) || 1;
  const paginatedActiveRooms = filteredActiveRooms.slice((activePage - 1) * pageSize, activePage * pageSize);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 pb-28 md:pb-12">
      {/* Top App Shell Bar / Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-black border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* User Profile Summary */}
          <div className="flex items-center gap-4">
            <Link 
              to="/profile" 
              className="relative group shrink-0"
              title="View Profile"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/40 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-[14px] bg-black flex items-center justify-center text-white font-black text-xl sm:text-2xl">
                  {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black" title="Online" />
            </Link>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                  Watch Party Shell
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome, {user?.displayName || user?.email?.split('@')[0] || 'Friend'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 flex items-center gap-3">
                <span>{user?.email}</span>
                <span className="text-gray-600">•</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Clock size={13} /> {watchTimeFormatted} watched
                </span>
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              id="appCreatePartyBtn"
              onClick={() => handleOpenCreateWithTab('embed')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              <Sparkles size={15} />
              <span>New Party</span>
            </button>

            <button
              id="appJoinCodeBtn"
              onClick={() => setIsJoinModalOpen(true)}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-2 active:scale-95"
            >
              <LogIn size={15} />
              <span>Join Code</span>
            </button>

            <button
              onClick={handleManualRefresh}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/10"
              title="Refresh Room Lists"
              aria-label="Refresh Rooms"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-400' : ''} />
            </button>

            <ThemeToggle />

            <div className="hidden sm:block">
              <PWAInstallButton variant="navbar" />
            </div>

            <Link
              to="/profile"
              className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/10"
              title="Account Settings"
            >
              <UserIcon size={15} />
            </Link>

            <button
              onClick={logout}
              className="p-2.5 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-xl transition-all border border-white/10"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Source Launchers (PWA style quick grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => handleOpenCreateWithTab('embed')}
          className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-red-500/40 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Youtube size={20} />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white group-hover:text-red-400 transition-colors">
              YouTube Party
            </div>
            <div className="text-[10px] text-gray-400">Sync with URL</div>
          </div>
        </button>

        <button
          onClick={() => handleOpenCreateWithTab('netflix')}
          className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-emerald-500/40 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Tv size={20} />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
              Netflix Sync
            </div>
            <div className="text-[10px] text-gray-400">Companion bridge</div>
          </div>
        </button>

        <button
          onClick={() => handleOpenCreateWithTab('custom')}
          className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-blue-500/40 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Film size={20} />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
              Direct Stream
            </div>
            <div className="text-[10px] text-gray-400">MP4 / HLS feed</div>
          </div>
        </button>

        <button
          onClick={() => handleOpenCreateWithTab('screen')}
          className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-purple-500/40 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Monitor size={20} />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
              Screen Share
            </div>
            <div className="text-[10px] text-gray-400">Low-latency WebRTC</div>
          </div>
        </button>
      </div>

      {/* App Navigation & Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        {/* Navigation Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5 self-start overflow-x-auto max-w-full">
          <button
            onClick={() => setSelectedTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedTab === 'all'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All Parties ({myWatchParties.length + activeRooms.length})
          </button>

          <button
            onClick={() => setSelectedTab('my')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedTab === 'my'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>My Parties</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
              {myWatchParties.length}
            </span>
          </button>

          <button
            onClick={() => setSelectedTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedTab === 'active'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Lobby</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
              {activeRooms.length}
            </span>
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parties by title or host..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: My Watch Parties */}
      {(selectedTab === 'all' || selectedTab === 'my') && (
        <section id="my-watch-parties" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  My Watch Parties
                </h2>
                <p className="text-xs text-gray-400">
                  Parties you hosted, configured, or saved to your account.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleOpenCreateWithTab('embed')}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              <Plus size={14} /> Create Room
            </button>
          </div>

          {isLoadingMyRooms ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-44 rounded-3xl bg-white/[0.02] border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : filteredMyParties.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 text-gray-400 flex items-center justify-center mx-auto">
                <Tv size={24} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-white">
                  {searchQuery ? 'No matching parties found' : 'No watch parties yet'}
                </h3>
                <p className="text-xs text-gray-400">
                  {searchQuery 
                    ? 'Try searching for a different keyword or reset the search.'
                    : 'Start your first Watch Party with YouTube, direct stream, Netflix, or screen sharing.'}
                </p>
              </div>
              <button
                onClick={() => handleOpenCreateWithTab('embed')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 inline-flex items-center gap-2"
              >
                <Sparkles size={14} /> Start a Watch Party
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedMyParties.map((room) => {
                const isOwner = user?.uid === room.hostId || user?.uid === room.ownerId;
                const isCopied = copiedRoomId === room.id;

                return (
                  <motion.div
                    key={room.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-emerald-500/30 rounded-3xl p-5 sm:p-6 transition-all flex flex-col justify-between group shadow-lg"
                  >
                    <div className="space-y-3">
                      {/* Status Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {room.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              Active Session
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 text-[10px] font-black uppercase tracking-wider">
                              Saved Room
                            </span>
                          )}

                          {room.isPrivate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold">
                              <Lock size={10} /> Private
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                              <Globe size={10} /> Public
                            </span>
                          )}
                        </div>

                        {/* Delete Action Button (Owner only) */}
                        {isOwner && (
                          <button
                            onClick={() => setRoomToDelete(room)}
                            className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Delete Room Permanently"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      {/* Title & Media */}
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                          {room.title || 'Untitled Watch Party'}
                        </h3>
                        <p className="text-xs text-gray-400 line-clamp-1 mt-0.5 flex items-center gap-1.5">
                          <Film size={12} className="text-emerald-400 shrink-0" />
                          <span>{room.mediaTitle || room.mediaType || 'Media Stream'}</span>
                        </p>
                      </div>

                      {/* Participants & Metadata */}
                      <div className="pt-2 flex items-center justify-between text-xs text-gray-400 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                          <Users size={13} className="text-gray-400" />
                          <span>{room.participantCount || 1} participant{(room.participantCount || 1) !== 1 ? 's' : ''}</span>
                        </div>

                        {room.inviteCode && (
                          <div className="font-mono text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            Code: {room.inviteCode}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Room Action Buttons */}
                    <div className="mt-5 pt-3 border-t border-white/5 flex items-center gap-2">
                      <button
                        onClick={() => handleReopenParty(room)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950/30 flex items-center justify-center gap-1.5"
                      >
                        <Play size={13} />
                        <span>{room.isActive ? 'Return to Room' : 'Reopen Party'}</span>
                      </button>

                      <button
                        onClick={(e) => handleCopyLink(room.id, e)}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                          isCopied 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                            : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                        }`}
                        title="Copy Room Link"
                      >
                        {isCopied ? <Check size={15} /> : <Share2 size={15} />}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
              </div>

              <PaginationControls
                currentPage={myPage}
                totalPages={totalMyPages}
                totalItems={filteredMyParties.length}
                pageSize={pageSize}
                onPageChange={setMyPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setMyPage(1);
                }}
                itemName="watch parties"
              />
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: Active Watch Parties (Strictly Authenticated Lobby) */}
      {(selectedTab === 'all' || selectedTab === 'active') && (
        <section id="active-watch-parties" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                <Radio size={16} className="text-emerald-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Active Watch Parties
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                    Live Now
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Public rooms currently streaming and open for you to join.
                </p>
              </div>
            </div>

            <button
              onClick={handleManualRefresh}
              className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingRooms ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-44 rounded-3xl bg-white/[0.02] border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : filteredActiveRooms.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 text-gray-400 flex items-center justify-center mx-auto">
                <Radio size={24} className="text-gray-500" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-white">No active public rooms right now</h3>
                <p className="text-xs text-gray-400">
                  Be the first to fire up a stream or invite your friends to start watching.
                </p>
              </div>
              <button
                onClick={() => handleOpenCreateWithTab('embed')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 inline-flex items-center gap-2"
              >
                <Sparkles size={14} /> Start a Live Party
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedActiveRooms.map((room) => {
                  const isHost = user?.uid === room.hostId || user?.uid === room.ownerId;
                  const isCopied = copiedRoomId === room.id;

                  return (
                    <motion.div
                      key={room.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-blue-500/30 rounded-3xl p-5 sm:p-6 transition-all flex flex-col justify-between group shadow-lg"
                    >
                      <div className="space-y-3">
                        {/* Status Header */}
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Playing
                          </span>

                          {isHost ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                              Your Room
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium">
                              Host: {room.hostName || 'Streamer'}
                            </span>
                          )}
                        </div>

                        {/* Title & Media */}
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                            {room.title || 'Live Watch Room'}
                          </h3>
                          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5 flex items-center gap-1.5">
                            <Film size={12} className="text-blue-400 shrink-0" />
                            <span>{room.mediaTitle || room.mediaType || 'Media Stream'}</span>
                          </p>
                        </div>

                        {/* Participant Count */}
                        <div className="pt-2 flex items-center justify-between text-xs text-gray-400 border-t border-white/5">
                          <div className="flex items-center gap-1.5">
                            <Users size={13} className="text-blue-400" />
                            <span>{room.participantCount || 1} participant{(room.participantCount || 1) !== 1 ? 's' : ''} in room</span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <ShieldCheck size={12} /> Sync Online
                          </span>
                        </div>
                      </div>

                      {/* Room Action Buttons */}
                      <div className="mt-5 pt-3 border-t border-white/5 flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/watchparty/${room.id}`)}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950/30 flex items-center justify-center gap-1.5"
                        >
                          <Play size={13} />
                          <span>{isHost ? 'Return to Room' : 'Enter Room'}</span>
                        </button>

                        <button
                          onClick={(e) => handleCopyLink(room.id, e)}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                            isCopied 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                          }`}
                          title="Copy Room Link"
                        >
                          {isCopied ? <Check size={15} /> : <Share2 size={15} />}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <PaginationControls
                currentPage={activePage}
                totalPages={totalActivePages}
                totalItems={filteredActiveRooms.length}
                pageSize={pageSize}
                onPageChange={setActivePage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setActivePage(1);
                }}
                itemName="live rooms"
              />
            </div>
          )}
        </section>
      )}

      {/* Account & Community Quick Card */}
      <div className="rounded-3xl bg-white/[0.02] border border-white/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
            <Award size={22} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              Connect with Friends & Track Watch Time
            </div>
            <div className="text-xs text-gray-400">
              Check out your achievements, watch streak, and join party rooms together.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/friends"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/10"
          >
            Friend Network
          </Link>
          <Link
            to="/profile"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/30"
          >
            My Profile
          </Link>
        </div>
      </div>

      {/* PWA Mobile Bottom Navigation Bar */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] flex items-center justify-around shadow-2xl"
      >
        <button
          onClick={() => setSelectedTab('all')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            selectedTab === 'all' ? 'text-emerald-400 font-bold' : 'text-gray-400'
          }`}
        >
          <Tv size={18} />
          <span className="text-[10px]">Parties</span>
        </button>

        <button
          onClick={() => handleOpenCreateWithTab('embed')}
          className="flex flex-col items-center gap-1 py-1 px-3 -mt-4"
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-950/50 border-2 border-black active:scale-95 transition-transform">
            <Plus size={22} />
          </div>
          <span className="text-[10px] font-bold text-emerald-400">Create</span>
        </button>

        <button
          onClick={() => setIsJoinModalOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-gray-400 hover:text-white transition-all"
        >
          <LogIn size={18} />
          <span className="text-[10px]">Join Code</span>
        </button>

        <Link
          to="/friends"
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-gray-400 hover:text-white transition-all"
        >
          <Users size={18} />
          <span className="text-[10px]">Friends</span>
        </Link>

        <Link
          to="/profile"
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-gray-400 hover:text-white transition-all"
        >
          <UserIcon size={18} />
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>

      {/* Delete Room Confirmation Dialog */}
      <AnimatePresence>
        {roomToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">Delete Watch Party?</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to permanently delete "{roomToDelete.title || 'this room'}"? All participants will be disconnected and the room cannot be restored.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setRoomToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-all border border-white/10"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDeleteRoom}
                  disabled={isDeleting}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-950/40 flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <span>Deleting...</span>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Delete Party</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
