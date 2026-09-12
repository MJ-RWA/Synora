import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Notification } from '../types';
import { Bell, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { handleFirestoreError, OperationType } from '../services/firestoreError';

export const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('toUser', '==', user.uid),
      orderBy('time', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const activeNotifications = user ? notifications : [];

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleAction = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.type === 'invite' && notif.roomId) {
      navigate(`/watchparty/${notif.roomId}`);
      setIsOpen(false);
    } else if (notif.type === 'friend_request') {
      navigate('/friends');
      setIsOpen(false);
    }
  };

  const unreadCount = activeNotifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        id="notifications-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 shadow-sm transition-all shrink-0"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#0f0f0f] shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed md:absolute right-4 md:right-0 left-4 md:left-auto top-20 md:top-full mt-2 w-auto md:w-80 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h3 className="font-black text-xs uppercase tracking-widest text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-emerald-500">{unreadCount} New</span>
                )}
              </div>

              <div className="max-h-[60vh] md:max-h-96 overflow-y-auto scrollbar-hide">
                {activeNotifications.length > 0 ? (
                  activeNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 border-b border-white/5 hover:bg-white/5 transition-all flex gap-3 group ${!notif.read ? 'bg-emerald-500/5' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        notif.type === 'invite' ? 'bg-emerald-500/20 text-emerald-500' : 
                        notif.type === 'friend_request' ? 'bg-blue-500/20 text-blue-500' : 
                        'bg-gray-500/20 text-gray-500'
                      }`}>
                        <Bell size={18} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm text-gray-200 leading-tight">{notif.message}</p>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                          {new Date(notif.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleAction(notif)}
                            className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                          >
                            {notif.type === 'invite' ? 'Join Party' : 'View'} <ExternalLink size={10} />
                          </button>
                          {!notif.read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center space-y-2">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-700">
                      <Bell size={24} />
                    </div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">All caught up!</p>
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 bg-white/5 border-t border-white/5 text-center">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
