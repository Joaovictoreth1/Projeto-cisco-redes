import { describe, expect, it } from 'vitest';
import { complete, executeCommand, resolveInterface, syncPrompt } from '../src/core/cli';
import { emptyTopology } from '../src/core/topology';
import type { Device } from '../src/core/types';
import { device, twoRouterLab } from './helpers';

const run = (dev: Device, ...cmds: string[]) => cmds.map((c) => executeCommand(dev, c)).at(-1);

const router = (): Device => device(emptyTopology(), 'router', 'R1');

describe('host shell', () => {
  const pc = (): Device => device(emptyTopology(), 'pc', 'PC1', '10.0.0.5');

  it('prints help and handles empty input and clear', () => {
    const dev = pc();
    expect(executeCommand(dev, 'help').lines[0]).toMatch(/Comandos disponíveis/);
    expect(executeCommand(dev, '   ')).toEqual({ lines: [] });
    expect(executeCommand(dev, 'cls')).toEqual({ lines: [], clear: true });
  });

  it('turns ping, traceroute and dhcp into actions', () => {
    const dev = pc();
    expect(executeCommand(dev, 'ping 10.0.0.1').action).toEqual({ kind: 'ping', target: '10.0.0.1' });
    expect(executeCommand(dev, 'tracert 10.0.0.1').action).toEqual({ kind: 'traceroute', target: '10.0.0.1' });
    expect(executeCommand(dev, 'ping').lines).toEqual(['Uso: ping <endereco_ip>']);
    expect(executeCommand(dev, 'traceroute').lines).toEqual(['Uso: traceroute <endereco_ip>']);
    expect(executeCommand(dev, 'IPCONFIG /RENEW').action).toEqual({ kind: 'dhcp' });
    expect(executeCommand(dev, 'dhclient').action).toEqual({ kind: 'dhcp' });
  });

  it('shows interface config and the ARP table', () => {
    const dev = pc();
    expect(executeCommand(dev, 'ipconfig').lines[0]).toContain('inet 10.0.0.5');
    dev.interfaces[0] = { ...dev.interfaces[0]!, ip: '', mask: '', adminUp: false };
    expect(executeCommand(dev, 'ifconfig').lines[0]).toContain('inet 0.0.0.0  netmask 0.0.0.0');
    expect(executeCommand(dev, 'arp -a').lines).toEqual(['Tabela ARP vazia.']);
    dev.arpTable['10.0.0.1'] = 'AA:BB:CC:DD:EE:FF';
    expect(executeCommand(dev, 'arp -a').lines[1]).toMatch(/^10\.0\.0\.1\s+AA:BB:CC:DD:EE:FF\s+dynamic$/);
  });

  it('rejects unknown commands with the original spelling', () => {
    expect(executeCommand(pc(), 'Foo').lines).toEqual(["bash: Foo: comando não encontrado. Digite 'help'."]);
  });
});

describe('IOS mode transitions', () => {
  it('walks user -> priv -> config -> if and back', () => {
    const dev = router();
    run(dev, 'en');
    expect(dev.prompt).toBe('R1#');
    run(dev, 'conf t');
    expect(dev.prompt).toBe('R1(config)#');
    run(dev, 'int g0/1');
    expect(dev.prompt).toBe('R1(config-if)#');
    run(dev, 'exit');
    expect(dev.cliMode).toBe('config');
    run(dev, 'end');
    expect(dev.cliMode).toBe('priv');
    run(dev, 'exit');
    expect(dev.cliMode).toBe('user');
    run(dev, 'exit', 'end');
    expect(dev.cliMode).toBe('user');
    run(dev, 'enable', 'disable');
    expect(dev.cliMode).toBe('user');
    run(dev, 'enable', 'enable');
    expect(dev.cliMode).toBe('priv');
  });

  it('refuses configure terminal outside privileged mode', () => {
    expect(executeCommand(router(), 'configure terminal').lines[0]).toMatch(/Invalid input/);
  });

  it('prints help', () => {
    expect(executeCommand(router(), '?').lines[0]).toMatch(/Comandos IOS/);
  });
});

