import { getNetworkStr, isValidIP, isValidMask } from './ip';
import { isIosDevice, type Device, type NetInterface } from './types';

export type CliAction = { kind: 'ping' | 'traceroute'; target: string } | { kind: 'dhcp' };

export interface CliResult {
  lines: string[];
  clear?: boolean;
  action?: CliAction;
  /** Device configuration changed and should be re-rendered and recorded in history. */
  mutated?: boolean;
}

export const CLI_COMPLETIONS: readonly string[] = [
  'ping',
  'traceroute',
  'ipconfig',
  'ifconfig',
  'ipconfig /renew',
  'arp -a',
  'clear',
  'help',
  'enable',
  'disable',
  'configure terminal',
  'exit',
  'end',
  'hostname',
  'interface',
  'ip address',
  'no shutdown',
  'shutdown',
  'ip route',
  'show ip route',
  'show ip interface brief',
  'show running-config',
  'show mac address-table',
  'show arp',
];

export const HOSTNAME_RE = /^[A-Za-z][A-Za-z0-9_-]{0,62}$/;

const INVALID = "% Invalid input detected at '^' marker.";

const HOST_HELP = [
  'Comandos disponíveis:',
  '  ping <ip>         - Testa conectividade ICMP',
  '  traceroute <ip>   - Rastreia saltos até o destino',
  '  ipconfig          - Exibe configuração de interface',
  '  ipconfig /renew   - Solicita IP via DHCP',
  '  arp -a            - Exibe tabela ARP local',
  '  clear             - Limpa o terminal',
].join('\n');

const IOS_HELP = [
  'Comandos IOS suportados:',
  '  enable / disable',
  '  configure terminal (conf t)',
  '  hostname <nome>',
  '  interface <g0/0 | fa0/1 | ...>',
  '  ip address <ip> <mascara>',
  '  no shutdown / shutdown',
  '  ip route <rede> <mascara> <next-hop>',
  '  ping <ip> / traceroute <ip>',
  '  show ip interface brief (sh ip int br)',
  '  show ip route (sh ip ro)',
  '  show mac address-table (sh mac)',
  '  show arp',
  '  show running-config (sh run)',
  '  exit / end',
].join('\n');

/** Tab completion: the first known command that starts with the typed text. */
export function complete(input: string): string | null {
  const val = input.toLowerCase();
  if (!val) return null;
  return CLI_COMPLETIONS.find((c) => c.startsWith(val)) ?? null;
}

export function syncPrompt(dev: Device): void {
  if (isIosDevice(dev)) {
    const suffix = { user: '>', priv: '#', config: '(config)#', if: '(config-if)#' }[dev.cliMode];
    dev.prompt = `${dev.name}${suffix}`;
  } else if (dev.typeStr === 'cloud') {
    dev.prompt = 'wan-cloud> ';
  } else {
    dev.prompt = `user@${dev.name.toLowerCase()}:~$ `;
  }
}

/** IOS-style abbreviation: every typed token must be a prefix of the keyword at its position. */
function abbrev(tokens: readonly string[], words: readonly string[], required = words.length): boolean {
  if (tokens.length < required || tokens.length > words.length) return false;
  return tokens.every((t, i) => {
    const word = words[i];
    return word !== undefined && t.length > 0 && word.startsWith(t);
  });
}

const INTERFACE_TYPES = ['gigabitethernet', 'fastethernet', 'ethernet', 'eth', 'wan'];

/** Resolves `g0/1`, `gi0/1`, `Gig 0/1`, `fa0/3`, `f0/3`, `GigabitEthernet0/1`, `eth0`, `wan1`. */
export function resolveInterface(interfaces: readonly NetInterface[], spec: string): number {
  const compact = spec.toLowerCase().replace(/\s+/g, '');
  const match = /^([a-z]+)(\d+(?:\/\d+)*)$/.exec(compact);
  if (!match) return -1;
  const [, prefix = '', number = ''] = match;
  return interfaces.findIndex((intf) => {
    const parsed = /^([a-z]+)(\d+(?:\/\d+)*)$/.exec(intf.name.toLowerCase());
    if (!parsed) return false;
    const [, type = '', num = ''] = parsed;
    return num === number && INTERFACE_TYPES.includes(type) && type.startsWith(prefix);
  });
}

