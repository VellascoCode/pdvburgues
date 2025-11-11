type UiSound = 'hover' | 'click' | 'open' | 'close' | 'success' | 'error' | 'toggle';

let audioCtx: AudioContext | null = null;
let soundsEnabled: boolean | null = null;
const lastPlay: Record<UiSound, number> = { hover: 0, click: 0, open: 0, close: 0, success: 0, error: 0, toggle: 0 };

export function setUiSoundEnabled(v: boolean) {
  soundsEnabled = !!v;
  try { if (typeof window !== 'undefined') localStorage.setItem('cfg:sounds', v ? '1' : '0'); } catch {}
}

export function isUiSoundEnabled(): boolean {
  if (soundsEnabled === null) {
    try {
      const st = (typeof window !== 'undefined') ? localStorage.getItem('cfg:sounds') : null;
      soundsEnabled = st == null ? true : st !== '0';
    } catch {
      soundsEnabled = true;
    }
  }
  return !!soundsEnabled;
}

export function playUiSound(type: UiSound) {
  if (typeof window === 'undefined') return;
  if (!isUiSoundEnabled()) return;
  const now = Date.now();
  const throttle = type === 'hover' ? 80 : 120; // ms
  if (now - lastPlay[type] < throttle) return;
  lastPlay[type] = now;
  type WinAudio = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const AC = (window as WinAudio).AudioContext || (window as WinAudio).webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) {
    // Cria contexto apenas em gesto claro (click/open/toggle). Em hover, silencie até existir.
    if (!['click','open','toggle'].includes(type)) return;
    try {
      audioCtx = new AC();
      audioCtx.resume?.().catch(()=>{});
    } catch {
      return;
    }
  }
  const ctx = audioCtx!;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'hover') {
    osc.type = 'sine';
    osc.frequency.value = 800; // sutil
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.004, ctx.currentTime + 0.06);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  } else if (type === 'click' || type === 'toggle') {
    osc.type = 'triangle';
    osc.frequency.value = type === 'toggle' ? 300 : 220;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.006, ctx.currentTime + 0.10);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  } else if (type === 'open') {
    osc.type = 'sine';
    osc.frequency.value = 520;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } else if (type === 'close') {
    osc.type = 'sine';
    osc.frequency.value = 340;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.004, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } else if (type === 'success') {
    osc.type = 'square';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.value = 160;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  }
}