describe('IOS configuration', () => {
  const config = (): Device => {
    const dev = router();
    run(dev, 'enable', 'configure terminal');
    return dev;
  };

  it.each([
    ['g0/1', 1],
    ['gi0/1', 1],
    ['Gig0/2', 2],
    ['gigabitethernet 0/3', 3],
    ['GigabitEthernet0/0', 0],
  ])('resolves router interface %s', (spec, idx) => {
    const dev = config();
    expect(executeCommand(dev, `interface ${spec}`).lines).toEqual([]);
    expect(dev.selectedIfIndex).toBe(idx);
  });

  it('resolves switch, host and cloud interface names', () => {
    const t = emptyTopology();
    const sw = device(t, 'switch', 'SW');
    expect(resolveInterface(sw.interfaces, 'f0/3')).toBe(2);
    expect(resolveInterface(sw.interfaces, 'fa0/8')).toBe(7);
    expect(resolveInterface(sw.interfaces, 'fa0/9')).toBe(-1);
    expect(resolveInterface(sw.interfaces, 'g0/1')).toBe(-1);
    expect(resolveInterface(sw.interfaces, '0/1')).toBe(-1);
    expect(resolveInterface(device(t, 'pc', 'PC').interfaces, 'eth0')).toBe(0);
    expect(resolveInterface(device(t, 'cloud', 'C').interfaces, 'wan1')).toBe(1);
    expect(resolveInterface([{ name: 'Weird', ip: '', mask: '', mac: '', connectedTo: null, adminUp: true }], 'w0')).toBe(-1);
  });

  it('validates interface commands', () => {
    const dev = config();
    expect(executeCommand(dev, 'interface g9/9').lines).toEqual(['% Invalid interface type and number']);
    expect(executeCommand(dev, 'interface').lines).toEqual(['% Incomplete command.']);
    expect(executeCommand(router(), 'interface g0/0').lines[0]).toMatch(/Invalid input/);
  });

  it('sets interface addresses with a contiguous mask', () => {
    const dev = config();
    run(dev, 'int g0/2');
    expect(executeCommand(dev, 'ip address 10.0.0.1 255.255.255.0')).toEqual({ lines: [], mutated: true });
    expect(dev.interfaces[2]).toMatchObject({ ip: '10.0.0.1', mask: '255.255.255.0' });
    expect(executeCommand(dev, 'ip add 10.0.0.1 255.0.255.0').lines).toEqual(['% Invalid IP address or subnet mask']);
    expect(executeCommand(config(), 'ip address 10.0.0.1 255.255.255.0').lines[0]).toMatch(/Invalid input/);
  });

  it('toggles administrative state', () => {
    const dev = config();
    run(dev, 'int g0/0');
    expect(executeCommand(dev, 'shut').lines[0]).toMatch(/administratively down/);
    expect(dev.interfaces[0]?.adminUp).toBe(false);
    expect(executeCommand(dev, 'no shut').lines[0]).toMatch(/changed state to up/);
    expect(dev.interfaces[0]?.adminUp).toBe(true);
    expect(executeCommand(config(), 'shutdown').lines[0]).toMatch(/Invalid input/);
  });

  it('adds validated, de-duplicated static routes', () => {
    const dev = config();
    expect(executeCommand(dev, 'ip route 10.2.0.0 255.255.255.0 10.0.12.2').mutated).toBe(true);
    run(dev, 'ip route 10.2.0.0 255.255.255.0 10.0.12.2');
    expect(dev.staticRoutes).toHaveLength(1);
    expect(executeCommand(dev, 'ip route 10.2.0.0 255.0.255.0 10.0.12.2').lines).toEqual(['% Inconsistent address and mask']);
    expect(executeCommand(router(), 'ip route 10.2.0.0 255.255.255.0 10.0.12.2').lines[0]).toMatch(/Invalid input/);
  });

  it('renames the device with a valid hostname only', () => {
    const dev = config();
    expect(executeCommand(dev, 'hostname Core-1')).toEqual({ lines: [], mutated: true });
    expect(dev.prompt).toBe('Core-1(config)#');
    expect(executeCommand(dev, 'hostname <img/src=x>').lines).toEqual(['% Invalid hostname']);
    expect(executeCommand(dev, 'hostname').lines).toEqual(['% Incomplete command.']);
    expect(executeCommand(router(), 'hostname X').lines[0]).toMatch(/Invalid input/);
  });

  it('only lets routers ping or traceroute', () => {
    const dev = router();
    expect(executeCommand(dev, 'ping 10.0.0.1').action).toEqual({ kind: 'ping', target: '10.0.0.1' });
    expect(executeCommand(dev, 'traceroute 10.0.0.1').action).toEqual({ kind: 'traceroute', target: '10.0.0.1' });
    expect(executeCommand(dev, 'ping').lines).toEqual(['% Incomplete command.']);
    const sw = device(emptyTopology(), 'switch', 'SW');
    expect(executeCommand(sw, 'ping 10.0.0.1').action).toBeUndefined();
  });

  it('reports unknown commands', () => {
    expect(executeCommand(router(), 'frobnicate').lines[0]).toMatch(/Unknown command/);
    expect(executeCommand(router(), 'show version').lines[0]).toMatch(/Unknown command/);
  });
});

