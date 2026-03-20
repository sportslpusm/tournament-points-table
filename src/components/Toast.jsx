import { useEffect } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';

export default function ToastContainer() {
  const { toasts } = useTournament();
  const { dispatch } = useDispatch();

  return (
    <div role="region" aria-live="polite" aria-label="Notifications" className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 pointer-events-none">
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

  const iconColor = toast.toastType === 'error'
    ? 'text-red-400'
    : toast.toastType === 'warning'
    ? 'text-amber-400'
    : 'text-emerald-400';

  return (
    <div
      className="animate-slideInRight pointer-events-auto flex items-center gap-3 min-w-[320px] max-w-[420px] rounded-xl shadow-2xl shadow-black/30 overflow-hidden bg-navy-850/95 backdrop-blur-xl border border-white/[0.08]"
    >
      <div className={`w-[3px] self-stretch rounded-r-full ${stripeColor}`} />
      <span className={`text-base pl-0.5 ${iconColor}`}>{icon}</span>
      <span className="text-[13px] font-medium text-white/90 py-3.5 flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onClose}
        className="text-white/30 hover:text-white/70 pr-3.5 transition-colors text-sm"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
