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
    osc.frequency.value = 900; // sutil mais agudo
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.08);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } else if (type === 'click' || type === 'toggle') {
    osc.type = 'triangle';
    osc.frequency.value = type === 'toggle' ? 340 : 240;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.012, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } else if (type === 'open') {
    osc.type = 'sine';
    osc.frequency.value = 560;
    gain.gain.setValueAtTime(0.10, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.012, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } else if (type === 'close') {
    osc.type = 'sine';
    osc.frequency.value = 360;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } else if (type === 'success') {
    osc.type = 'square';
    osc.frequency.value = 700;
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.016, ctx.currentTime + 0.22);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.value = 180;
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.016, ctx.currentTime + 0.24);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  }
}
