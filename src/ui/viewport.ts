import { byId } from './dom';
import { state } from './state';
import { toast } from './toast';

export const GRID = 40;
const MIN_SCALE = 0.45;
const MAX_SCALE = 2;

export function applyViewport(): void {
  const { x, y, scale } = state.viewport;
  byId('canvas-stage').style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  const ws = byId('workspace');
  ws.style.backgroundPosition = `center, ${x}px ${y}px, ${x}px ${y}px`;
  const size = `${GRID * scale}px ${GRID * scale}px`;
  ws.style.backgroundSize = `100% 100%, ${size}, ${size}`;
  byId('zoom-level').textContent = `${Math.round(scale * 100)}%`;
}

export function zoom(delta: number, clientX?: number, clientY?: number): void {
  const rect = byId('workspace').getBoundingClientRect();
  const cx = clientX === undefined ? rect.width / 2 : clientX - rect.left;
  const cy = clientY === undefined ? rect.height / 2 : clientY - rect.top;
  const old = state.viewport.scale;
  const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, old + delta));
  if (old === next) return;
  state.viewport.x = cx - (cx - state.viewport.x) * (next / old);
  state.viewport.y = cy - (cy - state.viewport.y) * (next / old);
  state.viewport.scale = next;
  applyViewport();
}

export function resetViewport(): void {
  Object.assign(state.viewport, { x: 0, y: 0, scale: 1 });
  applyViewport();
}

export function toggleSnap(): void {
  state.viewport.snap = !state.viewport.snap;
  const btn = byId('btn-snap');
  btn.setAttribute('aria-pressed', String(state.viewport.snap));
  const i = btn.querySelector('i');
  if (i)
    i.className = state.viewport.snap
      ? 'ph-fill ph-grid-four text-base text-sky-400'
      : 'ph ph-grid-four text-base text-slate-400';
  toast(state.viewport.snap ? 'Alinhamento à grade ativado' : 'Alinhamento livre', 'info', 1500);
}

export function screenToCanvas(clientX: number, clientY: number): { x: number; y: number } {
  const rect = byId('workspace').getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.viewport.x) / state.viewport.scale,
    y: (clientY - rect.top - state.viewport.y) / state.viewport.scale,
  };
}

export const snap = (v: number): number => (state.viewport.snap ? Math.round(v / GRID) * GRID : v);
