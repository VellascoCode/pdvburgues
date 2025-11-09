type UiSound = 'hover' | 'click';

let audioCtx: AudioContext | null = null;

export function playUiSound(type: UiSound) {
  if (typeof window === 'undefined') return;
  type WinAudio = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const AC = (window as WinAudio).AudioContext || (window as WinAudio).webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) {
    try {
      audioCtx = new AC();
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
    osc.frequency.value = 900; // sutil
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.08);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } else {
    osc.type = 'triangle';
    osc.frequency.value = 240;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  }
}
