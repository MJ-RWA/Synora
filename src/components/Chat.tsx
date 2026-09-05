import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Send, X, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../services/firestoreError';

interface ChatProps {
  matchId: string;
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  userId: string;
  username: string;
  createdAt: Timestamp | null;
}

export const Chat: React.FC<ChatProps> = ({ matchId, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { user, userData } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'chatMessages'),
      where('matchId', '==', matchId),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chatMessages');
    });

    return () => unsubscribe();
  }, [matchId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      await addDoc(collection(db, 'chatMessages'), {
        matchId,
        userId: user.uid,
        username: userData?.username || user.displayName || 'Anonymous',
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chatMessages');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/10 w-full lg:w-96 fixed lg:relative right-0 top-0 z-50 shadow-2xl">
      <div className="p-4 border-bottom border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-emerald-500" />
          <h3 className="font-bold text-white">Live Chat</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{msg.username}</span>
              {msg.createdAt && (
                <span className="text-[8px] text-gray-600">
                  {format(msg.createdAt.toDate(), 'HH:mm')}
                </span>
              )}
            </div>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              msg.userId === user?.uid 
                ? 'bg-emerald-600 text-white rounded-tr-none' 
                : 'bg-white/5 text-gray-200 rounded-tl-none border border-white/10'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2 opacity-50">
            <MessageCircle size={48} />
            <p className="text-sm">No messages yet. Be the first!</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-4 bg-white/5 border-t border-white/10">
        {!user ? (
          <div className="text-center py-2">
            <p className="text-xs text-gray-500">Please login to join the chat.</p>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
