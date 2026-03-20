import { useState } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';
import SaveIndicator from './SaveIndicator';
import OfflineBanner from './OfflineBanner';

const ALL_NAV_ITEMS = [
  { view: 'dashboard', label: 'Leaderboard', icon: '🏆', adminOnly: false },
  { view: 'game', label: 'Games', icon: '🎮', adminOnly: false },
  { view: 'matches', label: 'Matches', icon: '📋', adminOnly: false },
  { view: 'teams', label: 'Teams', icon: '👥', adminOnly: false },
  { view: 'athletes', label: 'Athletes', icon: '🏃', adminOnly: false },
  { view: 'gameManagement', label: 'Manage', icon: '⚙️', adminOnly: true },
  { view: 'settings', label: 'Settings', icon: '🔧', adminOnly: true },
];

export default function Layout({ children }) {
  const { tournament, darkMode, currentView } = useTournament();
  const { dispatch } = useDispatch();
  const { isAdmin, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const navItems = isAdmin ? ALL_NAV_ITEMS : ALL_NAV_ITEMS.filter(i => !i.adminOnly);

  return (
    <div className={`min-h-screen min-h-[100dvh] flex flex-col lg:flex-row ${darkMode ? 'bg-navy-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col w-64 flex-shrink-0 no-print h-screen sticky top-0 border-r ${
        darkMode
          ? 'bg-navy-900/80 backdrop-blur-xl border-white/5'
          : 'bg-white/80 backdrop-blur-xl border-gray-200'
      }`}>
        {/* Accent gradient line at top */}
        <div className="h-0.5 bg-gradient-to-r from-accent via-blue-500 to-accent/0" />

        <div className={`p-4 flex items-center justify-center border-b ${darkMode ? 'border-white/5' : 'border-gray-200'}`}>
          <a href="https://www.unisportscouncil.in/" target="_top">
            <img src="/SWW and USC.png" alt="SWW & USC" className="h-12 object-contain" />
          </a>
        </div>

        {/* Admin Badge */}
        {isAdmin && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <span className="text-xs">🛡️</span>
              <span className="text-xs font-bold text-orange-400">Admin Mode</span>
              <button
                onClick={() => logout()}
                className="ml-auto text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        <nav className="flex-1 p-2" aria-label="Main navigation">
          {navItems.map(item => (
            <button
              key={item.view}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: item.view } })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-all mb-1 relative ${
                currentView === item.view
                  ? darkMode
                    ? 'bg-accent/10 text-accent'
                    : 'bg-accent/10 text-accent-dark'
                  : darkMode
                  ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {currentView === item.view && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent" />
              )}
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className={`p-4 border-t space-y-1 ${darkMode ? 'border-white/5' : 'border-gray-200'}`}>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${darkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <span className="text-lg">{darkMode ? '☀️' : '🌙'}</span>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          {!isAdmin && (
            <button
              onClick={() => setShowLogin(true)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${darkMode ? 'text-gray-500 hover:bg-white/5 hover:text-gray-300' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            >
              <span className="text-lg">🔒</span>
              Admin Login
            </button>
          )}
          {/* USC Branding */}
          <div className={`flex items-center gap-2 px-3 pt-2 ${darkMode ? 'opacity-30' : 'opacity-40'}`}>
            <img src="/SWW and USC.png" alt="SWW & USC" className="w-4 h-4 object-contain" />
            <span className="text-[9px] text-gray-500 tracking-wide">Uni Sports Council, LPU</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:pb-0" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Offline Banner */}
        <OfflineBanner darkMode={darkMode} />

        {/* Mobile Header */}
        <div className={`lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b no-print ${
          darkMode
            ? 'bg-navy-900/90 backdrop-blur-xl border-white/5'
            : 'bg-white/90 backdrop-blur-xl border-gray-200'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <a href="https://www.unisportscouncil.in/" target="_top">
              <img src="/SWW and USC.png" alt="SWW & USC" className="h-8 object-contain flex-shrink-0" />
            </a>
            {isAdmin && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold flex-shrink-0">
                ADMIN
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button
                onClick={() => logout()}
                className="text-xs px-2 py-1 rounded-lg text-orange-400 hover:bg-orange-500/10 transition-colors"
              >
                Logout
              </button>
            )}
            <button
              onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
              className="text-xl p-1"
              aria-label="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            {!isAdmin && (
              <button
                onClick={() => setShowLogin(true)}
                className="text-lg p-1 opacity-50 hover:opacity-100 transition-opacity"
                title="Admin Login"
                aria-label="Admin login"
              >
                🔒
              </button>
            )}
          </div>
        </div>

        <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fadeIn">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav aria-label="Mobile navigation" className={`lg:hidden fixed bottom-0 left-0 right-0 flex z-40 no-print border-t ${
        darkMode
          ? 'bg-navy-900/90 backdrop-blur-xl border-white/5'
          : 'bg-white/90 backdrop-blur-xl border-gray-200'
      }`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {navItems.map(item => (
          <button
            key={item.view}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: item.view } })}
            className={`flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-all relative ${
              currentView === item.view
                ? 'text-accent'
                : darkMode ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {currentView === item.view && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-accent" />
            )}
            <span className={`text-lg mb-0.5 transition-transform ${currentView === item.view ? 'scale-110' : ''}`}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Login Modal */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
