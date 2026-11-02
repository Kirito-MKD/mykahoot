import { AnimatePresence, motion } from 'framer-motion';
import { create } from 'zustand';

interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'ok';
}

interface ToastState {
  items: ToastItem[];
  push: (text: string, kind?: ToastItem['kind']) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (text, kind = 'info') => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-2), { id, text, kind }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3200);
  },
}));

export const toast = (text: string, kind: ToastItem['kind'] = 'info') => useToasts.getState().push(text, kind);

export function ToastLayer() {
  const items = useToasts((s) => s.items);
  return (
    <div className="toast-layer" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className={`toast is-${t.kind}`}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
