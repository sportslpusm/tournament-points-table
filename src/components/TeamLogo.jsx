const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function TeamLogo({ team, size = 40, className = '' }) {
  if (!team) return null;

  const sizeClass = {
    24: 'w-6 h-6 text-[10px]',
    32: 'w-8 h-8 text-xs',
    40: 'w-10 h-10 text-sm',
    48: 'w-12 h-12 text-base',
    64: 'w-16 h-16 text-lg',
  }[size] || `text-sm`;

  const style = size in { 24:1, 32:1, 40:1, 48:1, 64:1 } ? {} : { width: size, height: size };

  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt={team.name}
        className={`rounded-full object-cover flex-shrink-0 shadow-sm ${sizeClass} ${className}`}
        style={style}
      />
    );
  }

  const initials = team.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const bg = COLORS[hashCode(team.name) % COLORS.length];

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm ${sizeClass} ${className}`}
      style={{ backgroundColor: bg, ...style }}
    >
      {initials}
    </div>
  );
}
