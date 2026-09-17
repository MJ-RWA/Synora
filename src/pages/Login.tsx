import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Chrome, Facebook, Instagram, ArrowRight, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  
  const { loginWithGoogle, loginWithFacebook, loginWithInstagram, loginWithEmail, registerWithEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        if (!username) throw new Error('Username is required');
        await registerWithEmail(email, password, username);
      }
      navigate(redirect);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    setActiveProvider('google');
    try {
      const u = await loginWithGoogle();
      if (u) navigate(redirect);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code !== 'auth/cancelled-popup-request') {
        setError(error.message || 'Google login failed');
      }
    } finally {
      setLoading(false);
      setActiveProvider(null);
    }
  };

  const handleFacebookLogin = async () => {
    setError('');
    setLoading(true);
    setActiveProvider('facebook');
    try {
      const u = await loginWithFacebook();
      if (u) navigate(redirect);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        setError(error.message || 'Facebook login failed');
      }
    } finally {
      setLoading(false);
      setActiveProvider(null);
    }
  };

  const handleInstagramLogin = async () => {
    setError('');
    setLoading(true);
    setActiveProvider('instagram');
    try {
      const u = await loginWithInstagram();
      if (u) navigate(redirect);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        setError(error.message || 'Instagram login failed');
      }
    } finally {
      setLoading(false);
      setActiveProvider(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-[#050505]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-12 backdrop-blur-xl shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-500 font-medium">
              {isLogin ? 'Sign in to continue streaming' : 'Join Synora today'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-bold"
                >
                  <AlertCircle size={18} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {!isLogin && (
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="email"
                placeholder="Email Address"
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
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 group"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Sign Up'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em]">
                <span className="bg-[#050505] px-4 text-gray-600 font-bold">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button 
                type="button"
                id="login-google-btn"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white text-black font-bold py-3.5 px-3 rounded-2xl hover:bg-gray-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg text-xs"
              >
                {loading && activeProvider === 'google' ? (
                  <Loader2 size={16} className="animate-spin text-black" />
                ) : (
                  <Chrome size={16} className="text-black shrink-0" />
                )}
                <span>Google</span>
              </button>

              <button 
                type="button"
                id="login-facebook-btn"
                onClick={handleFacebookLogin}
                disabled={loading}
                className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-3.5 px-3 rounded-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-950/30 text-xs"
              >
                {loading && activeProvider === 'facebook' ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Facebook size={16} className="text-white shrink-0 fill-current" />
                )}
                <span>Facebook</span>
              </button>

              <button 
                type="button"
                id="login-instagram-btn"
                onClick={handleInstagramLogin}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-95 text-white font-bold py-3.5 px-3 rounded-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-950/30 text-xs"
              >
                {loading && activeProvider === 'instagram' ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Instagram size={16} className="text-white shrink-0" />
                )}
                <span>Instagram</span>
              </button>
            </div>

            {isInIframe && (
              <div className="mt-4 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-center">
                <p className="text-blue-300 text-xs font-semibold mb-2">
                  Running inside preview? Open in a full tab for popup social login, or use Email & Password.
                </p>
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs font-bold underline transition-all"
                >
                  Launch in New Window <ArrowRight size={13} />
                </a>
              </div>
            )}
          </form>

          <div className="mt-8 text-center space-y-4">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-gray-500 hover:text-white text-sm font-bold transition-colors block w-full"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
            <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-400 text-xs font-bold uppercase tracking-widest transition-colors">
              <ArrowRight size={14} className="rotate-180" /> Back to Home
            </Link>
          </div>
        </div>
        
        <p className="mt-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.2em] font-bold">
          By continuing, you agree to our Terms of Service
        </p>
      </motion.div>
    </div>
  );
};
