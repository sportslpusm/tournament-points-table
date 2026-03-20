import { useState, useEffect } from 'react';
import { useTournament } from '../context/TournamentContext';
import { getPodium } from '../utils/knockout';
import TeamLogo from './TeamLogo';

export default function ChampionDisplay({ gameId }) {
  const state = useTournament();
  const { knockoutMatches, teams, darkMode } = state;
  const [showConfetti, setShowConfetti] = useState(false);

  const podium = getPodium(knockoutMatches, gameId);

  useEffect(() => {
    if (podium.first) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [podium.first]);

  if (!podium.first) return null;

  const firstTeam = teams.find(t => t.id === podium.first);
  if (!firstTeam) return null; // guard: team data not loaded yet
  const secondTeam = teams.find(t => t.id === podium.second);
  const thirdTeam = podium.third ? teams.find(t => t.id === podium.third) : null;

  return (
    <div className={`rounded-2xl border overflow-hidden relative mb-6 ${
      darkMode ? 'bg-navy-850/60 backdrop-blur-xl border-gold/20' : 'bg-white border-gold/30'
    }`}>
      {/* Confetti animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confettiFall"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: ['#ffd700', '#00d4ff', '#ef4444', '#22c55e', '#8b5cf6', '#f59e0b'][i % 6],
                animationDuration: `${2 + Math.random() * 3}s`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Champion Banner */}
      <div className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/10 to-yellow-600/20 p-6 text-center relative">
        <div className="text-4xl mb-2 animate-floatUp">🏆</div>
        <h2 className="text-xl font-black text-gold mb-1.5 tracking-wide">CHAMPION</h2>
        <div className="flex items-center justify-center gap-3">
          <div className="ring-4 ring-gold/30 rounded-xl shadow-lg shadow-gold/20">
            <TeamLogo team={firstTeam} size={56} />
          </div>
          <span className={`text-2xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{firstTeam?.name}</span>
        </div>
      </div>

      {/* Podium */}
      <div className="p-5">
        <div className="flex items-end justify-center gap-4">
          {/* 2nd place */}
          {secondTeam && (
            <div className="text-center flex-1">
              <div className={`rounded-xl p-3 transition-all duration-200 ${darkMode ? 'bg-white/[0.02]' : 'bg-gray-50'}`} style={{ minHeight: '80px' }}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-navy-900 font-bold text-sm mx-auto mb-1.5 flex items-center justify-center shadow-md ring-2 ring-silver/20">2</div>
                <TeamLogo team={secondTeam} size={36} className="mx-auto" />
                <p className="text-xs font-bold mt-1.5">{secondTeam.shortCode}</p>
                <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Finalist</p>
              </div>
            </div>
          )}

          {/* 1st place */}
          <div className="text-center flex-1">
            <div className={`rounded-xl p-3 border-2 border-gold/30 ${darkMode ? 'bg-gold/5' : 'bg-yellow-50'}`} style={{ minHeight: '100px' }}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-navy-900 font-bold text-lg mx-auto mb-1.5 flex items-center justify-center shadow-lg shadow-yellow-500/30 ring-2 ring-gold/30">1</div>
              <TeamLogo team={firstTeam} size={40} className="mx-auto" />
              <p className="text-sm font-black mt-1.5">{firstTeam?.shortCode}</p>
              <p className="text-[10px] text-gold font-bold">Champion</p>
            </div>
          </div>

          {/* 3rd place */}
          {thirdTeam && (
            <div className="text-center flex-1">
              <div className={`rounded-xl p-3 transition-all duration-200 ${darkMode ? 'bg-white/[0.02]' : 'bg-gray-50'}`} style={{ minHeight: '70px' }}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-sm mx-auto mb-1.5 flex items-center justify-center shadow-md ring-2 ring-bronze/20">3</div>
                <TeamLogo team={thirdTeam} size={32} className="mx-auto" />
                <p className="text-xs font-bold mt-1.5">{thirdTeam.shortCode}</p>
                <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>3rd Place</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
