import { createContext } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

export interface AuthContextType {
  user: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loginWithGoogle: () => Promise<FirebaseUser | undefined>;
  loginWithEmail: (email: string, pass: string) => Promise<FirebaseUser>;
  registerWithEmail: (email: string, pass: string, username: string) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
