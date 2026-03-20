import { useTournament } from '../context/TournamentContext';

export default function EmptyState({ icon, title, description, action }) {
  const { darkMode } = useTournament();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 animate-fadeIn">
      <div className="relative mb-8">
        <div className={`absolute inset-0 scale-150 rounded-full blur-3xl ${darkMode ? 'bg-accent/[0.06]' : 'bg-accent/[0.04]'}`} />
        <div className="relative text-7xl opacity-50 animate-floatUp">{icon}</div>
      </div>
      <h3 className={`text-xl font-bold mb-2 tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      <p className={`text-center max-w-sm mb-8 text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-6 py-3 bg-accent hover:bg-accent-dark text-navy-900 font-bold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:-translate-y-0.5"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
