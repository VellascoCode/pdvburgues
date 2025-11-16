import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaLock } from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';

export type PinModalConfirmResult = boolean | { ok: boolean; message?: string; suppressAttempts?: boolean; closeOnError?: boolean };

function PinModalContent({ title, message, onClose, onConfirm }: { title: string; message?: string; onClose: () => void; onConfirm: (pin: string) => Promise<PinModalConfirmResult> }) {
  const [pin, setPin] = React.useState(['', '', '', '']);
  const [error, setError] = React.useState('');
  const [attempts, setAttempts] = React.useState(0);
  const [blockedUntil, setBlockedUntil] = React.useState<number | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const inputs = React.useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  React.useEffect(() => {
    playUiSound('open');
    const t = setTimeout(() => inputs.current[0]?.focus(), 50);
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('pin:blockUntil');
        if (raw) {
          const ts = Number(raw);
          if (Number.isFinite(ts) && ts > Date.now()) {
            setBlockedUntil(ts);
          } else {
            window.localStorage.removeItem('pin:blockUntil');
          }
        }
      } catch {}
    }
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!blockedUntil) return;
    if (typeof window === 'undefined') return;
    const tick = () => {
      const remaining = blockedUntil - Date.now();
      if (remaining <= 0) {
        setBlockedUntil(null);
        setCooldown(0);
        try { window.localStorage.removeItem('pin:blockUntil'); } catch {}
      } else {
        setCooldown(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [blockedUntil]);

  const blocked = Boolean(blockedUntil);
  const disabled = blocked;
  const attemptsLeft = Math.max(0, 5 - attempts);

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
      const result = await onConfirm(p);
      const { ok, message: customMessage, suppressAttempts, closeOnError } = typeof result === 'object' && result !== null
        ? result
        : { ok: Boolean(result) };
      if (ok) {
        playUiSound('success');
        setAttempts(0);
        setPin(['', '', '', '']);
        setError('');
        onClose();
      } else {
        playUiSound('error');
        if (customMessage) setError(customMessage);
        const shouldCountAttempt = !suppressAttempts;
        if (shouldCountAttempt) {
          const nextAttempts = attempts + 1;
          if (nextAttempts >= 5) {
            const until = Date.now() + 60000;
            setBlockedUntil(until);
            try { window.localStorage.setItem('pin:blockUntil', String(until)); } catch {}
            setAttempts(0);
            if (!customMessage) setError('PIN bloqueado por 60 segundos devido a tentativas incorretas.');
          } else {
            setAttempts(nextAttempts);
            if (!customMessage) setError(`PIN incorreto. ${5 - nextAttempts} tentativas restantes.`);
          }
        } else if (!customMessage) {
          setError('Não foi possível confirmar. Verifique os dados e tente novamente.');
        }
        if (closeOnError) onClose();
      }
    } catch {
      setError('Falha ao confirmar. Tente novamente.');
    }
  };

  return (
        <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black" onClick={() => { playUiSound('close'); onClose(); }} />
      <motion.div className="relative w-full max-w-sm rounded-2xl border theme-border theme-surface p-6 shadow-2xl theme-text" initial={{ y: 24, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.95 }}>
        <div className="flex items-center gap-2 mb-3">
          <FaLock className="text-zinc-400" />
          <h3 className="text-sm font-semibold theme-text">{title}</h3>
        </div>
        {message && <div className="text-xs text-zinc-500 mb-3">{message}</div>}
        {blocked ? (
          <div className="rounded-xl border border-rose-600/40 bg-rose-600/10 p-4 text-center mb-4">
            <p className="text-sm font-semibold text-rose-200">PIN bloqueado por segurança.</p>
            <p className="text-xs text-rose-200/80 mt-2">Tente novamente em {Math.ceil(cooldown / 1000)}s.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-4">
              {pin.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Dígito ${i + 1}`}
                  className="w-12 h-12 text-2xl text-center rounded-lg border theme-border bg-transparent theme-text focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={d}
                  onChange={(e) => onChange(i, e.target.value)}
                />
              ))}
            </div>
            <div className="text-center text-[11px] text-zinc-500 mb-2">{attemptsLeft} tentativa(s) restante(s) antes do bloqueio.</div>
          </>
        )}
        {error && <div className="text-center text-rose-400 text-sm mb-3">{error}</div>}
        <div className="flex items-center justify-end gap-2">
          <button className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> { playUiSound('close'); onClose(); }}>
            Cancelar
          </button>
          <button className="px-4 py-2 rounded-lg brand-btn text-white disabled:opacity-50" onClick={tryConfirm} disabled={blocked}>
            Confirmar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PinModal({ open, title = 'Confirmação Admin', message, onClose, onConfirm }: { open: boolean; title?: string; message?: string; onClose: () => void; onConfirm: (pin: string) => Promise<PinModalConfirmResult> }) {
  return (
    <AnimatePresence>
      {open && <PinModalContent title={title} message={message} onClose={onClose} onConfirm={onConfirm} />}
    </AnimatePresence>
  );
}
