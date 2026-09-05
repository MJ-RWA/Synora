import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from '../../types';
import { Users as UsersIcon, Shield, ShieldAlert, Search, Mail, Calendar } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';

export const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingUser, setConfirmingUser] = useState<User | null>(null);
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const toggleAdmin = async (user: User) => {
    if (!isSuperAdmin) return;
    const newRole = user.role === 'admin' ? 'user' : 'admin';

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: newRole
      });
      setUsers(users.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
      setConfirmingUser(null);
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-500">
            <UsersIcon size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">User Management</h1>
            <p className="text-gray-500 text-sm font-medium">Manage user roles and permissions</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
        <input 
          type="text" 
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
        />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map(user => (
                <tr key={user.uid} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                        {user.username[0].toUpperCase()}
                      </div>
                      <span className="font-bold text-white">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Mail size={14} />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar size={14} />
                      {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      user.role === 'admin' 
                        ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' 
                        : 'bg-gray-500/20 text-gray-500 border-gray-500/30'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isSuperAdmin && user.email !== "believeinsomething2421@gmail.com" ? (
                      <button 
                        onClick={() => setConfirmingUser(user)}
                        className={`flex items-center gap-2 ml-auto px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          user.role === 'admin'
                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30'
                            : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30'
                        }`}
                      >
                        {user.role === 'admin' ? (
                          <>
                            <ShieldAlert size={14} /> Revoke Admin
                          </>
                        ) : (
                          <>
                            <Shield size={14} /> Grant Admin
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest italic">
                        {user.email === "believeinsomething2421@gmail.com" ? "Super Admin" : "No Actions"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && !loading && (
          <div className="py-20 text-center text-gray-500 italic">No users found matching your search.</div>
        )}
        {loading && (
          <div className="py-20 text-center text-emerald-500 animate-pulse font-bold">Loading users...</div>
        )}
      </div>

      {/* Role Confirmation Modal */}
      {confirmingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              confirmingUser.role === 'admin' ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
            }`}>
              {confirmingUser.role === 'admin' ? <ShieldAlert size={32} /> : <Shield size={32} />}
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-white">Change User Role</h2>
              <p className="text-gray-400 text-sm">
                Are you sure you want to change <span className="text-white font-bold">{confirmingUser.username}</span>'s role to 
                <span className={`ml-1 font-bold ${confirmingUser.role === 'admin' ? 'text-gray-400' : 'text-emerald-500'}`}>
                  {confirmingUser.role === 'admin' ? 'User' : 'Admin'}
                </span>?
              </p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmingUser(null)}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/10"
              >
                Cancel
              </button>
              <button 
                onClick={() => toggleAdmin(confirmingUser)}
                className={`flex-1 px-6 py-3 text-white rounded-xl font-bold transition-all shadow-xl ${
                  confirmingUser.role === 'admin' 
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' 
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
