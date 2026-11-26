import { DEFAULT_MASK, promptFor, uniqueId } from './devices';
import { isValidIP } from './ip';
import { CABLE_TYPES, CLI_MODES, DEVICE_TYPES, type CableType, type Device, type Link, type Topology } from './types';

export const SCHEMA_VERSION = '4.0';
const SUPPORTED_VERSIONS = new Set(['3.0', SCHEMA_VERSION]);

export const LIMITS = {
  devices: 500,
  links: 2000,
  zones: 100,
  interfaces: 64,
  routes: 256,
  tableEntries: 1024,
  cliLines: 500,
  name: 64,
  zoneTitle: 120,
  coordinate: 1_000_000,
} as const;

const MAC_RE = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;

export type LinkError = 'duplicate-link' | 'same-device' | 'port-busy';

export function emptyTopology(): Topology {
  return { devices: [], links: [], zones: [], deviceCounter: 1 };
}

export function serialize(topology: Topology): string {
  return JSON.stringify(
    {
      version: SCHEMA_VERSION,
      devices: topology.devices,
      links: topology.links,
      zones: topology.zones,
      deviceCounter: topology.deviceCounter,
    },
    null,
    2,
  );
}

export function linkBetween(topology: Topology, a: Device, b: Device): Link | undefined {
  return topology.links.find(
    (l) => (l.sourceId === a.id && l.targetId === b.id) || (l.sourceId === b.id && l.targetId === a.id),
  );
}

/** Connects two devices on the given (or first free) ports. */
export function addLink(
  topology: Topology,
  a: Device,
  b: Device,
  type: CableType = 'auto',
  portA: number | null = null,
  portB: number | null = null,
): Link | LinkError {
  if (a.id === b.id) return 'same-device';
  if (linkBetween(topology, a, b)) return 'duplicate-link';
  const idxA = portA ?? a.interfaces.findIndex((i) => !i.connectedTo);
  const idxB = portB ?? b.interfaces.findIndex((i) => !i.connectedTo);
  const intfA = a.interfaces[idxA];
  const intfB = b.interfaces[idxB];
  if (!intfA || !intfB || intfA.connectedTo || intfB.connectedTo) return 'port-busy';
  const link: Link = { id: uniqueId('link'), sourceId: a.id, srcIntf: idxA, targetId: b.id, tgtIntf: idxB, type };
  intfA.connectedTo = link.id;
  intfB.connectedTo = link.id;
  topology.links.push(link);
  return link;
}

function releasePorts(topology: Topology, link: Link): void {
  for (const [id, idx] of [
    [link.sourceId, link.srcIntf],
    [link.targetId, link.tgtIntf],
  ] as const) {
    const intf = topology.devices.find((d) => d.id === id)?.interfaces[idx];
    if (intf?.connectedTo === link.id) intf.connectedTo = null;
  }
}

export function removeLink(topology: Topology, linkId: string): boolean {
  const link = topology.links.find((l) => l.id === linkId);
  if (!link) return false;
  releasePorts(topology, link);
  topology.links = topology.links.filter((l) => l.id !== linkId);
  return true;
}

export function removeDevice(topology: Topology, deviceId: string): boolean {
  if (!topology.devices.some((d) => d.id === deviceId)) return false;
  for (const link of topology.links.filter((l) => l.sourceId === deviceId || l.targetId === deviceId)) {
    removeLink(topology, link.id);
  }
  topology.devices = topology.devices.filter((d) => d.id !== deviceId);
  return true;
}

// ---------------------------------------------------------------------------
// Import validation. Untrusted JSON (file import or localStorage) is rebuilt
// field by field into fresh objects; nothing is spread or assigned wholesale,
// so unknown keys (including __proto__) never reach application state.
// ---------------------------------------------------------------------------

export class TopologyValidationError extends Error {
  constructor(public readonly path: string, detail: string) {
    super(`${path}: ${detail}`);
    this.name = 'TopologyValidationError';
  }
}

type Json = Record<string, unknown>;

const fail = (path: string, detail: string): never => {
  throw new TopologyValidationError(path, detail);
};

function obj(value: unknown, path: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object');
  return value as Json;
}

function arr(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  const list = value as unknown[];
  if (list.length > max) fail(path, `too many entries (max ${max})`);
  return list;
}

