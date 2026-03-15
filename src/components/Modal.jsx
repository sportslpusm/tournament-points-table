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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={modalRef}
        className={`animate-scaleIn w-full ${sizeClass} max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${
          darkMode
            ? 'bg-navy-800/90 backdrop-blur-2xl border-white/10'
            : 'bg-white/95 backdrop-blur-2xl border-gray-200'
        }`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          darkMode ? 'border-white/10' : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:rotate-90 ${
              darkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">
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
      <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className={`px-4 py-2 rounded-lg transition-colors ${
            darkMode ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}
