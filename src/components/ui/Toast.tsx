import { AnimatePresence, motion } from "framer-motion";

export type ToastMessage = {
  id: number;
  message: string;
};

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-auto flex items-start justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-slate-950/95 px-4 py-3 text-sm font-bold text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-xl"
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded-lg px-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar notificacao"
            >
              x
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