function str(value: unknown, path: string, max: number, fallback?: string): string {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string') fail(path, 'expected a string');
  const s = value as string;
  if (s.length > max) fail(path, `longer than ${max} characters`);
  return s;
}

function ipOrEmpty(value: unknown, path: string, fallback = ''): string {
  const s = str(value, path, 15, fallback).trim();
  if (s !== '' && !isValidIP(s)) fail(path, `invalid IPv4 address "${s}"`);
  return s;
}

function int(value: unknown, path: string, min: number, max: number, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `expected an integer between ${min} and ${max}`);
  }
  return value as number;
}

function coord(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > LIMITS.coordinate) {
    fail(path, 'expected a finite coordinate');
  }
  return value as number;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string, fallback?: T): T {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(path, `expected one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function mac(value: unknown, path: string): string {
  const s = str(value, path, 17);
  if (!MAC_RE.test(s)) fail(path, `invalid MAC address "${s}"`);
  return s.toUpperCase();
}

function stringMap(value: unknown, path: string, key: (k: string, p: string) => string, val: (v: unknown, p: string) => string): Record<string, string> {
  if (value === undefined) return {};
  const entries = Object.entries(obj(value, path));
  if (entries.length > LIMITS.tableEntries) fail(path, `too many entries (max ${LIMITS.tableEntries})`);
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [k, v] of entries) out[key(k, `${path}.${k}`)] = val(v, `${path}.${k}`);
  return { ...out };
}

function parseDevice(raw: unknown, path: string): Device {
  const d = obj(raw, path);
  const typeStr = oneOf(d.typeStr, DEVICE_TYPES, `${path}.typeStr`);
  const name = str(d.name, `${path}.name`, LIMITS.name).trim();
  if (!name) fail(`${path}.name`, 'must not be empty');
  const interfaces = arr(d.interfaces, `${path}.interfaces`, LIMITS.interfaces).map((ri, i) => {
    const p = `${path}.interfaces[${i}]`;
    const intf = obj(ri, p);
    return {
      name: str(intf.name, `${p}.name`, LIMITS.name),
      ip: ipOrEmpty(intf.ip, `${p}.ip`),
      mask: ipOrEmpty(intf.mask, `${p}.mask`, DEFAULT_MASK),
      mac: mac(intf.mac, `${p}.mac`),
      connectedTo: null,
      adminUp: intf.adminUp === undefined ? true : intf.adminUp === true,
    };
  });
  if (interfaces.length === 0) fail(`${path}.interfaces`, 'a device needs at least one interface');
  const dhcpRaw = d.dhcpServer === undefined ? {} : obj(d.dhcpServer, `${path}.dhcpServer`);
  const id = str(d.id, `${path}.id`, 128);
  if (!id) fail(`${path}.id`, 'must not be empty');
  const cliMode = oneOf(d.cliMode, CLI_MODES, `${path}.cliMode`, 'user');
  return {
    id,
    typeStr,
    name,
    x: coord(d.x, `${path}.x`),
    y: coord(d.y, `${path}.y`),
    cliMode,
    selectedIfIndex: Math.min(int(d.selectedIfIndex, `${path}.selectedIfIndex`, 0, LIMITS.interfaces, 0), interfaces.length - 1),
    staticRoutes: arr(d.staticRoutes ?? [], `${path}.staticRoutes`, LIMITS.routes).map((rr, i) => {
      const p = `${path}.staticRoutes[${i}]`;
      const r = obj(rr, p);
      const dest = ipOrEmpty(r.dest, `${p}.dest`);
      const mask = ipOrEmpty(r.mask, `${p}.mask`);
      const nextHop = ipOrEmpty(r.nextHop, `${p}.nextHop`);
      if (!dest || !mask || !nextHop) fail(p, 'route requires dest, mask and nextHop');
      return { dest, mask, nextHop };
    }),
    arpTable: stringMap(
      d.arpTable,
      `${path}.arpTable`,
      (k, p) => (isValidIP(k) ? k : fail(p, 'invalid IPv4 key')),
      (v, p) => mac(v, p),
    ),
    macTable: arr(d.macTable ?? [], `${path}.macTable`, LIMITS.tableEntries).map((re, i) => {
      const e = obj(re, `${path}.macTable[${i}]`);
      return { mac: mac(e.mac, `${path}.macTable[${i}].mac`), port: str(e.port, `${path}.macTable[${i}].port`, LIMITS.name) };
    }),
    dhcpServer: {
      enabled: dhcpRaw.enabled === true,
      startIp: ipOrEmpty(dhcpRaw.startIp, `${path}.dhcpServer.startIp`),
      mask: ipOrEmpty(dhcpRaw.mask, `${path}.dhcpServer.mask`, DEFAULT_MASK),
      gateway: ipOrEmpty(dhcpRaw.gateway, `${path}.dhcpServer.gateway`),
      leases: stringMap(
        dhcpRaw.leases,
        `${path}.dhcpServer.leases`,
        (k, p) => (MAC_RE.test(k) ? k.toUpperCase() : fail(p, 'invalid MAC key')),
        (v, p) => ipOrEmpty(v, p),
      ),
    },
    cliOutput: arr(d.cliOutput ?? [], `${path}.cliOutput`, Number.MAX_SAFE_INTEGER)
      .slice(-LIMITS.cliLines)
      .map((l, i) => str(l, `${path}.cliOutput[${i}]`, 10_000)),
    interfaces,
    gateway: ipOrEmpty(d.gateway, `${path}.gateway`),
    prompt: promptFor(typeStr, name),
  };
}

/**
 * Validates untrusted topology JSON and returns a fully consistent topology.
 * Throws {@link TopologyValidationError} describing the first problem found.
 */
export function parseTopology(input: unknown): Topology {
  const root = obj(input, 'topology');
  if (root.version !== undefined) {
    const version = str(root.version, 'version', 16);
    if (!SUPPORTED_VERSIONS.has(version)) fail('version', `unsupported schema version "${version}"`);
  }
  const devices = arr(root.devices, 'devices', LIMITS.devices).map((d, i) => parseDevice(d, `devices[${i}]`));
  const byId = new Map<string, Device>();
  for (const [i, d] of devices.entries()) {
    if (byId.has(d.id)) fail(`devices[${i}].id`, `duplicate device id "${d.id}"`);
    byId.set(d.id, d);
  }

  const linkIds = new Set<string>();
  const links = arr(root.links, 'links', LIMITS.links).map((rl, i): Link => {
    const p = `links[${i}]`;
    const l = obj(rl, p);
    const link: Link = {
      id: str(l.id, `${p}.id`, 128),
      sourceId: str(l.sourceId, `${p}.sourceId`, 128),
      srcIntf: int(l.srcIntf, `${p}.srcIntf`, 0, LIMITS.interfaces - 1),
      targetId: str(l.targetId, `${p}.targetId`, 128),
      tgtIntf: int(l.tgtIntf, `${p}.tgtIntf`, 0, LIMITS.interfaces - 1),
      type: oneOf(l.type, CABLE_TYPES, `${p}.type`, 'auto'),
    };
    if (!link.id || linkIds.has(link.id)) fail(`${p}.id`, 'missing or duplicate link id');
    linkIds.add(link.id);
    if (link.sourceId === link.targetId) fail(p, 'a link cannot connect a device to itself');
    for (const [devId, idx, side] of [
      [link.sourceId, link.srcIntf, 'source'],
      [link.targetId, link.tgtIntf, 'target'],
    ] as const) {
      const intf = byId.get(devId)?.interfaces[idx];
      if (!intf) fail(p, `${side} port ${devId}#${idx} does not exist`);
      else if (intf.connectedTo) fail(p, `${side} port ${devId}#${idx} is already in use`);
      else intf.connectedTo = link.id;
    }
    return link;
  });

  const zones = arr(root.zones ?? [], 'zones', LIMITS.zones).map((rz, i) => {
    const p = `zones[${i}]`;
    const z = obj(rz, p);
    const w = coord(z.w, `${p}.w`);
    const h = coord(z.h, `${p}.h`);
    if (w <= 0 || h <= 0) fail(p, 'zone size must be positive');
    return {
      id: str(z.id, `${p}.id`, 128),
      title: str(z.title, `${p}.title`, LIMITS.zoneTitle, ''),
      x: coord(z.x, `${p}.x`),
      y: coord(z.y, `${p}.y`),
      w,
      h,
    };
  });

  const deviceCounter = Math.max(int(root.deviceCounter, 'deviceCounter', 1, Number.MAX_SAFE_INTEGER, 1), devices.length + 1);
  return { devices, links, zones, deviceCounter };
}

export function parseTopologyJson(text: string): Topology {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TopologyValidationError('file', 'not valid JSON');
  }
  return parseTopology(data);
}
