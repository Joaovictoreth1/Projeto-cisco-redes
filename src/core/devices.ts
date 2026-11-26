import { generateMAC } from './ip';
import type { Device, DeviceType, NetInterface, Topology } from './types';

export const DEFAULT_MASK = '255.255.255.0';

const makeInterface = (name: string, ip = '', mask = DEFAULT_MASK): NetInterface => ({
  name,
  ip,
  mask,
  mac: generateMAC(),
  connectedTo: null,
  adminUp: true,
});

function buildInterfaces(type: DeviceType): NetInterface[] {
  switch (type) {
    case 'router':
      return Array.from({ length: 4 }, (_, i) => makeInterface(`GigabitEthernet0/${i}`));
    case 'switch':
      return Array.from({ length: 8 }, (_, i) => makeInterface(`FastEthernet0/${i + 1}`));
    case 'cloud':
      return [makeInterface('WAN0', '8.8.8.8'), makeInterface('WAN1', '1.1.1.1')];
    default:
      return [makeInterface('eth0')];
  }
}

export function promptFor(type: DeviceType, name: string): string {
  if (type === 'router' || type === 'switch') return `${name}>`;
  if (type === 'cloud') return 'wan-cloud> ';
  return `user@${name.toLowerCase()}:~$ `;
}

export function bannerFor(name: string): string[] {
  return ['SwitchLab IOS XE Software, Version 17.12.01 Enterprise', `Device ${name} initialized and ready.\n`];
}

let idSequence = 0;
export function uniqueId(prefix: string): string {
  idSequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSequence.toString(36)}`;
}

/**
 * Creates a device and advances the topology's counter. The counter is only
 * touched here, never while restoring a snapshot, so undo/redo keeps names stable.
 */
export function createDevice(
  topology: Topology,
  type: DeviceType,
  namePrefix: string,
  x: number,
  y: number,
  exactName?: string,
): Device {
  const seq = topology.deviceCounter;
  topology.deviceCounter += 1;
  const name = exactName ?? `${namePrefix}${seq}`;
  return {
    id: uniqueId(`dev_${seq}`),
    typeStr: type,
    name,
    x,
    y,
    cliMode: 'user',
    selectedIfIndex: 0,
    staticRoutes: [],
    arpTable: {},
    macTable: [],
    dhcpServer: { enabled: false, startIp: '', mask: DEFAULT_MASK, gateway: '', leases: {} },
    cliOutput: bannerFor(name),
    interfaces: buildInterfaces(type),
    gateway: '',
    prompt: promptFor(type, name),
  };
}

export function findDevice(topology: Topology, id: string): Device | undefined {
  return topology.devices.find((d) => d.id === id);
}

export function findDeviceByIp(topology: Topology, ip: string): Device | undefined {
  return topology.devices.find((d) => d.interfaces.some((i) => i.ip === ip));
}

export function freePortIndex(dev: Device): number {
  return dev.interfaces.findIndex((i) => !i.connectedTo);
}
