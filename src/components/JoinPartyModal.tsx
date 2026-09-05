import React, { useState } from 'react';
import { X, LogIn, KeyRound, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface JoinPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinPartyModal: React.FC<JoinPartyModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [roomInput, setRoomInput] = useState('');
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let input = roomInput.trim();
    if (!input) {
      setError('Please enter a room code or link');
      return;
    }

    // If a full URL is pasted, extract the roomId
    if (input.includes('/watchparty/')) {
      const parts = input.split('/watchparty/');
      input = parts[1]?.split('?')[0] || input;
    } else if (input.includes('/watch-party/')) {
      const parts = input.split('/watch-party/');
      input = parts[1]?.split('?')[0] || input;
    } else if (input.includes('/room/')) {
      const parts = input.split('/room/');
      input = parts[1]?.split('?')[0] || input;
    }

    const name = nickname.trim() || user?.displayName || 'Guest';

    onClose();
    navigate(`/watchparty/${input}?username=${encodeURIComponent(name)}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#141414] border border-white/10 rounded-[32px] w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <LogIn size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Join a Watch Party</h2>
              <p className="text-xs text-gray-400">Enter your room code or party link</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="p-6 md:p-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Room Code or Invite Link</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text" 
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="e.g. 7mK9Qz or paste invite URL"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-10 pr-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Nickname</label>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
          >
            Join Party <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
