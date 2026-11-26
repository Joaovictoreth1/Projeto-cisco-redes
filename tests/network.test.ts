import { describe, expect, it } from 'vitest';
import {
  activeLinksFor,
  allocateFromPool,
  findLayer2Path,
  learnMac,
  lookupRoute,
  neighborsOf,
  requestDhcp,
  traceRoute,
} from '../src/core/network';
import { emptyTopology } from '../src/core/topology';
import { connect, device, twoRouterLab } from './helpers';

describe('layer 2', () => {
  it('lists only links whose both ends are administratively up', () => {
    const { t, r1, r2 } = twoRouterLab();
    expect(activeLinksFor(t, r1.id)).toHaveLength(2);
    const intf = r2.interfaces[1];
    if (intf) intf.adminUp = false;
    expect(activeLinksFor(t, r1.id)).toHaveLength(1);
    expect(neighborsOf(t, r1.id).map((n) => n.dev.name)).toEqual(['SW1']);
  });

  it('ignores links that point at missing devices', () => {
    const { t, pc1 } = twoRouterLab();
    t.links.push({ id: 'ghost', sourceId: pc1.id, srcIntf: 0, targetId: 'nope', tgtIntf: 0, type: 'auto' });
    expect(activeLinksFor(t, pc1.id).some((l) => l.id === 'ghost')).toBe(false);
    t.devices = t.devices.filter((d) => d.name !== 'SW1');
    expect(neighborsOf(t, pc1.id)).toEqual([]);
  });

  it('finds a path through switches and learns the source MAC on the ingress port', () => {
    const { t, pc1, r1, sw } = twoRouterLab();
    expect(findLayer2Path(t, pc1, r1)?.map((d) => d.name)).toEqual(['PC1', 'SW1', 'R1']);
    expect(sw.macTable).toEqual([{ mac: pc1.interfaces[0]?.mac, port: 'FastEthernet0/1' }]);
  });

  it('does not forward frames through routers', () => {
    const { t, pc1, pc2 } = twoRouterLab();
    expect(findLayer2Path(t, pc1, pc2)).toBeNull();
  });

  it('updates an existing MAC entry when the station moves and ignores non-switches', () => {
    const t = emptyTopology();
    const sw = device(t, 'switch', 'SW');
    const pc = device(t, 'pc', 'PC');
    learnMac(sw, 'AA:AA:AA:AA:AA:AA', 'Fa0/1');
    learnMac(sw, 'AA:AA:AA:AA:AA:AA', 'Fa0/2');
    learnMac(sw, '', 'Fa0/3');
    learnMac(pc, 'AA:AA:AA:AA:AA:AA', 'eth0');
    expect(sw.macTable).toEqual([{ mac: 'AA:AA:AA:AA:AA:AA', port: 'Fa0/2' }]);
    expect(pc.macTable).toEqual([]);
  });
});

