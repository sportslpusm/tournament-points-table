import { useEffect, useRef, useCallback } from 'react';
import { useTournament } from '../context/TournamentContext';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const { darkMode } = useTournament();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Focus trap: keep Tab cycling within modal
  const handleKeyDown = useCallback((e) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }, []);

  // Auto-focus first focusable element when modal opens
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        // Small delay to let animation start
        requestAnimationFrame(() => focusableElements[0]?.focus());
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-lg animate-fadeIn"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={modalRef}
        className={`animate-scaleIn w-full sm:mx-4 ${sizeClass} flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl border ${
          darkMode
            ? 'bg-navy-850/95 backdrop-blur-2xl border-white/[0.08] shadow-black/40'
            : 'bg-white/98 backdrop-blur-2xl border-gray-200/80 shadow-gray-300/30'
        }`}
        style={{ maxHeight: '85vh', maxHeight: '85dvh' }}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className={`w-10 h-1 rounded-full ${darkMode ? 'bg-white/15' : 'bg-gray-300'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
          darkMode ? 'border-white/[0.08]' : 'border-gray-200/80'
        }`}>
          <h2 className={`text-lg font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:rotate-90 ${
              darkMode
                ? 'text-gray-500 hover:text-white hover:bg-white/[0.08]'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  const { darkMode } = useTournament();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className={`mb-6 leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            darkMode
              ? 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.10] border border-white/[0.06]'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}
