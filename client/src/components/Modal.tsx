import { motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

export function Modal({ onClose, children, label, wide }: { onClose: () => void; children: ReactNode; label: string; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={wide ? { width: 'min(980px, 100%)' } : undefined}
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
