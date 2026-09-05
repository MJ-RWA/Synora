import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Radio, Users, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WatchRoom } from '../../types';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalRooms: 0,
    activeRooms: 0,
    users: 0,
  });
  const [rooms, setRooms] = useState<WatchRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [roomsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'watchRooms')),
        getDocs(collection(db, 'users'))
      ]);

      const allRooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() } as WatchRoom));
      const activeCount = allRooms.filter(r => r.isActive).length;

      setStats({
        totalRooms: allRooms.length,
        activeRooms: activeCount,
        users: usersSnap.size
      });

      // Sort rooms by recent
      allRooms.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setRooms(allRooms.slice(0, 20));
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleEndRoom = async (roomId: string) => {
    if (!window.confirm('Are you sure you want to end this watch party room?')) return;
    try {
      await updateDoc(doc(db, 'watchRooms', roomId), {
        isActive: false
      });
      fetchDashboardData();
    } catch (err) {
      console.error("Error ending room:", err);
    }
  };

  const statCards = [
    { title: 'Active Live Rooms', value: stats.activeRooms, icon: Radio, color: 'bg-emerald-500', link: '#' },
    { title: 'Total Watch Parties', value: stats.totalRooms, icon: Sparkles, color: 'bg-purple-500', link: '#' },
    { title: 'Registered Users', value: stats.users, icon: Users, color: 'bg-blue-500', link: '/admin/users' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Watch Party Admin Overview</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor live co-watching rooms and manage platform users</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-3xl group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.color} bg-opacity-20 text-white group-hover:scale-110 transition-transform`}>
                <stat.icon size={24} />
              </div>
              <span className="text-3xl font-black text-white">{stat.value}</span>
            </div>
            <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs">{stat.title}</h3>
          </div>
        ))}
      </div>

      {/* Moderation Table */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Radio size={20} className="text-emerald-400" />
            <h3>Recent & Active Rooms</h3>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="text-xs font-bold text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rooms.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="pb-3">Room Title</th>
                  <th className="pb-3">Host</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Participants</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-white/[0.02]">
                    <td className="py-4 font-bold text-white max-w-xs truncate">
                      {room.title}
                    </td>
                    <td className="py-4 text-gray-300 text-xs">
                      {room.hostName || 'Host'}
                    </td>
                    <td className="py-4">
                      {room.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Live
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-gray-500 text-[10px] font-bold">
                          Ended
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-gray-400 text-xs font-bold">
                      {room.usersCount || 1}
                    </td>
                    <td className="py-4 text-right space-x-2">
                      <button 
                        onClick={() => navigate(`/watchparty/${room.id}`)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all"
                      >
                        Enter
                      </button>

                      {room.isActive && (
                        <button 
                          onClick={() => handleEndRoom(room.id)}
                          className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all"
                          title="Force End Room"
                        >
                          End Room
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No watch rooms created yet.</p>
        )}
      </div>
    </div>
  );
};
