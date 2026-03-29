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
  { view: 'changelog', label: 'Changelog', icon: '📝', adminOnly: true },
];

export default function Layout({ children }) {
  const { tournament, darkMode, currentView } = useTournament();
  const { dispatch } = useDispatch();
  const { isAdmin, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const navItems = isAdmin ? ALL_NAV_ITEMS : ALL_NAV_ITEMS.filter(i => !i.adminOnly);

  return (
    <div className={`h-screen h-[100dvh] flex flex-col lg:flex-row overflow-hidden ${darkMode ? 'bg-navy-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col w-[260px] flex-shrink-0 no-print h-full sticky top-0 border-r ${
        darkMode
          ? 'bg-navy-900/60 backdrop-blur-2xl border-white/[0.06]'
          : 'bg-white/70 backdrop-blur-2xl border-gray-200/80'
      }`}>
        {/* Accent gradient line at top */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />

        {/* Logo Section */}
        <div className={`px-5 py-5 flex items-center justify-center border-b ${darkMode ? 'border-white/[0.06]' : 'border-gray-200/80'}`}>
          <a href="https://www.unisportscouncil.in/" target="_top" className="group">
            <img
              src="/SWW and USC.png"
              alt="SWW & USC"
              className="h-12 object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </a>
        </div>

        {/* Admin Badge */}
        {isAdmin && (
          <div className="px-4 pt-4 pb-1">
            <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-colors ${
              darkMode
                ? 'bg-orange-500/[0.08] border border-orange-500/15'
                : 'bg-orange-50 border border-orange-200/60'
            }`}>
              <span className="text-xs">🛡️</span>
              <span className={`text-xs font-bold tracking-wide ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>Admin Mode</span>
              <button
                onClick={() => logout()}
                className={`ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all ${
                  darkMode
                    ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25'
                    : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                }`}
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5" aria-label="Main navigation">
          {navItems.map(item => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: item.view } })}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-[13px] font-medium transition-all duration-200 relative group ${
                  isActive
                    ? darkMode
                      ? 'bg-accent/[0.08] text-accent shadow-[inset_0_0_0_1px_rgba(0,212,255,0.1)]'
                      : 'bg-accent/[0.06] text-accent-dark shadow-[inset_0_0_0_1px_rgba(0,168,204,0.12)]'
                    : darkMode
                    ? 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
                    : 'text-gray-500 hover:bg-gray-100/80 hover:text-gray-800'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full ${
                    darkMode ? 'bg-accent' : 'bg-accent-dark'
                  }`} />
                )}
                <span className={`text-lg transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {/* Hover glow on active */}
                {isActive && darkMode && (
                  <div className="absolute inset-0 rounded-xl bg-accent/[0.03] pointer-events-none" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className={`px-3 py-3 border-t space-y-0.5 ${darkMode ? 'border-white/[0.06]' : 'border-gray-200/80'}`}>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
              darkMode
                ? 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
                : 'text-gray-500 hover:bg-gray-100/80 hover:text-gray-800'
            }`}
          >
            <span className="text-lg">{darkMode ? '☀️' : '🌙'}</span>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          {!isAdmin && (
            <button
              onClick={() => setShowLogin(true)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                darkMode
                  ? 'text-gray-600 hover:bg-white/[0.04] hover:text-gray-400'
                  : 'text-gray-400 hover:bg-gray-100/80 hover:text-gray-600'
              }`}
            >
              <span className="text-lg">🔒</span>
              Admin Login
            </button>
          )}
          {/* USC Branding */}
          <div className={`flex items-center gap-2 px-3.5 pt-3 pb-1 ${darkMode ? 'opacity-25' : 'opacity-35'}`}>
            <img src="/SWW and USC.png" alt="SWW & USC" className="w-4 h-4 object-contain" />
            <span className="text-[9px] text-gray-500 tracking-wider font-medium">Uni Sports Council, LPU</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <div className={`lg:hidden shrink-0 z-50 flex items-center justify-between px-4 py-3 border-b no-print ${
          darkMode
            ? 'bg-navy-900/80 backdrop-blur-xl border-white/[0.06]'
            : 'bg-white/80 backdrop-blur-xl border-gray-200/80'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <a href="https://www.unisportscouncil.in/" target="_top">
              <img src="/SWW and USC.png" alt="SWW & USC" className="h-8 object-contain flex-shrink-0" />
            </a>
            {isAdmin && (
              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold flex-shrink-0 ${
                darkMode
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'bg-orange-50 text-orange-600 border border-orange-200/60'
              }`}>
                ADMIN
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                onClick={() => logout()}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  darkMode
                    ? 'text-orange-400 hover:bg-orange-500/10'
                    : 'text-orange-600 hover:bg-orange-50'
                }`}
              >
                Logout
              </button>
            )}
            <button
              onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
              className={`text-xl p-1.5 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-100'
              }`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            {!isAdmin && (
              <button
                onClick={() => setShowLogin(true)}
                className={`text-lg p-1.5 rounded-lg opacity-40 hover:opacity-80 transition-all ${
                  darkMode ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-100'
                }`}
                title="Admin Login"
                aria-label="Admin login"
              >
                🔒
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Offline Banner */}
          <OfflineBanner darkMode={darkMode} />
          <div className="p-4 lg:p-6 xl:p-8 max-w-7xl mx-auto animate-fadeIn">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav aria-label="Mobile navigation" className={`lg:hidden shrink-0 flex z-50 no-print border-t ${
          darkMode
            ? 'bg-navy-900/80 backdrop-blur-xl border-white/[0.06]'
            : 'bg-white/80 backdrop-blur-xl border-gray-200/80'
        }`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {navItems.map(item => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: item.view } })}
                className={`flex-1 flex flex-col items-center py-2.5 text-[10px] font-semibold transition-all duration-200 relative ${
                  isActive
                    ? darkMode ? 'text-accent' : 'text-accent-dark'
                    : darkMode ? 'text-gray-500 active:text-gray-400' : 'text-gray-400 active:text-gray-500'
                }`}
              >
                {/* Active top indicator */}
                {isActive && (
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full ${
                    darkMode ? 'bg-accent' : 'bg-accent-dark'
                  }`} />
                )}
                <span className={`text-lg mb-0.5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
                <span className="tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