describe('IOS show commands', () => {
  it.each(['show ip interface brief', 'sh ip int br', 'sh ip int'])('%s lists interfaces', (cmd) => {
    const { r1 } = twoRouterLab();
    const intf = r1.interfaces[2];
    if (intf) intf.adminUp = false;
    const { lines } = executeCommand(r1, cmd);
    expect(lines[1]).toMatch(/^GigabitEthernet0\/0\s+10\.1\.0\.1\s+YES manual up\s+up$/);
    expect(lines[3]).toMatch(/administratively down\s+down$/);
    expect(lines[4]).toMatch(/unassigned\s+YES manual down\s+down$/);
  });

  it.each(['show ip route', 'sh ip ro', 'sh ip r'])('%s lists connected and static routes', (cmd) => {
    const { r1 } = twoRouterLab();
    expect(executeCommand(r1, cmd).lines).toEqual([
      'Codes: L - local, C - connected, S - static\n',
      'C    10.1.0.0/24 is directly connected, GigabitEthernet0/0',
      'C    10.0.12.0/30 is directly connected, GigabitEthernet0/1',
      'S    10.2.0.0/24 [1/0] via 10.0.12.2',
    ]);
    expect(executeCommand(router(), cmd).lines.at(-1)).toMatch(/Routing table is empty/);
  });

  it('shows the running config', () => {
    const { r1 } = twoRouterLab();
    const intf = r1.interfaces[3];
    if (intf) intf.adminUp = false;
    const lines = executeCommand(r1, 'sh run').lines;
    expect(lines).toContain(' ip address 10.1.0.1 255.255.255.0');
    expect(lines).toContain(' shutdown');
    expect(lines).toContain('ip route 10.2.0.0 255.255.255.0 10.0.12.2');
    expect(lines.at(-1)).toBe('end');
  });

  it('shows the MAC table and ARP cache', () => {
    const { sw, r1 } = twoRouterLab();
    expect(executeCommand(sw, 'sh mac').lines.at(-1)).toBe('  (Tabela vazia)');
    sw.macTable.push({ mac: 'AA:AA:AA:AA:AA:AA', port: 'FastEthernet0/1' });
    expect(executeCommand(sw, 'show mac address-table').lines.at(-1)).toContain('AA:AA:AA:AA:AA:AA    DYNAMIC     FastEthernet0/1');
    expect(executeCommand(r1, 'show arp').lines).toEqual(['Tabela ARP vazia.']);
  });
});

describe('prompts and completion', () => {
  it('syncs prompts for every device family', () => {
    const t = emptyTopology();
    const cloud = device(t, 'cloud', 'Net');
    const pc = device(t, 'laptop', 'Lap');
    syncPrompt(cloud);
    syncPrompt(pc);
    expect(cloud.prompt).toBe('wan-cloud> ');
    expect(pc.prompt).toBe('user@lap:~$ ');
  });

  it('completes known commands', () => {
    expect(complete('conf')).toBe('configure terminal');
    expect(complete('SHOW IP R')).toBe('show ip route');
    expect(complete('')).toBeNull();
    expect(complete('zzz')).toBeNull();
  });
});
