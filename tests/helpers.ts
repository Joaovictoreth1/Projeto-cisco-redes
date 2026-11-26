import { createDevice } from '../src/core/devices';
import { addLink, emptyTopology } from '../src/core/topology';
import type { Device, DeviceType, Topology } from '../src/core/types';

export function device(t: Topology, type: DeviceType, name: string, ip?: string, mask = '255.255.255.0'): Device {
  const dev = createDevice(t, type, name, 0, 0, name);
  const intf = dev.interfaces[0];
  if (ip && intf) {
    intf.ip = ip;
    intf.mask = mask;
  }
  t.devices.push(dev);
  return dev;
}

export function connect(t: Topology, a: Device, b: Device, pa?: number, pb?: number): void {
  const result = addLink(t, a, b, 'straight', pa ?? null, pb ?? null);
  if (typeof result === 'string') throw new Error(result);
}

/** PC1 - SW1 - R1 - R2 - PC2 with static routes; R1 g0/0 LAN A, g0/1 transit. */
export function twoRouterLab(): { t: Topology; pc1: Device; pc2: Device; r1: Device; r2: Device; sw: Device } {
  const t = emptyTopology();
  const pc1 = device(t, 'pc', 'PC1', '10.1.0.10');
  pc1.gateway = '10.1.0.1';
  const pc2 = device(t, 'pc', 'PC2', '10.2.0.10');
  pc2.gateway = '10.2.0.1';
  const sw = device(t, 'switch', 'SW1');
  const r1 = device(t, 'router', 'R1', '10.1.0.1');
  const r2 = device(t, 'router', 'R2', '10.2.0.1');
  Object.assign(r1.interfaces[1] ?? {}, { ip: '10.0.12.1', mask: '255.255.255.252' });
  Object.assign(r2.interfaces[1] ?? {}, { ip: '10.0.12.2', mask: '255.255.255.252' });
  r1.staticRoutes.push({ dest: '10.2.0.0', mask: '255.255.255.0', nextHop: '10.0.12.2' });
  r2.staticRoutes.push({ dest: '10.1.0.0', mask: '255.255.255.0', nextHop: '10.0.12.1' });
  connect(t, pc1, sw, 0, 0);
  connect(t, sw, r1, 1, 0);
  connect(t, r1, r2, 1, 1);
  connect(t, r2, pc2, 0, 0);
  return { t, pc1, pc2, r1, r2, sw };
}
