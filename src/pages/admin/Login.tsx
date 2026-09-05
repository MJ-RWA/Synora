import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Shield, Lock, Mail, ArrowRight, Chrome, AlertCircle } from 'lucide-react';

export const AdminLogin = () => {
  const { user, loginWithGoogle, loginWithEmail, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate('/admin');
    }
  }, [user, isAdmin, loading, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white/5 border border-white/10 p-10 rounded-[40px] shadow-2xl backdrop-blur-xl">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center text-emerald-500 mb-6">
            <Shield size={40} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Admin Access</h1>
          <p className="text-gray-500 font-medium">Authorized personnel only.</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          {user && !isAdmin ? (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-500 text-sm font-bold text-center">
              Access Denied: Your account does not have administrator privileges.
            </div>
          ) : null}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 p-3 rounded-xl border border-red-400/20">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={authLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            {authLoading ? 'Verifying...' : 'Sign In'}
            {!authLoading && <ArrowRight size={18} />}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-[#050505] px-2 text-gray-600 font-bold">Or</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={async () => {
              setError('');
              setAuthLoading(true);
              try {
                await loginWithGoogle();
              } catch (err: unknown) {
                const error = err as { code?: string; message?: string };
                if (error.code !== 'auth/cancelled-popup-request') {
                  setError(error.message || 'Google login failed');
                }
              } finally {
                setAuthLoading(false);
              }
            }}
            disabled={authLoading}
            className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            <Chrome size={20} />
            {authLoading ? 'Verifying...' : 'Sign in with Google'}
          </button>
        </form>

        <div className="pt-8 border-t border-white/5 flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-2 text-gray-600 text-xs font-bold uppercase tracking-widest">
            <Lock size={12} /> Secure Environment
          </div>
          <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-400 text-xs font-bold uppercase tracking-widest transition-colors">
            <ArrowRight size={14} className="rotate-180" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};
