import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  loginWithGoogle, 
  loginWithFacebook, 
  loginWithInstagram, 
  loginWithEmail, 
  registerWithEmail, 
  updateUsername as serviceUpdateUsername,
  updateUserAvatar as serviceUpdateUserAvatar,
  getPhotoUrl,
  logout as firebaseLogout 
} from '../authService';
import { User } from '../types';
import { AuthContext } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      // Clean up previous user doc listener if any
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (u) {
        const isSuperAdminEmail = u.email === "believeinsomething2421@gmail.com";
        const photoUrl = getPhotoUrl(u);
        const fallbackUser: User = {
          uid: u.uid,
          username: u.displayName || (isSuperAdminEmail ? 'Admin' : 'User'),
          email: u.email || '',
          avatarUrl: photoUrl || undefined,
          role: isSuperAdminEmail ? 'admin' : 'user',
          favorites: [],
          history: [],
          friends: [],
          createdAt: new Date().toISOString()
        };
        setUserData(fallbackUser);
        setLoading(false);

        try {
          const docRef = doc(db, 'users', u.uid);
          unsubscribeDoc = onSnapshot(
            docRef,
            (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData({ 
                  uid: u.uid, 
                  ...data,
                  // Ensure photoUrl from provider is preserved if doc avatarUrl is not explicitly set
                  avatarUrl: data.avatarUrl || photoUrl || undefined
                } as User);
              }
            },
            (error) => {
              console.warn("User profile sync fallback:", error.message);
            }
          );
        } catch (err) {
          console.warn("User listener init error:", err);
        }
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
    };
  }, []);

  const handleUpdateUsername = async (newUsername: string) => {
    const updated = await serviceUpdateUsername(newUsername);
    // Optimistically update local state so UI updates instantaneously
    if (user) {
      setUser({ ...user, displayName: updated } as FirebaseUser);
    }
    setUserData(prev => prev ? { ...prev, username: updated } : null);
    return updated;
  };

  const handleUpdateUserAvatar = async (newAvatarUrl: string) => {
    await serviceUpdateUserAvatar(newAvatarUrl);
    if (user) {
      setUser({ ...user, photoURL: newAvatarUrl } as FirebaseUser);
    }
    setUserData(prev => prev ? { ...prev, avatarUrl: newAvatarUrl } : null);
  };

  const isSuperAdmin = user?.email === "believeinsomething2421@gmail.com";
  const isAdmin = userData?.role === 'admin' || isSuperAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        isAdmin,
        isSuperAdmin,
        loginWithGoogle,
        loginWithFacebook,
        loginWithInstagram,
        loginWithEmail,
        registerWithEmail,
        updateUsername: handleUpdateUsername,
        updateUserAvatar: handleUpdateUserAvatar,
        logout: firebaseLogout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
