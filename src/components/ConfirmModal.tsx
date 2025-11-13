import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({ open, title='Confirmar', message, confirmText='Confirmar', cancelText='Cancelar', onConfirm, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div className="relative w-full max-w-sm rounded-xl border theme-border theme-surface p-4" initial={{ y: 16, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 16, scale: 0.97, opacity: 0 }}>
            <div className="text-sm font-semibold theme-text mb-1">{title}</div>
            {message && <div className="text-xs text-zinc-500 mb-3">{message}</div>}
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-1.5 rounded border theme-border text-zinc-300" onClick={onClose}>{cancelText}</button>
              <button className="px-3 py-1.5 rounded bg-red-600 text-white" onClick={onConfirm}>{confirmText}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

