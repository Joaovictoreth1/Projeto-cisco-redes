import { describe, expect, it } from 'vitest';
import { createDevice, findDevice, findDeviceByIp, freePortIndex } from '../src/core/devices';
import {
  addLink,
  emptyTopology,
  LIMITS,
  parseTopology,
  parseTopologyJson,
  removeDevice,
  removeLink,
  serialize,
  TopologyValidationError,
} from '../src/core/topology';
import { buildPreset, PRESET_KEYS } from '../src/core/presets';
import { device, twoRouterLab } from './helpers';

const roundTrip = (json: string) => parseTopologyJson(json);
const base = () =>
  JSON.parse(serialize(twoRouterLab().t)) as Record<string, unknown> & {
    devices: Record<string, unknown>[];
    links: Record<string, unknown>[];
  };
const expectInvalid = (data: unknown, pattern: RegExp) => {
  expect(() => parseTopology(data)).toThrow(TopologyValidationError);
  expect(() => parseTopology(data)).toThrow(pattern);
};

describe('device factory', () => {
  it('names devices from the counter and only advances it on creation', () => {
    const t = emptyTopology();
    const a = createDevice(t, 'router', 'R', 10, 20);
    const b = createDevice(t, 'switch', 'SW', 0, 0);
    expect([a.name, b.name, t.deviceCounter]).toEqual(['R1', 'SW2', 3]);
    expect(a.interfaces.map((i) => i.name)).toEqual([
      'GigabitEthernet0/0',
      'GigabitEthernet0/1',
      'GigabitEthernet0/2',
      'GigabitEthernet0/3',
    ]);
    expect(b.interfaces).toHaveLength(8);
    expect(createDevice(t, 'cloud', 'C', 0, 0).interfaces.map((i) => i.ip)).toEqual(['8.8.8.8', '1.1.1.1']);
    expect(createDevice(t, 'server', 'S', 0, 0).prompt).toBe('user@s4:~$ ');
    expect(a.id).not.toBe(b.id);
  });

  it('looks devices up by id, ip and free port', () => {
    const { t, pc1, sw } = twoRouterLab();
    expect(findDevice(t, pc1.id)).toBe(pc1);
    expect(findDeviceByIp(t, '10.1.0.10')).toBe(pc1);
    expect(freePortIndex(sw)).toBe(2);
    expect(freePortIndex(pc1)).toBe(-1);
  });
});

describe('links', () => {
  it('rejects duplicate links, self links and busy ports', () => {
    const { t, pc1, sw, r1 } = twoRouterLab();
    expect(addLink(t, pc1, sw)).toBe('duplicate-link');
    expect(addLink(t, sw, sw)).toBe('same-device');
    expect(addLink(t, r1, device(t, 'pc', 'Y'), 'auto', 0, 0)).toBe('port-busy');
    expect(addLink(t, r1, device(t, 'pc', 'X'), 'auto', 9, 0)).toBe('port-busy');
  });

  it('frees both ports when a link or a device is removed', () => {
    const { t, pc1, sw, r1 } = twoRouterLab();
    const link = t.links.find((l) => l.sourceId === pc1.id);
    expect(removeLink(t, link?.id ?? '')).toBe(true);
    expect(pc1.interfaces[0]?.connectedTo).toBeNull();
    expect(sw.interfaces[0]?.connectedTo).toBeNull();
    expect(removeLink(t, 'missing')).toBe(false);
    expect(removeDevice(t, sw.id)).toBe(true);
    expect(r1.interfaces[0]?.connectedTo).toBeNull();
    expect(t.links.some((l) => l.sourceId === sw.id || l.targetId === sw.id)).toBe(false);
    expect(removeDevice(t, sw.id)).toBe(false);
  });
});

