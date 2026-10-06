let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, delay = 0, type: OscillatorType = "sine", volume = 0.15) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(c.destination);
  const start = c.currentTime + delay;
  osc.start(start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.stop(start + duration + 0.02);
}

/** Tiếng "bíp" khi quét thành công */
export function beepSuccess() {
  tone(1200, 0.09, 0, "square", 0.08);
}

/** Tiếng báo lỗi (2 nốt trầm) */
export function beepError() {
  tone(300, 0.15, 0, "sawtooth", 0.1);
  tone(220, 0.2, 0.17, "sawtooth", 0.1);
}

/** Tiếng cảnh báo (quét trùng...) */
export function beepWarning() {
  tone(700, 0.08, 0, "triangle", 0.12);
  tone(700, 0.08, 0.12, "triangle", 0.12);
}
