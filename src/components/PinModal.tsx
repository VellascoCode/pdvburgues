import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaLock } from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';

function PinModalContent({ title, message, onClose, onConfirm }: { title: string; message?: string; onClose: () => void; onConfirm: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = React.useState(['', '', '', '']);
  const [error, setError] = React.useState('');
  const [locked, setLocked] = React.useState(false);
  const inputs = React.useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  React.useEffect(() => {
    playUiSound('open');
    const t = setTimeout(() => inputs.current[0]?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const disabled = locked;

  const onChange = (idx: number, v: string) => {
    if (disabled) return;
    const digit = v.replace(/\D/g, '').slice(0, 1);
    const next = [...pin];
    next[idx] = digit;
    setPin(next);
    if (digit && idx < 3) inputs.current[idx + 1]?.focus();
  };

  const tryConfirm = async () => {
    if (disabled) return;
    const p = pin.join('');
    if (!/^\d{4}$/.test(p)) {
      setError('PIN inválido');
      return;
    }
    playUiSound('click');
    try {
      const ok = await onConfirm(p);
      if (ok) { playUiSound('success'); onClose(); }
      else {
        playUiSound('error');
        setError('PIN incorreto. Aguarde 5s.');
        setLocked(true);
        const t1 = setTimeout(() => setError(''), 5000);
        const t2 = setTimeout(() => setLocked(false), 5000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    } catch {
      setError('Falha ao confirmar. Tente novamente.');
    }
  };

  return (
        <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black" onClick={() => { playUiSound('close'); onClose(); }} />
      <motion.div className="relative w-full max-w-sm rounded-2xl border theme-border theme-surface bg-zinc-900 p-6 shadow-2xl" initial={{ y: 24, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.95 }}>
        <div className="flex items-center gap-2 mb-3">
          <FaLock className="text-zinc-400" />
          <h3 className="text-sm font-semibold theme-text">{title}</h3>
        </div>
        {message && <div className="text-xs text-zinc-500 mb-3">{message}</div>}
        <div className="flex items-center justify-center gap-3 mb-4">
          {pin.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              aria-label={`Dígito ${i + 1}`}
              className="w-12 h-12 text-2xl text-center rounded-lg border theme-border bg-zinc-800/60 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              value={d}
              onChange={(e) => onChange(i, e.target.value)}
              disabled={disabled}
            />
          ))}
        </div>
        {error && <div className="text-center text-rose-400 text-sm mb-3">{error}</div>}
        <div className="flex items-center justify-end gap-2">
          <button className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> { playUiSound('close'); onClose(); }}>
            Cancelar
          </button>
          <button className="px-4 py-2 rounded-lg brand-btn text-white disabled:opacity-50" onClick={tryConfirm} disabled={disabled}>
            Confirmar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PinModal({ open, title = 'Confirmação Admin', message, onClose, onConfirm }: { open: boolean; title?: string; message?: string; onClose: () => void; onConfirm: (pin: string) => Promise<boolean> }) {
  return (
    <AnimatePresence>
      {open && <PinModalContent title={title} message={message} onClose={onClose} onConfirm={onConfirm} />}
    </AnimatePresence>
  );
}
