import { useEffect } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';

export default function ToastContainer() {
  const { toasts } = useTournament();
  const { dispatch } = useDispatch();

  return (
    <div role="region" aria-live="polite" aria-label="Notifications" className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={() => dispatch({ type: 'REMOVE_TOAST', payload: toast.id })} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const stripeColor = toast.toastType === 'error'
    ? 'bg-red-500'
    : toast.toastType === 'warning'
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  const icon = toast.toastType === 'error'
    ? '✖'
    : toast.toastType === 'warning'
    ? '⚠'
    : '✔';

  return (
    <div
      className="animate-slideInRight pointer-events-auto flex items-center gap-3 min-w-[300px] rounded-xl shadow-2xl overflow-hidden bg-navy-800/90 backdrop-blur-xl border border-white/10"
    >
      <div className={`w-1 self-stretch ${stripeColor}`} />
      <span className="text-lg pl-1">{icon}</span>
      <span className="text-sm font-medium text-white py-3 flex-1">{toast.message}</span>
      <button onClick={onClose} className="text-white/40 hover:text-white pr-3 transition-colors">
        ✕
      </button>
    </div>
  );
}
