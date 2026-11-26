import { createDevice } from './devices';
import { addLink, emptyTopology } from './topology';
import type { Device, Topology } from './types';

export type PresetKey = 'default' | 'dual_lan' | 'mesh_wan' | 'dhcp_lab';
export const PRESET_KEYS: readonly PresetKey[] = ['default', 'dual_lan', 'mesh_wan', 'dhcp_lab'];

const setIp = (dev: Device, idx: number, ip: string, mask = '255.255.255.0'): void => {
  const intf = dev.interfaces[idx];
  if (!intf) throw new Error(`Preset references missing port ${dev.name}#${idx}`);
  intf.ip = ip;
  intf.mask = mask;
};

function link(t: Topology, a: Device, b: Device, type: 'fiber' | 'straight' | 'cross', pa: number, pb: number): void {
  const result = addLink(t, a, b, type, pa, pb);
  if (typeof result === 'string') throw new Error(`Preset link ${a.name}->${b.name} failed: ${result}`);
}

/** Builds one of the bundled lab topologies, laid out for a canvas of the given size. */
export function buildPreset(key: PresetKey, viewportWidth: number, viewportHeight: number): Topology {
  const t = emptyTopology();
  const h = Math.max(viewportHeight - 180, 520);
  const cx = Math.max(viewportWidth, 760) / 2;
  const add = (type: Device['typeStr'], name: string, x: number, y: number): Device => {
    const dev = createDevice(t, type, name, x, y, name);
    t.devices.push(dev);
    return dev;
  };

  if (key === 'default') {
    t.zones.push({ id: 'zone_1', title: 'LAN Corporativa — 192.168.1.0/24', x: cx - 30, y: h * 0.36, w: 410, h: h * 0.52 });
    const cloud = add('cloud', 'WAN-Internet', cx - 220, h * 0.24);
    const r1 = add('router', 'R1-Core', cx, h * 0.24);
    setIp(r1, 0, '8.8.8.1');
    setIp(r1, 1, '192.168.1.1');
    const sw = add('switch', 'SW-Dist', cx + 180, h * 0.48);
    const pc = add('pc', 'Host-01', cx + 60, h * 0.76);
    setIp(pc, 0, '192.168.1.10');
    pc.gateway = '192.168.1.1';
    const srv = add('server', 'Srv-Web', cx + 300, h * 0.76);
    setIp(srv, 0, '192.168.1.100');
    srv.gateway = '192.168.1.1';
    link(t, cloud, r1, 'fiber', 0, 0);
    link(t, r1, sw, 'straight', 1, 0);
    link(t, sw, pc, 'straight', 1, 0);
    link(t, sw, srv, 'straight', 2, 0);
  } else if (key === 'dual_lan') {
    t.zones.push(
      { id: 'zone_a', title: 'VLAN 10 — 192.168.10.0/24', x: cx - 310, y: h * 0.4, w: 240, h: h * 0.5 },
      { id: 'zone_b', title: 'VLAN 20 — 192.168.20.0/24', x: cx + 70, y: h * 0.4, w: 240, h: h * 0.5 },
    );
    const r1 = add('router', 'R-Gateway', cx, h * 0.25);
    setIp(r1, 0, '192.168.10.1');
    setIp(r1, 1, '192.168.20.1');
    const swA = add('switch', 'SW-LAN-A', cx - 190, h * 0.52);
    const swB = add('switch', 'SW-LAN-B', cx + 190, h * 0.52);
    const pcA = add('pc', 'PC-Admin', cx - 190, h * 0.8);
    setIp(pcA, 0, '192.168.10.10');
    pcA.gateway = '192.168.10.1';
    const srvB = add('server', 'DB-Server', cx + 190, h * 0.8);
    setIp(srvB, 0, '192.168.20.50');
    srvB.gateway = '192.168.20.1';
    link(t, r1, swA, 'straight', 0, 0);
    link(t, r1, swB, 'straight', 1, 0);
    link(t, swA, pcA, 'straight', 1, 0);
    link(t, swB, srvB, 'straight', 1, 0);
  } else if (key === 'mesh_wan') {
    const r1 = add('router', 'R-SP', cx - 160, h * 0.28);
    setIp(r1, 0, '10.0.12.1', '255.255.255.252');
    setIp(r1, 1, '172.16.1.1');
    r1.staticRoutes.push({ dest: '172.16.2.0', mask: '255.255.255.0', nextHop: '10.0.12.2' });
    const r2 = add('router', 'R-RJ', cx + 160, h * 0.28);
    setIp(r2, 0, '10.0.12.2', '255.255.255.252');
    setIp(r2, 1, '172.16.2.1');
    r2.staticRoutes.push({ dest: '172.16.1.0', mask: '255.255.255.0', nextHop: '10.0.12.1' });
    const client = add('laptop', 'Client-SP', cx - 160, h * 0.72);
    setIp(client, 0, '172.16.1.10');
    client.gateway = '172.16.1.1';
    const srv = add('server', 'Cloud-RJ', cx + 160, h * 0.72);
    setIp(srv, 0, '172.16.2.20');
    srv.gateway = '172.16.2.1';
    link(t, r1, r2, 'fiber', 0, 0);
    link(t, r1, client, 'cross', 1, 0);
    link(t, r2, srv, 'cross', 1, 0);
  } else {
    const r1 = add('router', 'R-DHCP', cx, h * 0.22);
    setIp(r1, 0, '10.10.0.1');
    r1.dhcpServer = { enabled: true, startIp: '10.10.0.100', mask: '255.255.255.0', gateway: '10.10.0.1', leases: {} };
    const sw = add('switch', 'SW-Access', cx, h * 0.5);
    const pc1 = add('pc', 'Estacao-1', cx - 150, h * 0.78);
    const pc2 = add('laptop', 'Estacao-2', cx + 150, h * 0.78);
    link(t, r1, sw, 'straight', 0, 0);
    link(t, sw, pc1, 'straight', 1, 0);
    link(t, sw, pc2, 'straight', 2, 0);
  }
  return t;
}
