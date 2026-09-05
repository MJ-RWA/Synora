import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../context/auth-context';
import { AuthProvider } from '../context/AuthContext';

export { AuthProvider };
export type { AuthContextType };

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
