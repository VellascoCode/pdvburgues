type UiSound = 'hover' | 'click';

let audioCtx: AudioContext | null = null;
const lastPlay: Record<UiSound, number> = { hover: 0, click: 0 };

export function playUiSound(type: UiSound) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const throttle = type === 'hover' ? 80 : 120; // ms
  if (now - lastPlay[type] < throttle) return;
  lastPlay[type] = now;
  type WinAudio = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const AC = (window as WinAudio).AudioContext || (window as WinAudio).webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) {
    // Cria contexto apenas em gesto claro (click). Em hover, silencie até existir.
    if (type !== 'click') return;
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
  } else {
    osc.type = 'triangle';
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.006, ctx.currentTime + 0.10);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  }
}
