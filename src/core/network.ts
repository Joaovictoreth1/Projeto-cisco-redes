import {
  broadcastAddress,
  ipMatchesNetwork,
  ipToLong,
  isSameSubnet,
  isValidIP,
  longToIp,
  maskToPrefix,
  networkAddress,
} from './ip';
import { isHost, type Device, type Link, type Topology } from './types';

export interface Neighbor {
  dev: Device;
  localPort: string;
  neighborPort: string;
}

export interface RouteResult {
  success: boolean;
  /** Every device the packet crosses, including switches, in order. */
  path: Device[];
  /** Layer-3 hops after the source (routers and the destination). */
  hops: Device[];
  error?: string;
}

export const MAX_HOPS = 12;

const interfaceUp = (dev: Device | undefined, idx: number): boolean => dev?.interfaces[idx]?.adminUp === true;

export function activeLinksFor(topology: Topology, deviceId: string): Link[] {
  return topology.links.filter((l) => {
    if (l.sourceId !== deviceId && l.targetId !== deviceId) return false;
    const s = topology.devices.find((d) => d.id === l.sourceId);
    const t = topology.devices.find((d) => d.id === l.targetId);
    return interfaceUp(s, l.srcIntf) && interfaceUp(t, l.tgtIntf);
  });
}

export function neighborsOf(topology: Topology, deviceId: string): Neighbor[] {
  const result: Neighbor[] = [];
  for (const l of activeLinksFor(topology, deviceId)) {
    const isSrc = l.sourceId === deviceId;
    const dev = topology.devices.find((d) => d.id === (isSrc ? l.targetId : l.sourceId));
    const self = topology.devices.find((d) => d.id === deviceId);
    if (!dev || !self) continue;
    result.push({
      dev,
      localPort: self.interfaces[isSrc ? l.srcIntf : l.tgtIntf]?.name ?? '',
      neighborPort: dev.interfaces[isSrc ? l.tgtIntf : l.srcIntf]?.name ?? '',
    });
  }
  return result;
}

export function learnMac(sw: Device, mac: string, port: string): void {
  if (sw.typeStr !== 'switch' || !mac) return;
  const existing = sw.macTable.find((e) => e.mac === mac);
  if (existing) existing.port = port;
  else sw.macTable.push({ mac, port });
}

/**
 * Breadth-first search across the broadcast domain: only switches forward
 * frames, so the walk never passes through a layer-3 device. Switches on the
 * resulting path learn the source MAC on their ingress port.
 */
export function findLayer2Path(topology: Topology, start: Device, target: Device): Device[] | null {
  const queue: { dev: Device; path: Device[] }[] = [{ dev: start, path: [start] }];
  const visited = new Set([start.id]);
  const ingressPorts = new Map<string, string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { dev, path } = current;
    if (dev.id === target.id) {
      const srcMac = start.interfaces[0]?.mac ?? '';
      for (const hop of path) {
        const port = ingressPorts.get(hop.id);
        if (hop.typeStr === 'switch' && port) learnMac(hop, srcMac, port);
      }
      return path;
    }
    if (dev.typeStr !== 'switch' && dev.id !== start.id) continue;
    for (const n of neighborsOf(topology, dev.id)) {
      if (visited.has(n.dev.id)) continue;
      visited.add(n.dev.id);
      ingressPorts.set(n.dev.id, n.neighborPort);
      queue.push({ dev: n.dev, path: [...path, n.dev] });
    }
  }
  return null;
}

export function findDeviceByActiveIp(topology: Topology, ip: string): Device | undefined {
  return topology.devices.find((d) => d.interfaces.some((i) => i.ip === ip && i.adminUp));
}

interface NextHopDecision {
  connected: boolean;
  nextHop?: string;
}

/** Longest-prefix match across connected networks and static routes; connected wins ties. */
export function lookupRoute(dev: Device, targetIp: string): NextHopDecision | null {
  let best: { prefix: number; decision: NextHopDecision } | null = null;
  const consider = (prefix: number, decision: NextHopDecision): void => {
    if (!best || prefix > best.prefix) best = { prefix, decision };
  };
  for (const i of dev.interfaces) {
    if (i.ip && i.mask && i.adminUp && isSameSubnet(i.ip, i.mask, targetIp, i.mask)) {
      consider(maskToPrefix(i.mask), { connected: true });
    }
  }
  if (dev.typeStr === 'router') {
    for (const r of dev.staticRoutes) {
      if (ipMatchesNetwork(targetIp, r.dest, r.mask))
        consider(maskToPrefix(r.mask), { connected: false, nextHop: r.nextHop });
    }
  } else if (isHost(dev) && isValidIP(dev.gateway)) {
    consider(-1, { connected: false, nextHop: dev.gateway });
  }
  return (best as { prefix: number; decision: NextHopDecision } | null)?.decision ?? null;
}

