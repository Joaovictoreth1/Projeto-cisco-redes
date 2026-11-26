import { byId } from './dom';
import { toast } from './toast';

export type Sound = 'click' | 'connect' | 'ping_ok' | 'ping_err';

interface Tone {
  wave: OscillatorType;
  freq: [number, number];
  ramp: 'step' | 'exp' | 'linear';
  gain: number;
  duration: number;
}

const TONES: Record<Sound, Tone> = {
  click: { wave: 'sine', freq: [520, 220], ramp: 'exp', gain: 0.06, duration: 0.05 },
  connect: { wave: 'triangle', freq: [340, 580], ramp: 'step', gain: 0.08, duration: 0.16 },
  ping_ok: { wave: 'sine', freq: [660, 880], ramp: 'step', gain: 0.07, duration: 0.22 },
  ping_err: { wave: 'sawtooth', freq: [180, 120], ramp: 'linear', gain: 0.06, duration: 0.2 },
};

let enabled = true;
let ctx: AudioContext | null = null;

export function toggleSound(): void {
  enabled = !enabled;
  const btn = byId('btn-sound');
  btn.setAttribute('aria-pressed', String(enabled));
  const i = btn.querySelector('i');
  if (i)
    i.className = enabled
      ? 'ph ph-speaker-high text-base text-sky-400'
      : 'ph ph-speaker-slash text-base text-slate-500';
  toast(enabled ? 'Áudio ativado' : 'Áudio silenciado', 'info', 1800);
}

export function playSound(type: Sound): void {
  if (!enabled || typeof AudioContext === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const tone = TONES[type];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const end = now + tone.duration;
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.freq[0], now);
    if (tone.ramp === 'exp') osc.frequency.exponentialRampToValueAtTime(tone.freq[1], end);
    else if (tone.ramp === 'linear') osc.frequency.linearRampToValueAtTime(tone.freq[1], end);
    else osc.frequency.setValueAtTime(tone.freq[1], now + Math.min(0.08, tone.duration / 2));
    gain.gain.setValueAtTime(tone.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.start(now);
    osc.stop(end);
  } catch {
    // Audio is decorative; browsers may refuse it before a user gesture.
  }
}
