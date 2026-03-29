import { useEffect, useState } from 'react';
import { TournamentProvider, useTournament, useDispatch } from './context/TournamentContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import ToastContainer from './components/Toast';
import FirstTimeSetup from './components/FirstTimeSetup';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './pages/Dashboard';
import GameView from './pages/GameView';
import IndividualGameView from './pages/IndividualGameView';
import LobbyGameView from './pages/LobbyGameView';
import MatchManagement from './pages/MatchManagement';
import TeamManagement from './pages/TeamManagement';
import AthleteManagement from './pages/AthleteManagement';
import GamePoolManagement from './pages/GamePoolManagement';
import Settings from './pages/Settings';
import ActivityLog from './pages/ActivityLog';
import Changelog from './pages/Changelog';

function GameRouter() {
  const { games, selectedGameId } = useTournament();
  const game = games.find(g => g.id === selectedGameId);
  if (game?.type === 'lobby') return <LobbyGameView />;
  return game?.type === 'individual' ? <IndividualGameView /> : <GameView />;
}

function AppContent() {
  const { currentView } = useTournament();
  const { isAdmin, needsSetup, authLoaded, hasExistingTournament, setOnLogoutCallback } = useAuth();
  const { setAdminFlag, showToast, dataLoaded } = useDispatch();

  // Track whether setup wizard is still active (persists even after password is set
  // so the recovery key step can be shown)
  const [showingSetup, setShowingSetup] = useState(false);

  // Once data is loaded, determine if setup is needed
  useEffect(() => {
    if (dataLoaded && authLoaded && needsSetup) {
      setShowingSetup(true);
    }
  }, [dataLoaded, authLoaded, needsSetup]);

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

  // Show loading screen while data loads from Firestore
  if (!dataLoaded || !authLoaded) {
    return <LoadingScreen />;
  }

  // Show first-time setup if needed OR if the wizard is still active
  if (needsSetup || showingSetup) {
    return <FirstTimeSetup onComplete={() => setShowingSetup(false)} skipTournamentInfo={hasExistingTournament} />;
  }

  // Redirect admin-only views to dashboard if not admin
  const adminOnlyViews = ['gameManagement', 'settings', 'activityLog', 'changelog'];
  const effectiveView = (!isAdmin && adminOnlyViews.includes(currentView)) ? 'dashboard' : currentView;

  const pages = {
    dashboard: Dashboard,
    game: GameRouter,
    matches: MatchManagement,
    teams: TeamManagement,
    athletes: AthleteManagement,
    gameManagement: GamePoolManagement,
    settings: Settings,
    activityLog: ActivityLog,
    changelog: Changelog,
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
      <SyncProvider>
        <TournamentProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </TournamentProvider>
      </SyncProvider>
    </ErrorBoundary>
  );
}
