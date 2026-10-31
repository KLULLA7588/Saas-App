let audioCtx: AudioContext | null = null;
let oscillators: OscillatorNode[] = [];
let gainNode: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;
let running = false;

function ensureContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function unlockAudio(): void {
  ensureContext();
}

export function startSiren(): void {
  if (running) return;
  const ctx = ensureContext();
  running = true;

  gainNode = ctx.createGain();
  gainNode.gain.value = 0.25;
  gainNode.connect(ctx.destination);

  lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 4;
  lfoGain = ctx.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain);

  oscillators = [680, 920].map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    lfoGain!.connect(osc.frequency);
    osc.connect(gainNode!);
    osc.start();
    return osc;
  });

  lfo.start();
}

export function stopSiren(): void {
  running = false;
  oscillators.forEach((o) => {
    try {
      o.stop();
      o.disconnect();
    } catch {
      // already stopped
    }
  });
  oscillators = [];
  if (lfo) {
    try {
      lfo.stop();
      lfo.disconnect();
    } catch {
      // already stopped
    }
    lfo = null;
  }
  if (lfoGain) {
    lfoGain.disconnect();
    lfoGain = null;
  }
  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }
}

export function vibrate(pattern: number | number[] = [400, 200, 400, 200, 400]): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // vibration not supported
  }
}

export function stopVibrate(): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(0);
  } catch {
    // ignore
  }
}