function hostCommand(dev: Device, tokens: string[], raw: string[]): CliResult {
  const [base = ''] = tokens;
  const full = tokens.join(' ');
  if (base === 'help' || base === '?') return { lines: [HOST_HELP] };
  if (base === 'ping' || base === 'traceroute' || base === 'tracert') {
    const target = raw[1];
    const kind = base === 'ping' ? 'ping' : 'traceroute';
    if (!target) return { lines: [`Uso: ${kind} <endereco_ip>`] };
    return { lines: [], action: { kind, target } };
  }
  if (full === 'ipconfig /renew' || base === 'dhclient') return { lines: [], action: { kind: 'dhcp' } };
  if (base === 'ipconfig' || base === 'ifconfig' || base === 'ip') {
    return {
      lines: dev.interfaces.map(
        (i) =>
          `\n${i.name}: flags=4163<${i.adminUp ? 'UP,' : ''}BROADCAST,RUNNING>  mtu 1500\n` +
          `        inet ${i.ip || '0.0.0.0'}  netmask ${i.mask || '0.0.0.0'}\n` +
          `        ether ${i.mac}  txqueuelen 1000\n` +
          `        Default Gateway: ${dev.gateway || '0.0.0.0'}\n`,
      ),
    };
  }
  if (base === 'arp') return { lines: arpLines(dev) };
  return { lines: [`bash: ${raw[0] ?? base}: comando não encontrado. Digite 'help'.`] };
}

function arpLines(dev: Device): string[] {
  const entries = Object.entries(dev.arpTable);
  if (entries.length === 0) return ['Tabela ARP vazia.'];
  return [
    'Internet Address      Physical Address      Type',
    ...entries.map(([ip, mac]) => `${ip.padEnd(21)} ${mac.padEnd(21)} dynamic`),
  ];
}

function showCommand(dev: Device, tokens: string[]): CliResult | null {
  const rest = tokens.slice(1);
  if (abbrev(rest, ['mac', 'address-table'], 1)) {
    const header =
      '          Mac Address Table\n-------------------------------------------\n' +
      'Vlan    Mac Address       Type        Ports\n----    -----------       --------    -----';
    if (dev.macTable.length === 0) return { lines: [header, '  (Tabela vazia)'] };
    return { lines: [header, ...dev.macTable.map((m) => `   1    ${m.mac}    DYNAMIC     ${m.port}`)] };
  }
  if (abbrev(rest, ['ip', 'route'], 2)) {
    const lines = ['Codes: L - local, C - connected, S - static\n'];
    for (const i of dev.interfaces) {
      if (i.ip && i.mask && i.connectedTo && i.adminUp) {
        lines.push(`C    ${getNetworkStr(i.ip, i.mask)} is directly connected, ${i.name}`);
      }
    }
    for (const r of dev.staticRoutes) lines.push(`S    ${getNetworkStr(r.dest, r.mask)} [1/0] via ${r.nextHop}`);
    if (lines.length === 1) lines.push('Gateway of last resort is not set. Routing table is empty.');
    return { lines };
  }
  if (abbrev(rest, ['ip', 'interface', 'brief'], 2)) {
    const lines = ['Interface                  IP-Address      OK? Method Status                Protocol'];
    for (const i of dev.interfaces) {
      const status = !i.adminUp ? 'administratively down' : i.connectedTo ? 'up' : 'down';
      const proto = i.connectedTo && i.adminUp ? 'up' : 'down';
      lines.push(`${i.name.padEnd(26)} ${(i.ip || 'unassigned').padEnd(15)} YES manual ${status.padEnd(21)} ${proto}`);
    }
    return { lines };
  }
  if (abbrev(rest, ['running-config'], 1)) {
    const lines = [`!\nhostname ${dev.name}\n!`];
    for (const i of dev.interfaces) {
      lines.push(`interface ${i.name}`);
      if (i.ip) lines.push(` ip address ${i.ip} ${i.mask}`);
      lines.push(i.adminUp ? ' no shutdown' : ' shutdown', '!');
    }
    for (const r of dev.staticRoutes) lines.push(`ip route ${r.dest} ${r.mask} ${r.nextHop}`);
    lines.push('end');
    return { lines };
  }
  if (abbrev(rest, ['arp'], 1)) return { lines: arpLines(dev) };
  return null;
}

