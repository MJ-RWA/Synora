import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { User, FriendRequest } from '../types';
import { Search, UserPlus, UserCheck, UserX, Clock, Users, Bell } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../services/firestoreError';
import { motion, AnimatePresence } from 'framer-motion';

export const Friends = () => {
  const { user, userData } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');

  useEffect(() => {
    if (!user) return;

    // Listen to friends
    const unsubscribeFriends = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as User;
        if (data.friends && data.friends.length > 0) {
          try {
            // Firestore 'in' query allows max 30 items per batch. Chunk safely to avoid crashes.
            const friendUids = data.friends.filter(Boolean);
            const chunks: string[][] = [];
            for (let i = 0; i < friendUids.length; i += 30) {
              chunks.push(friendUids.slice(i, i + 30));
            }
            const allFriends: User[] = [];
            for (const chunk of chunks) {
              const friendsQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
              const friendsSnap = await getDocs(friendsQuery);
              allFriends.push(...friendsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
            }
            setFriends(allFriends);
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'friends_list');
          }
        } else {
          setFriends([]);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Listen to incoming requests
    const qIncoming = query(collection(db, 'friendRequests'), where('to', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribeIncoming = onSnapshot(qIncoming, (snapshot) => {
      setPendingRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'friendRequests_incoming');
    });

    // Listen to outgoing requests
    const qOutgoing = query(collection(db, 'friendRequests'), where('from', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribeOutgoing = onSnapshot(qOutgoing, (snapshot) => {
      setSentRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'friendRequests_outgoing');
    });

    return () => {
      unsubscribeFriends();
      unsubscribeIncoming();
      unsubscribeOutgoing();
    };
  }, [user]);

  const activeFriends = user ? friends : [];
  const activePendingRequests = user ? pendingRequests : [];
  const activeSentRequests = user ? sentRequests : [];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', searchQuery),
        where('username', '<=', searchQuery + '\uf8ff')
      );
      const snap = await getDocs(q);
      setSearchResults(snap.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as User))
        .filter(u => u.uid !== user?.uid)
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users_search');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (targetUser: User) => {
    if (!user || !userData) return;
    try {
      // Check if already friends or request exists
      if (userData.friends?.includes(targetUser.uid)) return;
      
      await addDoc(collection(db, 'friendRequests'), {
        from: user.uid,
        fromUsername: userData.username,
        to: targetUser.uid,
        status: 'pending',
        time: new Date().toISOString()
      });

      // Add notification
      await addDoc(collection(db, 'notifications'), {
        toUser: targetUser.uid,
        type: 'friend_request',
        message: `${userData.username} sent you a friend request`,
        read: false,
        time: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'friend_request');
    }
  };

  const acceptRequest = async (request: FriendRequest) => {
    if (!user || !userData) return;
    try {
      await updateDoc(doc(db, 'friendRequests', request.id), { status: 'accepted' });
      
      // Add to both friends lists
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayUnion(request.from)
      });
      await updateDoc(doc(db, 'users', request.from), {
        friends: arrayUnion(user.uid)
      });

      // Add notification
      await addDoc(collection(db, 'notifications'), {
        toUser: request.from,
        type: 'general',
        message: `${userData.username} accepted your friend request`,
        read: false,
        time: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'accept_request');
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'reject_request');
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayRemove(friendId)
      });
      await updateDoc(doc(db, 'users', friendId), {
        friends: arrayRemove(user.uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'remove_friend');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-white tracking-tighter">FRIENDS</h1>
            <p className="text-gray-500 font-medium">Manage your connections and watch together</p>
          </div>
          
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
            {[
              { id: 'friends', label: 'Friends', icon: Users },
              { id: 'requests', label: 'Requests', icon: Bell },
              { id: 'search', label: 'Find People', icon: Search }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'friends' | 'requests' | 'search')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <tab.icon size={16} />
                {tab.label}
                {tab.id === 'requests' && activePendingRequests.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                    {activePendingRequests.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
          <div className="p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'search' && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by username..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold transition-all"
                    >
                      Search
                    </button>
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {loading ? (
                      <div className="col-span-full py-12 flex justify-center">
                        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(u => (
                        <div key={u.uid} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center font-black text-xl">
                              {u.username[0].toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-white font-bold">{u.username}</h4>
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Member since {new Date(u.createdAt).getFullYear()}</p>
                            </div>
                          </div>
                          {activeFriends.some(f => f.uid === u.uid) ? (
                            <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                              <UserCheck size={14} /> Friends
                            </span>
                          ) : activeSentRequests.some(r => r.to === u.uid) ? (
                            <span className="text-yellow-500 text-xs font-bold flex items-center gap-1">
                              <Clock size={14} /> Pending
                            </span>
                          ) : (
                            <button
                              onClick={() => sendFriendRequest(u)}
                              className="p-2 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-xl transition-all"
                            >
                              <UserPlus size={20} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : searchQuery && (
                      <div className="col-span-full py-12 text-center text-gray-500">No users found matching "{searchQuery}"</div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'friends' && (
                <motion.div
                  key="friends"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {activeFriends.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeFriends.map(friend => (
                        <div key={friend.uid} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center font-black text-xl">
                              {friend.username[0].toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-white font-bold">{friend.username}</h4>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Online</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFriend(friend.uid)}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Remove Friend"
                          >
                            <UserX size={20} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-600">
                        <Users size={40} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white">No friends yet</h3>
                        <p className="text-gray-500 max-w-xs mx-auto">Start searching for people to add them to your friends list!</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('search')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold transition-all"
                      >
                        Find People
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'requests' && (
                <motion.div
                  key="requests"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Incoming Requests</h3>
                    {activePendingRequests.length > 0 ? (
                      activePendingRequests.map(req => (
                        <div key={req.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-lg flex items-center justify-center font-bold">
                              {req.fromUsername[0].toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-white font-bold">{req.fromUsername}</h4>
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Sent {new Date(req.time).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => acceptRequest(req)}
                              className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all"
                              title="Accept"
                            >
                              <UserCheck size={20} />
                            </button>
                            <button
                              onClick={() => rejectRequest(req.id)}
                              className="p-2 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                              title="Reject"
                            >
                              <UserX size={20} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500 text-sm italic">No incoming requests</p>
                    )}
                  </div>

                  <div className="space-y-4 pt-8 border-t border-white/5">
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Sent Requests</h3>
                    {activeSentRequests.length > 0 ? (
                      activeSentRequests.map(req => (
                        <div key={req.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 opacity-60">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 text-gray-400 rounded-lg flex items-center justify-center font-bold">
                              ?
                            </div>
                            <div>
                              <h4 className="text-white font-bold">Pending Request</h4>
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Waiting for response...</p>
                            </div>
                          </div>
                          <button
                            onClick={() => rejectRequest(req.id)}
                            className="text-xs text-gray-500 hover:text-red-500 font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500 text-sm italic">No sent requests</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