describe('routing', () => {
  it('routes across two routers via static routes and fills ARP caches', () => {
    const { t, pc1, pc2, r1 } = twoRouterLab();
    const result = traceRoute(t, pc1, '10.2.0.10');
    expect(result.success).toBe(true);
    expect(result.hops.map((d) => d.name)).toEqual(['R1', 'R2', 'PC2']);
    expect(result.path.map((d) => d.name)).toEqual(['PC1', 'SW1', 'R1', 'R2', 'PC2']);
    expect(pc1.arpTable['10.1.0.1']).toBe(r1.interfaces[0]?.mac);
    expect(traceRoute(t, pc2, '10.1.0.10').success).toBe(true);
  });

  it('prefers the longest matching prefix over an earlier, broader route', () => {
    const { t, pc1, r1 } = twoRouterLab();
    const blackhole = device(t, 'router', 'R-Blackhole');
    Object.assign(blackhole.interfaces[1] ?? {}, { ip: '10.0.99.2', mask: '255.255.255.0' });
    Object.assign(r1.interfaces[2] ?? {}, { ip: '10.0.99.1', mask: '255.255.255.0' });
    connect(t, r1, blackhole, 2, 1);
    r1.staticRoutes.unshift({ dest: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.99.2' });
    expect(lookupRoute(r1, '10.2.0.10')).toEqual({ connected: false, nextHop: '10.0.12.2' });
    expect(lookupRoute(r1, '192.0.2.1')).toEqual({ connected: false, nextHop: '10.0.99.2' });
    expect(traceRoute(t, pc1, '10.2.0.10').hops.map((d) => d.name)).toEqual(['R1', 'R2', 'PC2']);
  });

  it('prefers a connected network over a static route of equal length', () => {
    const { r1 } = twoRouterLab();
    r1.staticRoutes.push({ dest: '10.1.0.0', mask: '255.255.255.0', nextHop: '10.0.12.2' });
    expect(lookupRoute(r1, '10.1.0.10')).toEqual({ connected: true });
  });

  it('reports invalid, unknown and self targets', () => {
    const { t, pc1 } = twoRouterLab();
    expect(traceRoute(t, pc1, '999.1.1.1').error).toMatch(/Invalid IP/);
    expect(traceRoute(t, pc1, '10.9.9.9').error).toBe('Destination host unreachable.');
    expect(traceRoute(t, pc1, '10.1.0.10')).toMatchObject({ success: true, hops: [pc1] });
  });

  it('fails without a default gateway or a route', () => {
    const { t, pc1, r1 } = twoRouterLab();
    pc1.gateway = '';
    expect(traceRoute(t, pc1, '10.2.0.10').error).toMatch(/No Default Gateway/);
    pc1.gateway = '10.1.0.1';
    r1.staticRoutes = [];
    expect(traceRoute(t, pc1, '10.2.0.10').error).toBe('Reply from 10.1.0.1: Destination net unreachable.');
  });

  it('times out when the destination is on-link but unreachable at layer 2', () => {
    const { t, pc1 } = twoRouterLab();
    device(t, 'pc', 'Island', '10.1.0.50');
    expect(traceRoute(t, pc1, '10.1.0.50').error).toBe('Request timed out.');
  });

  it('detects routing loops and unreachable next hops', () => {
    const { t, pc1, r1, r2 } = twoRouterLab();
    r2.staticRoutes = [{ dest: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.12.1' }];
    r1.staticRoutes = [{ dest: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.12.2' }];
    device(t, 'pc', 'Far', '172.31.0.1');
    expect(traceRoute(t, pc1, '172.31.0.1').error).toMatch(/Routing loop/);
    r1.staticRoutes = [{ dest: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.12.9' }];
    expect(traceRoute(t, pc1, '172.31.0.1').error).toMatch(/Routing loop/);
  });

  it('reports a next hop that exists but is not adjacent', () => {
    const { t, pc1, r1 } = twoRouterLab();
    const far = device(t, 'router', 'R-Far', '10.0.77.1');
    r1.staticRoutes = [{ dest: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.77.1' }];
    device(t, 'pc', 'Target', '172.31.0.1');
    expect(far.interfaces[0]?.ip).toBe('10.0.77.1');
    expect(traceRoute(t, pc1, '172.31.0.1').error).toBe('Reply from 10.1.0.1: Destination host unreachable.');
  });

  it('stops after the maximum number of hops', () => {
    const t = emptyTopology();
    const src = device(t, 'pc', 'Src', '10.0.0.10');
    src.gateway = '10.0.0.1';
    let prev = device(t, 'router', 'R0', '10.0.0.1');
    connect(t, src, prev, 0, 0);
    for (let i = 1; i <= 13; i++) {
      const next = device(t, 'router', `R${i}`, `10.${i}.0.2`);
      Object.assign(prev.interfaces[1] ?? {}, { ip: `10.${i}.0.1`, mask: '255.255.255.0' });
      prev.staticRoutes.push({ dest: '0.0.0.0', mask: '0.0.0.0', nextHop: `10.${i}.0.2` });
      connect(t, prev, next, 1, 0);
      prev = next;
    }
    device(t, 'pc', 'Dst', '192.0.2.10');
    expect(traceRoute(t, src, '192.0.2.10').error).toBe('Time to live exceeded.');
  });
});

describe('dhcp', () => {
  const lab = () => {
    const t = emptyTopology();
    const r = device(t, 'router', 'R', '10.10.0.1');
    r.dhcpServer = { enabled: true, startIp: '10.10.0.252', mask: '255.255.255.0', gateway: '10.10.0.1', leases: {} };
    const sw = device(t, 'switch', 'SW');
    connect(t, r, sw, 0, 0);
    const clients = [1, 2, 3, 4].map((n) => {
      const pc = device(t, 'pc', `PC${n}`);
      connect(t, sw, pc, n, 0);
      return pc;
    });
    return { t, r, clients };
  };

  it('leases addresses and keeps the lease stable for the same MAC', () => {
    const { t, clients } = lab();
    const [a] = clients;
    if (!a) throw new Error('fixture');
    const first = requestDhcp(t, a);
    expect(first).toMatchObject({ ok: true, ip: '10.10.0.252', gateway: '10.10.0.1' });
    expect(a.interfaces[0]?.ip).toBe('10.10.0.252');
    expect(a.gateway).toBe('10.10.0.1');
    expect(requestDhcp(t, a)).toMatchObject({ ok: true, ip: '10.10.0.252' });
  });

  it('never hands out the broadcast address or anything outside the pool subnet', () => {
    const { t, clients } = lab();
    const results = clients.map((c) => requestDhcp(t, c));
    expect(results.map((r) => (r.ok ? r.ip : r.reason))).toEqual([
      '10.10.0.252',
      '10.10.0.253',
      '10.10.0.254',
      'pool-exhausted',
    ]);
  });

  it('skips addresses already configured statically and the gateway', () => {
    const t = emptyTopology();
    const r = device(t, 'router', 'R', '10.0.0.1');
    r.dhcpServer = { enabled: true, startIp: '10.0.0.0', mask: '255.255.255.0', gateway: '10.0.0.2', leases: {} };
    device(t, 'pc', 'Static', '10.0.0.3');
    expect(allocateFromPool(r, 'AA:AA:AA:AA:AA:01', new Set(['10.0.0.1', '10.0.0.3']))).toBe('10.0.0.4');
  });

  it('re-leases when a stored lease is outside the current pool', () => {
    const t = emptyTopology();
    const r = device(t, 'router', 'R', '10.0.0.1');
    r.dhcpServer = {
      enabled: true,
      startIp: '10.0.0.10',
      mask: '255.255.255.0',
      gateway: '',
      leases: { 'AA:AA:AA:AA:AA:01': '192.168.0.5' },
    };
    expect(allocateFromPool(r, 'AA:AA:AA:AA:AA:01', new Set())).toBe('10.0.0.10');
  });

  it('rejects non-host clients and reports when no server is reachable', () => {
    const { t, r, clients } = lab();
    expect(requestDhcp(t, r)).toEqual({ ok: false, reason: 'not-host' });
    r.dhcpServer.enabled = false;
    const [a] = clients;
    if (!a) throw new Error('fixture');
    expect(requestDhcp(t, a)).toEqual({ ok: false, reason: 'no-server' });
  });

  it('rejects a host without interfaces', () => {
    const t = emptyTopology();
    const pc = device(t, 'pc', 'PC');
    pc.interfaces = [];
    expect(requestDhcp(t, pc)).toEqual({ ok: false, reason: 'not-host' });
  });
});
