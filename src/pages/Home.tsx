import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthenticatedApp } from '../components/AuthenticatedApp';
import { PublicLanding } from '../components/PublicLanding';
import { AppShellLoader } from '../components/AppShellLoader';

export const Home: React.FC = () => {
  const { user, loading } = useAuth();

  // Handle Firebase authentication restoration state to prevent wrong interface flashing
  if (loading) {
    return <AppShellLoader />;
  }

  // Authenticated users directly see the dedicated PWA app shell and dashboard
  if (user) {
    return <AuthenticatedApp />;
  }

  // Public visitors see the marketing landing homepage without active rooms
  return <PublicLanding />;
};
