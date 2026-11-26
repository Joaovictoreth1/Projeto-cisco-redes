import type { CableType, DeviceType } from '../core/types';

export type CategoryKey = 'routers' | 'switches' | 'end_devices' | 'connections';
export type Accent = 'rose' | 'emerald' | 'sky' | 'purple' | 'amber';

export interface CatalogItem {
  id: string;
  name: string;
  label: string;
  type: DeviceType | CableType;
  color: Accent;
}

export interface DeviceCatalogItem extends CatalogItem {
  type: DeviceType;
}

export const CATEGORIES: Record<CategoryKey, readonly CatalogItem[]> = {
  routers: [
    { id: 'vios', name: 'R', label: 'vIOS Router', type: 'router', color: 'rose' },
    { id: 'csr', name: 'CSR', label: 'CSR1000v', type: 'router', color: 'rose' },
  ],
  switches: [
    { id: 'l2', name: 'SW', label: 'L2 Switch', type: 'switch', color: 'emerald' },
    { id: 'l3', name: 'MLS', label: 'L3 Switch', type: 'switch', color: 'emerald' },
  ],
  end_devices: [
    { id: 'pc', name: 'PC', label: 'Desktop PC', type: 'pc', color: 'sky' },
    { id: 'laptop', name: 'Laptop', label: 'Laptop', type: 'laptop', color: 'sky' },
    { id: 'server', name: 'Server', label: 'Data Server', type: 'server', color: 'sky' },
    { id: 'cloud', name: 'Cloud', label: 'WAN / Internet', type: 'cloud', color: 'purple' },
  ],
  connections: [
    { id: 'auto', name: 'Auto', label: 'Automático', type: 'auto', color: 'amber' },
    { id: 'straight', name: 'Straight', label: 'Cobre Direto', type: 'straight', color: 'amber' },
    { id: 'cross', name: 'Cross', label: 'Cross-Over', type: 'cross', color: 'amber' },
    { id: 'fiber', name: 'Fiber', label: 'Fibra Óptica', type: 'fiber', color: 'amber' },
  ],
};

export const CATEGORY_ACCENT: Record<CategoryKey, Accent> = {
  routers: 'rose',
  switches: 'emerald',
  end_devices: 'sky',
  connections: 'amber',
};

/** Full class names so Tailwind's build-time scanner keeps them. */
export const ACCENT_CLASSES: Record<Accent, { ring: string; bg: string; text: string }> = {
  rose: { ring: 'ring-rose-500', bg: 'bg-rose-500', text: 'text-rose-500' },
  emerald: { ring: 'ring-emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-500' },
  sky: { ring: 'ring-sky-500', bg: 'bg-sky-500', text: 'text-sky-500' },
  purple: { ring: 'ring-purple-500', bg: 'bg-purple-500', text: 'text-purple-500' },
  amber: { ring: 'ring-amber-500', bg: 'bg-amber-500', text: 'text-amber-500' },
};