describe('serialization', () => {
  it('round-trips every preset without losing state', () => {
    for (const key of PRESET_KEYS) {
      const t = buildPreset(key, 1280, 800);
      const restored = roundTrip(serialize(t));
      expect(serialize(restored)).toBe(serialize(t));
    }
  });

  it('accepts legacy 3.0 files and fills optional fields', () => {
    const data = base();
    data.version = '3.0';
    delete data.zones;
    delete data.deviceCounter;
    for (const d of data.devices) {
      delete d.staticRoutes;
      delete d.arpTable;
      delete d.macTable;
      delete d.dhcpServer;
      delete d.cliOutput;
      delete d.cliMode;
      delete d.selectedIfIndex;
    }
    const t = parseTopology(data);
    expect(t.zones).toEqual([]);
    expect(t.deviceCounter).toBe(t.devices.length + 1);
    expect(t.devices[0]?.dhcpServer).toEqual({
      enabled: false,
      startIp: '',
      mask: '255.255.255.0',
      gateway: '',
      leases: {},
    });
  });

  it('rebuilds port occupancy from links instead of trusting connectedTo', () => {
    const data = base();
    const intf = (data.devices[0]?.interfaces as Record<string, unknown>[])[0];
    if (intf) intf.connectedTo = 'forged';
    const t = parseTopology(data);
    expect(t.devices[0]?.interfaces[0]?.connectedTo).toBe(t.links[0]?.id);
  });

  it('drops unknown keys and never pollutes prototypes', () => {
    const json = serialize(twoRouterLab().t).replace(
      '"typeStr"',
      '"__proto__": {"polluted": true}, "onclick": "alert(1)", "typeStr"',
    );
    const t = roundTrip(json);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(t.devices[0] ?? {})).not.toContain('onclick');
  });

  it('keeps hostile strings as inert data and trims long CLI history', () => {
    const data = base();
    const dev = data.devices[0];
    if (!dev) throw new Error('fixture');
    dev.name = '<img src=x onerror=alert(1)>';
    dev.cliOutput = Array.from({ length: LIMITS.cliLines + 50 }, (_, i) => `line ${i}`);
    const t = parseTopology(data);
    expect(t.devices[0]?.name).toBe('<img src=x onerror=alert(1)>');
    expect(t.devices[0]?.cliOutput).toHaveLength(LIMITS.cliLines);
    expect(t.devices[0]?.cliOutput.at(-1)).toBe(`line ${LIMITS.cliLines + 49}`);
  });

  it('normalizes MAC case, clamps the selected interface and recomputes prompts', () => {
    const data = base();
    const dev = data.devices[0];
    if (!dev) throw new Error('fixture');
    (dev.interfaces as Record<string, unknown>[])[0]!.mac = 'aa:bb:cc:dd:ee:ff';
    dev.selectedIfIndex = 40;
    dev.prompt = '<script>';
    dev.arpTable = { '10.0.0.1': 'aa:bb:cc:dd:ee:01' };
    dev.dhcpServer = { enabled: true, startIp: '10.0.0.5', leases: { 'aa:bb:cc:dd:ee:02': '10.0.0.5' } };
    const parsed = parseTopology(data).devices[0];
    expect(parsed?.interfaces[0]?.mac).toBe('AA:BB:CC:DD:EE:FF');
    expect(parsed?.selectedIfIndex).toBe(0);
    expect(parsed?.prompt).toBe('user@pc1:~$ ');
    expect(parsed?.arpTable).toEqual({ '10.0.0.1': 'AA:BB:CC:DD:EE:01' });
    expect(parsed?.dhcpServer.leases).toEqual({ 'AA:BB:CC:DD:EE:02': '10.0.0.5' });
  });

  it.each<[string, (d: ReturnType<typeof base>) => void, RegExp]>([
    ['non-object root', () => undefined, /expected an object/],
    ['bad version', (d) => (d.version = '9.9'), /unsupported schema version/],
    ['devices not array', (d) => ((d as Record<string, unknown>).devices = {}), /devices: expected an array/],
    ['unknown device type', (d) => (d.devices[0]!.typeStr = 'toaster'), /typeStr: expected one of/],
    ['empty name', (d) => (d.devices[0]!.name = '   '), /name: must not be empty/],
    ['long name', (d) => (d.devices[0]!.name = 'x'.repeat(65)), /longer than 64/],
    ['empty id', (d) => (d.devices[0]!.id = ''), /id: must not be empty/],
    ['duplicate id', (d) => (d.devices[1]!.id = d.devices[0]!.id), /duplicate device id/],
    ['NaN coordinate', (d) => (d.devices[0]!.x = 'NaN'), /finite coordinate/],
    ['huge coordinate', (d) => (d.devices[0]!.y = 1e12), /finite coordinate/],
    ['no interfaces', (d) => (d.devices[0]!.interfaces = []), /at least one interface/],
    ['bad ip', (d) => ((d.devices[0]!.interfaces as Record<string, unknown>[])[0]!.ip = '300.1.1.1'), /invalid IPv4/],
    ['bad mac', (d) => ((d.devices[0]!.interfaces as Record<string, unknown>[])[0]!.mac = 'zz'), /invalid MAC/],
    ['bad mode', (d) => (d.devices[0]!.cliMode = 'root'), /cliMode/],
    ['bad index', (d) => (d.devices[0]!.selectedIfIndex = -1), /selectedIfIndex/],
    [
      'incomplete route',
      (d) => (d.devices[0]!.staticRoutes = [{ dest: '10.0.0.0', mask: '', nextHop: '' }]),
      /route requires/,
    ],
    ['bad arp key', (d) => (d.devices[0]!.arpTable = { nope: 'AA:BB:CC:DD:EE:FF' }), /invalid IPv4 key/],
    ['bad lease key', (d) => (d.devices[0]!.dhcpServer = { leases: { nope: '10.0.0.1' } }), /invalid MAC key/],
    ['bad mac table', (d) => (d.devices[0]!.macTable = [{ mac: 'x', port: 'Fa0/1' }]), /invalid MAC/],
    ['non-string cli', (d) => (d.devices[0]!.cliOutput = [42]), /expected a string/],
    [
      'too many devices',
      (d) => (d.devices = Array.from({ length: LIMITS.devices + 1 }, () => d.devices[0]!)),
      /too many entries/,
    ],
    ['dangling link', (d) => (d.links[0]!.targetId = 'ghost'), /does not exist/],
    ['self link', (d) => (d.links[0]!.targetId = d.links[0]!.sourceId), /to itself/],
    ['duplicate link id', (d) => (d.links[1]!.id = d.links[0]!.id), /duplicate link id/],
    ['port reuse', (d) => (d.links[1]!.srcIntf = 0), /already in use/],
    ['bad cable', (d) => (d.links[0]!.type = 'wifi'), /type: expected one of/],
    ['fractional port', (d) => (d.links[0]!.srcIntf = 0.5), /expected an integer/],
    [
      'bad zone size',
      (d) => ((d as Record<string, unknown>).zones = [{ id: 'z', title: 't', x: 0, y: 0, w: 0, h: 10 }]),
      /size must be positive/,
    ],
    [
      'long zone title',
      (d) => ((d as Record<string, unknown>).zones = [{ id: 'z', title: 'x'.repeat(200), x: 0, y: 0, w: 5, h: 5 }]),
      /longer than 120/,
    ],
    [
      'too many arp entries',
      (d) =>
        (d.devices[0]!.arpTable = Object.fromEntries(
          Array.from({ length: LIMITS.tableEntries + 1 }, (_, i) => [
            `10.0.${Math.floor(i / 250)}.${i % 250}`,
            'AA:BB:CC:DD:EE:FF',
          ]),
        )),
      /too many entries/,
    ],
  ])('rejects %s', (_label, mutate, pattern) => {
    if (_label === 'non-object root') {
      expectInvalid([], pattern);
      return;
    }
    const data = base();
    mutate(data);
    expectInvalid(data, pattern);
  });

  it('rejects malformed JSON text', () => {
    expect(() => parseTopologyJson('{not json')).toThrow('file: not valid JSON');
  });
});

describe('presets', () => {
  it('builds every preset with exact device names and a working path', () => {
    const t = buildPreset('default', 1280, 800);
    expect(t.devices.map((d) => d.name)).toEqual(['WAN-Internet', 'R1-Core', 'SW-Dist', 'Host-01', 'Srv-Web']);
    expect(buildPreset('dual_lan', 400, 300).devices).toHaveLength(5);
    expect(buildPreset('mesh_wan', 1280, 800).links).toHaveLength(3);
    expect(buildPreset('dhcp_lab', 1280, 800).devices[0]?.dhcpServer.enabled).toBe(true);
  });
});