function iosCommand(dev: Device, tokens: string[], raw: string[]): CliResult {
  const [base = ''] = tokens;
  const mode = dev.cliMode;
  const setMode = (next: Device['cliMode']): CliResult => {
    dev.cliMode = next;
    syncPrompt(dev);
    return { lines: [] };
  };

  if (base === 'help' || base === '?') return { lines: [IOS_HELP] };
  if (abbrev(tokens, ['enable'])) return setMode(mode === 'user' ? 'priv' : mode);
  if (abbrev(tokens, ['disable'])) return setMode('user');
  if (abbrev(tokens, ['configure', 'terminal'], 1)) {
    return mode === 'priv' ? setMode('config') : { lines: [INVALID] };
  }
  if (base === 'end') return setMode(mode === 'user' ? 'user' : 'priv');
  if (base === 'exit') return setMode({ if: 'config', config: 'priv', priv: 'user', user: 'user' }[mode] as Device['cliMode']);
  if (tokens[0] === 'show' || abbrev(tokens.slice(0, 1), ['show'])) {
    return showCommand(dev, tokens) ?? { lines: ["% Unknown command or incomplete syntax. Digite 'help'."] };
  }
  if ((base === 'ping' || abbrev(tokens.slice(0, 1), ['traceroute'])) && dev.typeStr === 'router') {
    const target = raw[1];
    if (!target) return { lines: ['% Incomplete command.'] };
    return { lines: [], action: { kind: base === 'ping' ? 'ping' : 'traceroute', target } };
  }
  if (abbrev(tokens.slice(0, 1), ['hostname'], 1) && base.length >= 3) {
    if (mode !== 'config') return { lines: [INVALID] };
    const name = raw[1];
    if (!name) return { lines: ['% Incomplete command.'] };
    if (!HOSTNAME_RE.test(name)) return { lines: ['% Invalid hostname'] };
    dev.name = name;
    syncPrompt(dev);
    return { lines: [], mutated: true };
  }
  if (abbrev(tokens.slice(0, 1), ['interface']) && base.length >= 3) {
    if (mode !== 'config' && mode !== 'if') return { lines: [INVALID] };
    const spec = raw.slice(1).join('');
    if (!spec) return { lines: ['% Incomplete command.'] };
    const idx = resolveInterface(dev.interfaces, spec);
    if (idx === -1) return { lines: ['% Invalid interface type and number'] };
    dev.selectedIfIndex = idx;
    return setMode('if');
  }
  const intf = dev.interfaces[dev.selectedIfIndex];
  if (abbrev(tokens.slice(0, 2), ['ip', 'address'], 2)) {
    if (mode !== 'if' || !intf || dev.typeStr !== 'router') return { lines: [INVALID] };
    const [, , ip, mask] = raw;
    if (!isValidIP(ip) || !isValidMask(mask)) return { lines: ['% Invalid IP address or subnet mask'] };
    intf.ip = ip;
    intf.mask = mask;
    return { lines: [], mutated: true };
  }
  if (abbrev(tokens, ['no', 'shutdown'], 2) || abbrev(tokens, ['shutdown'])) {
    if (mode !== 'if' || !intf) return { lines: [INVALID] };
    const up = tokens[0] === 'no';
    intf.adminUp = up;
    return {
      lines: [
        up
          ? `%LINK-3-UPDOWN: Interface ${intf.name}, changed state to up`
          : `%LINK-5-CHANGED: Interface ${intf.name}, changed state to administratively down`,
      ],
      mutated: true,
    };
  }
  if (abbrev(tokens.slice(0, 2), ['ip', 'route'], 2)) {
    if (mode !== 'config' || dev.typeStr !== 'router') return { lines: [INVALID] };
    const [, , dest, mask, nextHop] = raw;
    if (!isValidIP(dest) || !isValidMask(mask) || !isValidIP(nextHop)) return { lines: ['% Inconsistent address and mask'] };
    if (!dev.staticRoutes.some((r) => r.dest === dest && r.mask === mask && r.nextHop === nextHop)) {
      dev.staticRoutes.push({ dest, mask, nextHop });
    }
    return { lines: [], mutated: true };
  }
  return { lines: ["% Unknown command or incomplete syntax. Digite 'help'."] };
}

export function executeCommand(dev: Device, input: string): CliResult {
  const raw = input.trim().split(/\s+/).filter(Boolean);
  if (raw.length === 0) return { lines: [] };
  const tokens = raw.map((t) => t.toLowerCase());
  if (tokens[0] === 'clear' || tokens[0] === 'cls') return { lines: [], clear: true };
  return isIosDevice(dev) ? iosCommand(dev, tokens, raw) : hostCommand(dev, tokens, raw);
}
