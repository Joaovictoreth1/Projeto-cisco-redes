export type DeviceType = 'pc' | 'laptop' | 'server' | 'router' | 'switch' | 'cloud';
export type CableType = 'auto' | 'straight' | 'cross' | 'fiber';
export type CliMode = 'user' | 'priv' | 'config' | 'if';

export const DEVICE_TYPES: readonly DeviceType[] = ['pc', 'laptop', 'server', 'router', 'switch', 'cloud'];
export const CABLE_TYPES: readonly CableType[] = ['auto', 'straight', 'cross', 'fiber'];
export const CLI_MODES: readonly CliMode[] = ['user', 'priv', 'config', 'if'];
export const HOST_TYPES: readonly DeviceType[] = ['pc', 'laptop', 'server'];
export const LAYER3_TYPES: readonly DeviceType[] = ['pc', 'laptop', 'server', 'router', 'cloud'];

export interface NetInterface {
  name: string;
  ip: string;
  mask: string;
  mac: string;
  connectedTo: string | null;
  adminUp: boolean;
}

export interface StaticRoute {
  dest: string;
  mask: string;
  nextHop: string;
}

export interface MacEntry {
  mac: string;
  port: string;
}

export interface DhcpServerConfig {
  enabled: boolean;
  startIp: string;
  mask: string;
  gateway: string;
  leases: Record<string, string>;
}

export interface Device {
  id: string;
  typeStr: DeviceType;
  name: string;
  x: number;
  y: number;
  cliMode: CliMode;
  selectedIfIndex: number;
  staticRoutes: StaticRoute[];
  arpTable: Record<string, string>;
  macTable: MacEntry[];
  dhcpServer: DhcpServerConfig;
  cliOutput: string[];
  interfaces: NetInterface[];
  gateway: string;
  prompt: string;
}

export interface Link {
  id: string;
  sourceId: string;
  srcIntf: number;
  targetId: string;
  tgtIntf: number;
  type: CableType;
}

export interface Zone {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Topology {
  devices: Device[];
  links: Link[];
  zones: Zone[];
  deviceCounter: number;
}

export const isHost = (dev: Pick<Device, 'typeStr'>): boolean => HOST_TYPES.includes(dev.typeStr);
export const isLayer3 = (dev: Pick<Device, 'typeStr'>): boolean => LAYER3_TYPES.includes(dev.typeStr);
export const isIosDevice = (dev: Pick<Device, 'typeStr'>): boolean =>
  dev.typeStr === 'router' || dev.typeStr === 'switch';
