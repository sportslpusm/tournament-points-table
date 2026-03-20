import { useTournament } from '../context/TournamentContext';

export default function EmptyState({ icon, title, description, action }) {
  const { darkMode } = useTournament();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
      <div className="relative mb-6">
        <div className={`absolute inset-0 rounded-full blur-2xl ${darkMode ? 'bg-accent/10' : 'bg-accent/5'}`} />
        <div className="relative text-7xl opacity-60">{icon}</div>
      </div>
      <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      <p className={`text-center max-w-md mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-6 py-3 bg-accent hover:bg-accent-dark text-navy-900 font-bold rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
