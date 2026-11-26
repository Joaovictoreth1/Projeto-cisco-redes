import { uniqueId } from '../core/devices';
import { LIMITS } from '../core/topology';
import type { Zone } from '../core/types';
import { state } from './state';
import { snap } from './viewport';

export function addZone(x: number, y: number): Zone | null {
  if (state.topology.zones.length >= LIMITS.zones) return null;
  const zone: Zone = {
    id: uniqueId('zone'),
    x: Math.max(20, snap(x - 140)),
    y: Math.max(20, snap(y - 100)),
    w: 280,
    h: 200,
    title: 'Sub-rede 192.168.X.0/24 (Duplo clique p/ editar)',
  };
  state.topology.zones.push(zone);
  return zone;
}

export function removeZone(id: string): void {
  state.topology.zones = state.topology.zones.filter((z) => z.id !== id);
}
