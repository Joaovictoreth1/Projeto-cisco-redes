import type { CableType, DeviceType } from '../core/types';
import { h, icon } from './dom';

const DEVICE_ICONS: Record<DeviceType, string> = {
  router: 'ph-fill ph-cpu text-rose-500',
  switch: 'ph-fill ph-share-network text-emerald-500',
  pc: 'ph-fill ph-desktop text-sky-400',
  laptop: 'ph-fill ph-laptop text-sky-400',
  server: 'ph-fill ph-hard-drives text-sky-400',
  cloud: 'ph-fill ph-cloud text-purple-400',
};

const CABLE_ICONS: Record<Exclude<CableType, 'auto'>, string> = {
  straight: 'w-8 h-1 bg-slate-400 rotate-45 rounded-full',
  cross: 'w-8 h-1 border-t-2 border-dashed border-slate-400 rotate-45',
  fiber: 'w-8 h-1 bg-amber-500 rotate-45 rounded-full shadow-[0_0_8px_#f59e0b]',
};

export function catalogIcon(type: DeviceType | CableType): HTMLElement {
  if (type === 'auto') return icon('ph-fill ph-lightning text-amber-500');
  if (type in CABLE_ICONS) return h('div', { className: CABLE_ICONS[type as Exclude<CableType, 'auto'>] });
  return icon(DEVICE_ICONS[type as DeviceType]);
}