const firstIp = (dev: Device): string => dev.interfaces.find((i) => i.ip)?.ip ?? dev.name;

export function traceRoute(topology: Topology, src: Device, targetIp: string): RouteResult {
  if (!isValidIP(targetIp))
    return { success: false, error: `Invalid IP address: ${String(targetIp)}`, path: [src], hops: [] };
  const target = findDeviceByActiveIp(topology, targetIp);
  if (!target) return { success: false, error: 'Destination host unreachable.', path: [src], hops: [] };
  if (target.id === src.id) return { success: true, path: [src], hops: [src] };

  let path: Device[] = [src];
  const hops: Device[] = [];
  const visited = new Set<string>([src.id]);
  let current = src;

  for (let ttl = 0; ttl < MAX_HOPS; ttl++) {
    const decision = lookupRoute(current, targetIp);
    if (!decision) {
      const error = isHost(current)
        ? 'Network is unreachable (No Default Gateway).'
        : `Reply from ${firstIp(current)}: Destination net unreachable.`;
      return { success: false, error, path, hops };
    }
    if (decision.connected) {
      const segment = findLayer2Path(topology, current, target);
      if (!segment) return { success: false, error: 'Request timed out.', path, hops };
      path = path.concat(segment.slice(1));
      hops.push(target);
      const mac = target.interfaces.find((i) => i.ip === targetIp)?.mac;
      if (mac) current.arpTable[targetIp] = mac;
      return { success: true, path, hops };
    }
    const nextHopIp = decision.nextHop ?? '';
    const next = findDeviceByActiveIp(topology, nextHopIp);
    if (!next || visited.has(next.id)) {
      return { success: false, error: 'Destination host unreachable / Routing loop.', path, hops };
    }
    const segment = findLayer2Path(topology, current, next);
    if (!segment) {
      return { success: false, error: `Reply from ${firstIp(current)}: Destination host unreachable.`, path, hops };
    }
    const mac = next.interfaces.find((i) => i.ip === nextHopIp)?.mac;
    if (mac) current.arpTable[nextHopIp] = mac;
    visited.add(next.id);
    path = path.concat(segment.slice(1));
    hops.push(next);
    current = next;
  }
  return { success: false, error: 'Time to live exceeded.', path, hops };
}

export type DhcpOutcome =
  | { ok: true; server: Device; path: Device[]; ip: string; mask: string; gateway: string }
  | { ok: false; reason: 'not-host' | 'no-server' | 'pool-exhausted'; server?: Device; path?: Device[] };

/** Next free address in [startIp, broadcast) of the pool's subnet, skipping addresses already in use. */
export function allocateFromPool(server: Device, clientMac: string, inUse: ReadonlySet<string>): string | null {
  const pool = server.dhcpServer;
  const start = ipToLong(pool.startIp);
  const net = networkAddress(pool.startIp, pool.mask);
  const bcast = broadcastAddress(pool.startIp, pool.mask);
  const inPool = (ip: string): boolean => {
    const v = ipToLong(ip);
    return isValidIP(ip) && v >= start && v > net && v < bcast;
  };
  const existing = pool.leases[clientMac];
  if (existing && inPool(existing)) return existing;
  const leased = new Set(
    Object.entries(pool.leases)
      .filter(([mac]) => mac !== clientMac)
      .map(([, ip]) => ip),
  );
  for (let v = Math.max(start, net + 1); v < bcast; v++) {
    const candidate = longToIp(v);
    if (!leased.has(candidate) && !inUse.has(candidate) && candidate !== pool.gateway) {
      pool.leases[clientMac] = candidate;
      return candidate;
    }
  }
  return null;
}

export function requestDhcp(topology: Topology, client: Device): DhcpOutcome {
  if (!isHost(client)) return { ok: false, reason: 'not-host' };
  const clientIntf = client.interfaces[0];
  if (!clientIntf) return { ok: false, reason: 'not-host' };
  for (const server of topology.devices) {
    if (!server.dhcpServer.enabled || server.id === client.id) continue;
    const path = findLayer2Path(topology, client, server);
    if (!path) continue;
    const inUse = new Set(
      topology.devices.flatMap((d) => (d.id === client.id ? [] : d.interfaces.map((i) => i.ip))).filter(Boolean),
    );
    const ip = allocateFromPool(server, clientIntf.mac, inUse);
    if (!ip) return { ok: false, reason: 'pool-exhausted', server, path };
    clientIntf.ip = ip;
    clientIntf.mask = server.dhcpServer.mask;
    client.gateway = server.dhcpServer.gateway;
    return { ok: true, server, path, ip, mask: server.dhcpServer.mask, gateway: server.dhcpServer.gateway };
  }
  return { ok: false, reason: 'no-server' };
}
