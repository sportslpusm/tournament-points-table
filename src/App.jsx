import { useEffect, useState } from 'react';
import { TournamentProvider, useTournament, useDispatch } from './context/TournamentContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import ToastContainer from './components/Toast';
import FirstTimeSetup from './components/FirstTimeSetup';
import Dashboard from './pages/Dashboard';
import GameView from './pages/GameView';
import MatchManagement from './pages/MatchManagement';
import TeamManagement from './pages/TeamManagement';
import GamePoolManagement from './pages/GamePoolManagement';
import Settings from './pages/Settings';

function AppContent() {
  const { currentView } = useTournament();
  const { isAdmin, needsSetup, setOnLogoutCallback } = useAuth();
  const { setAdminFlag, showToast } = useDispatch();

  // Track whether setup wizard is still active (persists even after password is set
  // so the recovery key step can be shown)
  const [showingSetup, setShowingSetup] = useState(needsSetup);

  // Sync admin flag to TournamentContext's dispatch guard
  useEffect(() => {
    setAdminFlag(isAdmin);
  }, [isAdmin, setAdminFlag]);

  // Register logout callback for inactivity notification
  useEffect(() => {
    setOnLogoutCallback((reason) => {
      showToast(reason, 'error');
    });
  }, [setOnLogoutCallback, showToast]);

  // Show first-time setup if needed OR if the wizard is still active
  if (needsSetup || showingSetup) {
    return <FirstTimeSetup onComplete={() => setShowingSetup(false)} />;
  }

  // Redirect admin-only views to dashboard if not admin
  const adminOnlyViews = ['gameManagement', 'settings'];
  const effectiveView = (!isAdmin && adminOnlyViews.includes(currentView)) ? 'dashboard' : currentView;

  const pages = {
    dashboard: Dashboard,
    game: GameView,
    matches: MatchManagement,
    teams: TeamManagement,
    gameManagement: GamePoolManagement,
    settings: Settings,
  };

  const Page = pages[effectiveView] || Dashboard;

  return (
    <Layout>
      <Page />
      <ToastContainer />
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TournamentProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TournamentProvider>
    </ErrorBoundary>
  );
}
