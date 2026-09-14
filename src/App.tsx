import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { Home } from './pages/Home';
import { WatchParty } from './pages/WatchParty';
import { LiveParty } from './pages/LiveParty';
import { Friends } from './pages/Friends';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Support } from './pages/Support';
import { HowItWorks } from './pages/HowItWorks';
import { NetflixParty } from './pages/NetflixParty';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { DMCA } from './pages/DMCA';
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminLogin } from './pages/admin/Login';
import { AdminUsers } from './pages/admin/Users';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { startAutoRoomCleanup } from './services/roomCleanup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { NetflixExtensionDiagnostics } from './components/NetflixExtensionDiagnostics';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen bg-black" />;
  if (!isAdmin) return <Navigate to="/admin/login" />;
  
  return <AdminLayout>{children}</AdminLayout>;
};

export default function App() {
  React.useEffect(() => {
    // Automatically sweep and delete public rooms inactive for 24+ hours
    const stopCleanup = startAutoRoomCleanup(15);
    return () => stopCleanup();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <Router>
            <ScrollToTop />
            <Routes>
              {/* Main Watch Party Public Routes */}
              <Route path="/" element={<Layout><Home /></Layout>} />
              <Route path="/live/:roomId" element={<Layout><LiveParty /></Layout>} />
              <Route path="/live-party/:roomId" element={<Layout><LiveParty /></Layout>} />
              <Route path="/watchparty/:roomId" element={<Layout><WatchParty /></Layout>} />
              <Route path="/watch-party/:roomId" element={<Layout><WatchParty /></Layout>} />
              <Route path="/room/:roomId" element={<Layout><WatchParty /></Layout>} />
              <Route path="/friends" element={<Layout><Friends /></Layout>} />
              <Route path="/profile" element={<Layout><Profile /></Layout>} />
              <Route path="/support" element={<Layout><Support /></Layout>} />
              <Route path="/how-it-works" element={<Layout><HowItWorks /></Layout>} />
              <Route path="/netflix" element={<Layout><NetflixParty /></Layout>} />
              <Route path="/netflix-party" element={<Layout><NetflixParty /></Layout>} />
              <Route path="/login" element={<Layout><Login /></Layout>} />
              <Route path="/privacy" element={<Layout><PrivacyPolicy /></Layout>} />
              <Route path="/terms" element={<Layout><TermsOfService /></Layout>} />
              <Route path="/dmca" element={<Layout><DMCA /></Layout>} />

              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
              
              {/* Legacy Redirects to Home */}
              <Route path="/movies" element={<Navigate to="/" replace />} />
              <Route path="/movie/:id" element={<Navigate to="/" replace />} />
              <Route path="/football" element={<Navigate to="/" replace />} />
              <Route path="/match/:id" element={<Navigate to="/" replace />} />
              <Route path="/series" element={<Navigate to="/" replace />} />
              <Route path="/series/:id" element={<Navigate to="/" replace />} />
              <Route path="/episode/:id" element={<Navigate to="/" replace />} />
              <Route path="/watch" element={<Navigate to="/" replace />} />
              <Route path="/watch-later" element={<Navigate to="/" replace />} />
              <Route path="/playlists" element={<Navigate to="/" replace />} />
              <Route path="/history" element={<Navigate to="/" replace />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <NetflixExtensionDiagnostics />
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
