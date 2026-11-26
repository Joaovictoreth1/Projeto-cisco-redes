import { byId } from './dom';
import { toast } from './toast';

const SPEEDS = [
  { factor: 1, label: '1.0x' },
  { factor: 2, label: '2.0x' },
  { factor: 0.4, label: '0.4x (Lento)' },
] as const;

let idx = 0;

export function toggleSpeed(): void {
  idx = (idx + 1) % SPEEDS.length;
  const speed = SPEEDS[idx] ?? SPEEDS[0];
  byId('sim-speed-label').textContent = speed.label;
  toast(`Velocidade da simulação: ${speed.label}`, 'info', 1500);
}

export const scaled = (ms: number): number => ms / (SPEEDS[idx] ?? SPEEDS[0]).factor;

/** Waits `ms` scaled by the simulation speed and resolves with the scaled value of `value`. */
export function simDelay(ms: number, value = ms): Promise<number> {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve(scaled(value));
    }, scaled(ms)),
  );
}
