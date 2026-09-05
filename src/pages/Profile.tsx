import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mail, Shield, Calendar, LogOut } from 'lucide-react';

export const Profile = () => {
  const { user, logout, isAdmin } = useAuth();

  if (!user) return (
    <div className="min-h-[60vh] flex items-center justify-center text-gray-500">
      Please login to view your profile.
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center text-white text-4xl font-black mb-4 border-4 border-white/30">
            {user.displayName?.[0] || 'U'}
          </div>
          <h1 className="text-2xl font-black text-white">{user.displayName || 'Synora User'}</h1>
          {isAdmin && (
            <span className="inline-block mt-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-white border border-white/30">
              Administrator
            </span>
          )}
        </div>

        {/* Info List */}
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-500">
              <Mail size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email Address</p>
              <p className="text-white font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500">
              <Shield size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Account Status</p>
              <p className="text-white font-medium">Verified Account</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="p-3 bg-purple-500/20 rounded-xl text-purple-500">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Member Since</p>
              <p className="text-white font-medium">March 2026</p>
            </div>
          </div>

          <button 
            onClick={logout}
            className="w-full mt-8 flex items-center justify-center gap-2 p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all font-bold"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
