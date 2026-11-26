import { findDeviceByActiveIp, requestDhcp, traceRoute } from '../core/network';
import { addLink, removeDevice, removeLink } from '../core/topology';
import { isLayer3, type CableType, type Device, type Link, type Zone } from '../core/types';
import { printTo } from './cli-panel';
import { closeProperties, renderPortsSummary } from './properties';
import { removeZone } from './zones';
import { byId, h, svg, svgById } from './dom';
import { catalogIcon } from './icons';
import { logPdu } from './logger';
import { recordHistory } from './persistence';
import { openProperties, switchTab } from './properties';
import { simDelay } from './sim-speed';
import { playSound } from './sound';
import { state } from './state';
import { toast } from './toast';
import { hidePortPicker, setTool, showPortPicker, updateStatus } from './tools';
import { hideContextMenu, showContextMenu } from './context-menu';
import { screenToCanvas } from './viewport';

const primaryIp = (dev: Device): string => dev.interfaces.find((i) => i.ip)?.ip ?? '';

const dhcpBadge = (): HTMLElement =>
  h('span', { className: 'dhcp-badge', text: 'DHCP', attrs: { title: 'Servidor DHCP Ativo' } });

export function renderZone(zone: Zone): void {
  const title = h('div', { className: 'net-zone-title', text: zone.title });
  const el = h(
    'div',
    {
      className: 'net-zone',
      attrs: { id: zone.id },
      style: { left: `${zone.x}px`, top: `${zone.y}px`, width: `${zone.w}px`, height: `${zone.h}px` },
    },
    [title],
  );
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (state.selectedTool === 'delete') {
      removeZone(zone.id);
      el.remove();
      recordHistory();
      toast('Zona removida.', 'info', 1400);
    } else if (state.selectedTool === 'pointer') {
      const pos = screenToCanvas(e.clientX, e.clientY);
      state.draggingZone = zone;
      state.dragMoved = false;
      state.dragStart = { x: e.clientX, y: e.clientY };
      state.dragOffset = { x: pos.x - zone.x, y: pos.y - zone.y };
    }
  });
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const next = window.prompt('Nome / Sub-rede da Zona:', zone.title)?.trim().slice(0, 120);
    if (next) {
      zone.title = next;
      title.textContent = next;
      recordHistory();
    }
  });
  byId('zones-layer').append(el);
}

function onDeviceClick(dev: Device, el: HTMLElement, e: MouseEvent): void {
  e.stopPropagation();
  hideContextMenu();
  hidePortPicker();
  playSound('click');
  if (state.selectedTool === 'pointer') {
    if (state.dragMoved) return;
    selectDevice(dev);
  } else if (state.selectedTool === 'delete') {
    deleteDevice(dev);
  } else if (state.selectedTool === 'cable') {
    const source = state.cableSourceDevice;
    if (!source) {
      showPortPicker(e.clientX, e.clientY, dev, (portIdx) => {
        state.cableSourceDevice = dev;
        state.cableSourcePortIdx = portIdx;
        el.classList.add('cable-src');
        svgById('drawing-cable').classList.remove('hidden');
        svgById('drawing-line').setAttribute('d', gravityCurve(dev.x, dev.y, dev.x, dev.y));
        updateStatus(
          `${dev.name} [${dev.interfaces[portIdx]?.name ?? ''}] -> Escolha destino`,
          'bg-amber-500 animate-pulse',
        );
      });
    } else if (source.id !== dev.id) {
      showPortPicker(e.clientX, e.clientY, dev, (targetPort) => {
        createLink(source, dev, state.selectedCableType, state.cableSourcePortIdx, targetPort);
        setTool('pointer');
      });
    }
  } else if (state.selectedTool === 'ping') {
    const source = state.pingSourceDevice;
    if (!source) {
      if (isLayer3(dev)) {
        state.pingSourceDevice = dev;
        el.classList.add('ping-src');
        updateStatus(`Origem: ${dev.name} -> Clique no destino`, 'bg-purple-500 animate-pulse');
      } else {
        toast('O Ping deve iniciar em um dispositivo Camada 3 (PC, Server, Router).', 'warning');
        setTool('pointer');
      }
      return;
    }
    if (source.id !== dev.id && isLayer3(dev)) {
      const target = primaryIp(dev);
      if (!target) {
        logPdu(source.name, dev.name, 'ICMP', 'No IP');
        toast(`${dev.name} não possui endereço IP configurado.`, 'warning');
      } else {
        openProperties(source);
        switchTab('cli');
        void runPing(source, target);
      }
    }
    setTool('pointer');
  }
}

export function selectDevice(dev: Device): void {
  for (const d of state.topology.devices) document.getElementById(d.id)?.classList.remove('selected');
  document.getElementById(dev.id)?.classList.add('selected');
  openProperties(dev);
}

export function renderDevice(dev: Device): void {
  const ip = primaryIp(dev);
  const el = h(
    'div',
    {
      className: 'device animate-pop-in',
      attrs: { id: dev.id, role: 'button', tabindex: '0', 'aria-label': dev.name },
      style: { left: `${dev.x}px`, top: `${dev.y}px` },
    },
    [
      h('div', { className: 'device-icon-wrapper' }, [catalogIcon(dev.typeStr), dev.dhcpServer.enabled && dhcpBadge()]),
      h('div', { className: 'device-label', text: dev.name }),
      isLayer3(dev) && ip !== '' && h('div', { className: 'device-ip-label', text: ip }),
    ],
  );
  const startDrag = (x: number, y: number): void => {
    if (state.selectedTool !== 'pointer') return;
    state.draggingDevice = dev;
    state.dragMoved = false;
    state.dragStart = { x, y };
  };
  el.addEventListener('mousedown', (e) => {
    if (e.button === 0) startDrag(e.clientX, e.clientY);
  });
  el.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (e.touches.length === 1 && t) startDrag(t.clientX, t.clientY);
    },
    { passive: true },
  );
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, dev);
  });
  el.addEventListener('click', (e) => {
    onDeviceClick(dev, el, e);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectDevice(dev);
    }
  });
  byId('devices-layer').append(el);
  setTimeout(() => {
    el.classList.remove('animate-pop-in');
  }, 220);
}

export function updateDeviceDOM(dev: Device): void {
  const el = document.getElementById(dev.id);
  if (!el) return;
  el.setAttribute('aria-label', dev.name);
  const label = el.querySelector('.device-label');
  if (label) label.textContent = dev.name;
  const wrapper = el.querySelector('.device-icon-wrapper');
  const badge = wrapper?.querySelector('.dhcp-badge');
  if (dev.dhcpServer.enabled && !badge) wrapper?.append(dhcpBadge());
  else if (!dev.dhcpServer.enabled) badge?.remove();
  const ip = isLayer3(dev) ? primaryIp(dev) : '';
  const ipLabel = el.querySelector('.device-ip-label');
  if (ip && ipLabel) ipLabel.textContent = ip;
  else if (ip) el.append(h('div', { className: 'device-ip-label', text: ip }));
  else ipLabel?.remove();
}

export function gravityCurve(x1: number, y1: number, x2: number, y2: number): string {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const sag = Math.min(distance * 0.16, 70);
  return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.max(y1, y2) + sag + 14} ${x2} ${y2}`;
}

const LINK_ERRORS = {
  'duplicate-link': () => 'Já existe um enlace físico entre esses dispositivos.',
  'same-device': () => 'Não é possível conectar um dispositivo a ele mesmo.',
  'port-busy': (a: Device, b: Device) => `Porta indisponível em ${a.name} ou ${b.name}.`,
} as const;

export function createLink(a: Device, b: Device, type: CableType, portA: number | null, portB: number | null): void {
  const result = addLink(state.topology, a, b, type, portA, portB);
  if (typeof result === 'string') {
    toast(LINK_ERRORS[result](a, b), result === 'duplicate-link' ? 'warning' : 'error');
    return;
  }
  playSound('connect');
  drawLinks();
  recordHistory();
  if (state.activeDevice) renderPortsSummary();
}

const shortPort = (name: string): string => name.replace('GigabitEthernet', 'Gi').replace('FastEthernet', 'Fa');

interface LinkGeometry {
  path: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
}

function geometry(s: Device, t: Device): LinkGeometry {
  return {
    path: gravityCurve(s.x, s.y, t.x, t.y),
    p1: { x: s.x + (t.x - s.x) * 0.16, y: s.y + (t.y - s.y) * 0.16 + 10 },
    p2: { x: t.x + (s.x - t.x) * 0.16, y: t.y + (s.y - t.y) * 0.16 + 10 },
  };
}

function isLinkUp(s: Device, t: Device, link: Link): boolean {
  const si = s.interfaces[link.srcIntf];
  const ti = t.interfaces[link.tgtIntf];
  if (!si || !ti || !si.adminUp || !ti.adminUp) return false;
  return !(s.typeStr === 'router' && !si.ip) && !(t.typeStr === 'router' && !ti.ip);
}

function onLinkClick(link: Link, e: MouseEvent): void {
  e.stopPropagation();
  hideContextMenu();
  if (state.selectedTool !== 'delete') return;
  removeLink(state.topology, link.id);
  playSound('click');
  drawLinks();
  recordHistory();
  toast('Enlace removido.', 'info', 1500);
  if (state.activeDevice) renderPortsSummary();
}

function buildLink(link: Link, s: Device, t: Device): SVGGElement {
  const g = geometry(s, t);
  const group = svg('g', { id: `group_${link.id}`, class: 'link-group', 'data-link': link.id });
  const stateClass = isLinkUp(s, t, link) ? '' : ' down';
  group.append(
    svg('path', { id: `path_${link.id}`, d: g.path, class: `link-line ${link.type}` }),
    svg('path', { d: g.path, class: 'link-hit-area' }),
  );
  for (const [pt, name] of [
    [g.p1, s.interfaces[link.srcIntf]?.name ?? ''],
    [g.p2, t.interfaces[link.tgtIntf]?.name ?? ''],
  ] as const) {
    const label = svg('text', { x: pt.x, y: pt.y - 8, class: 'port-label' });
    label.textContent = shortPort(name);
    group.append(label);
  }
  group.append(
    svg('circle', { cx: g.p1.x, cy: g.p1.y, r: 4, class: `port-light${stateClass}` }),
    svg('circle', { cx: g.p2.x, cy: g.p2.y, r: 4, class: `port-light${stateClass}` }),
  );
  group.addEventListener('click', (e) => {
    onLinkClick(link, e);
  });
  return group;
}

/** Full rebuild; used after structural or status changes. */
export function drawLinks(): void {
  const byIdMap = new Map(state.topology.devices.map((d) => [d.id, d]));
  const groups: SVGGElement[] = [];
  for (const link of state.topology.links) {
    const s = byIdMap.get(link.sourceId);
    const t = byIdMap.get(link.targetId);
    if (s && t) groups.push(buildLink(link, s, t));
  }
  svgById('cables-layer').replaceChildren(...groups);
}

/** Moves only the cables attached to a dragged device instead of rebuilding every link. */
export function updateLinkGeometry(dev: Device): void {
  for (const link of state.topology.links) {
    if (link.sourceId !== dev.id && link.targetId !== dev.id) continue;
    const s = state.topology.devices.find((d) => d.id === link.sourceId);
    const t = state.topology.devices.find((d) => d.id === link.targetId);
    const group = document.getElementById(`group_${link.id}`);
    if (!s || !t || !group) continue;
    const g = geometry(s, t);
    group.querySelectorAll('path').forEach((p) => {
      p.setAttribute('d', g.path);
    });
    const [l1, l2] = group.querySelectorAll('text');
    const [c1, c2] = group.querySelectorAll('circle');
    l1?.setAttribute('x', String(g.p1.x));
    l1?.setAttribute('y', String(g.p1.y - 8));
    l2?.setAttribute('x', String(g.p2.x));
    l2?.setAttribute('y', String(g.p2.y - 8));
    c1?.setAttribute('cx', String(g.p1.x));
    c1?.setAttribute('cy', String(g.p1.y));
    c2?.setAttribute('cx', String(g.p2.x));
    c2?.setAttribute('cy', String(g.p2.y));
  }
}

export function deleteDevice(dev: Device): void {
  if (state.activeDevice?.id === dev.id) closeProperties();
  const el = document.getElementById(dev.id);
  if (el) {
    el.style.transform = 'translate(-50%, -50%) scale(0)';
    setTimeout(() => {
      el.remove();
    }, 200);
  }
  removeDevice(state.topology, dev.id);
  state.cliHistory.delete(dev.id);
  playSound('click');
  drawLinks();
  recordHistory();
  setTool('pointer');
}

export function flashDevice(id: string, color: string): void {
  const wrapper = document.getElementById(id)?.querySelector<HTMLElement>('.device-icon-wrapper');
  if (!wrapper) return;
  wrapper.style.boxShadow = `0 0 32px ${color}, inset 0 0 18px ${color}`;
  wrapper.style.borderColor = color;
  setTimeout(() => {
    wrapper.style.boxShadow = '';
    wrapper.style.borderColor = '';
  }, 450);
}

interface Segment {
  pathEl: SVGPathElement;
  reverse: boolean;
  length: number;
  linkId: string;
}

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function flow(pkt: SVGCircleElement, segs: readonly Segment[], perLink: number): Promise<void> {
  return new Promise((resolve) => {
    if (segs.length === 0) {
      resolve();
      return;
    }
    let idx = 0;
    let start: number | null = null;
    const step = (ts: number): void => {
      start ??= ts;
      let progress = (ts - start) / perLink;
      if (progress > 1) {
        document.getElementById(`group_${segs[idx]?.linkId ?? ''}`)?.classList.remove('active-flow');
        idx += 1;
        if (idx >= segs.length) {
          resolve();
          return;
        }
        start = ts;
        progress = 0;
      }
      const seg = segs[idx];
      if (!seg?.pathEl.isConnected) {
        resolve();
        return;
      }
      document.getElementById(`group_${seg.linkId}`)?.classList.add('active-flow');
      const point = seg.pathEl.getPointAtLength((seg.reverse ? 1 - progress : progress) * seg.length);
      pkt.setAttribute('cx', String(point.x));
      pkt.setAttribute('cy', String(point.y));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export async function animatePacket(nodes: readonly Device[], isError = false, customClass = ''): Promise<void> {
  const first = nodes[0];
  if (!first) return;
  const pkt = svg('circle', {
    r: 6.5,
    class: `svg-packet ${isError ? 'error' : customClass}`,
    cx: first.x,
    cy: first.y,
  });
  svgById('packets-layer').append(pkt);
  try {
    if (nodes.length === 1 || reducedMotion()) {
      await simDelay(350);
      return;
    }
    const segs: Segment[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const link = state.topology.links.find(
        (l) => (l.sourceId === a?.id && l.targetId === b?.id) || (l.sourceId === b?.id && l.targetId === a?.id),
      );
      const pathEl = link ? document.getElementById(`path_${link.id}`) : null;
      if (link && pathEl instanceof SVGPathElement) {
        segs.push({ pathEl, reverse: link.sourceId !== a?.id, length: pathEl.getTotalLength(), linkId: link.id });
      }
    }
    const perLink = await simDelay(0, 320);
    await flow(pkt, segs, perLink);
    if (!isError) {
      if (!customClass) pkt.setAttribute('class', 'svg-packet return');
      await flow(
        pkt,
        segs
          .slice()
          .reverse()
          .map((sg) => ({ ...sg, reverse: !sg.reverse })),
        perLink,
      );
    }
  } finally {
    pkt.remove();
  }
}

export async function runPing(source: Device, targetIp: string): Promise<void> {
  printTo(source, `\nPING ${targetIp} (${targetIp}) 56(84) bytes of data.`);
  const srcIntf = source.interfaces.find((i) => i.ip && i.adminUp);
  if (!srcIntf) {
    printTo(source, 'connect: Network is unreachable (Interface down or unconfigured)');
    logPdu(source.name, targetIp, 'ICMP', 'Failed');
    playSound('ping_err');
    return;
  }
  const result = traceRoute(state.topology, source, targetIp);
  const target = findDeviceByActiveIp(state.topology, targetIp);
  const dstMac = target
    ? (target.interfaces.find((i) => i.ip === targetIp)?.mac ?? '00:00:00:00:00:00')
    : 'FF:FF:FF:FF:FF:FF';
  const ttl = 64 - result.hops.length;
  let received = 0;
  for (let seq = 1; seq <= 4; seq++) {
    await simDelay(340);
    if (result.success) {
      await animatePacket(result.path);
      const time = Math.floor(Math.random() * 12) + result.hops.length * 2;
      printTo(source, `64 bytes from ${targetIp}: icmp_seq=${seq} ttl=${ttl} time=${time} ms`);
      received += 1;
      const last = result.path[result.path.length - 1];
      if (last) flashDevice(last.id, 'rgba(16, 185, 129, 1)');
      if (seq === 1) {
        logPdu(source.name, targetIp, 'ICMP Echo', 'Success', {
          l1: `Meio Físico Verificado (${result.path.length - 1} enlaces ativos)`,
          l2: `Src MAC: ${srcIntf.mac} -> Next-Hop/Dst MAC: ${dstMac} | EtherType: 0x0800`,
          l3: `Src IP: ${srcIntf.ip} -> Dst IP: ${targetIp} | TTL: ${ttl} | Proto: 1 (ICMP)`,
          l4: `ICMP Type 8 (Echo Request) / Type 0 (Echo Reply) — RTT: ${time}ms`,
        });
        playSound('ping_ok');
      }
    } else {
      await animatePacket(result.path.length ? result.path : [source], true);
      printTo(source, `From ${srcIntf.ip} icmp_seq=${seq} ${result.error ?? 'Request timed out.'}`);
      if (seq === 1) {
        logPdu(source.name, targetIp, 'ICMP Drop', 'Dropped', {
          l1: 'Transmissão iniciada na interface física',
          l2: `Src MAC: ${srcIntf.mac} -> ARP Unresolved / Gateway Drop`,
          l3: `Src IP: ${srcIntf.ip} -> Dst IP: ${targetIp} | Falha: ${result.error ?? ''}`,
          l4: 'ICMP Destination Unreachable (Type 3)',
        });
        playSound('ping_err');
      }
    }
  }
  printTo(
    source,
    `\n--- ${targetIp} ping statistics ---\n4 packets transmitted, ${received} received, ${(4 - received) * 25}% packet loss\n`,
  );
  recordHistory();
}

export async function runTraceroute(source: Device, targetIp: string): Promise<void> {
  printTo(source, `\ntraceroute to ${targetIp}, 30 hops max, 60 byte packets`);
  const result = traceRoute(state.topology, source, targetIp);
  if (result.hops.length === 0) {
    printTo(source, ` 1  * * * (${result.error ?? 'unreachable'})`);
    return;
  }
  for (const [idx, hop] of result.hops.entries()) {
    await simDelay(300);
    const hopIp = hop.interfaces.find((i) => i.ip)?.ip ?? hop.name;
    const t1 = Math.floor(Math.random() * 6) + (idx + 1) * 3;
    const t2 = t1 + Math.floor(Math.random() * 3);
    const t3 = t1 + Math.floor(Math.random() * 4);
    printTo(source, ` ${idx + 1}  ${hop.name} (${hopIp})  ${t1} ms  ${t2} ms  ${t3} ms`);
    flashDevice(hop.id, 'rgba(56, 189, 248, 0.9)');
  }
  if (!result.success) printTo(source, ` ${result.hops.length + 1}  * * * (${result.error ?? 'unreachable'})`);
  printTo(source, '');
}

export async function requestDhcpFor(client: Device): Promise<void> {
  const outcome = requestDhcp(state.topology, client);
  if (!outcome.ok && outcome.reason === 'not-host') {
    toast('DHCP client disponível apenas em Hosts finais.', 'warning');
    return;
  }
  printTo(client, '\nDHCPDISCOVER on eth0 to 255.255.255.255 port 67...');
  if (!outcome.ok) {
    const exhausted = outcome.reason === 'pool-exhausted';
    if (outcome.path) await animatePacket(outcome.path, true, 'dhcp');
    printTo(
      client,
      exhausted
        ? `DHCPNAK from ${outcome.server?.name ?? 'server'}: address pool exhausted.\n`
        : 'No DHCPOFFERS received.\n',
    );
    logPdu(client.name, '255.255.255.255', 'DHCP Discover', exhausted ? 'Pool Exhausted' : 'Timeout');
    playSound('ping_err');
    toast(
      exhausted ? 'O pool DHCP não possui endereços livres.' : 'Nenhum servidor DHCP encontrado na rede local.',
      'error',
    );
    return;
  }
  const { server, path, ip, mask, gateway } = outcome;
  await animatePacket(path, false, 'dhcp');
  updateDeviceDOM(client);
  drawLinks();
  recordHistory();
  playSound('ping_ok');
  printTo(client, `DHCPOFFER from ${server.name} (${primaryIp(server) || 'Server'})`);
  printTo(client, `DHCPACK: bound to ${ip} / ${mask} (GW: ${gateway || 'none'})\n`);
  logPdu(server.name, client.name, 'DHCP ACK', 'Success', {
    l1: 'Ethernet 802.3 — Link Ativo',
    l2: `Src MAC: ${server.interfaces[0]?.mac ?? ''} -> Dst MAC: ${client.interfaces[0]?.mac ?? ''}`,
    l3: `IPv4 Offer: ${ip} | Mask: ${mask} | GW: ${gateway}`,
    l4: 'UDP Src Port: 67 (BOOTPS) -> Dst Port: 68 (BOOTPC)',
  });
  toast(`DHCP: ${client.name} recebeu IP ${ip}`, 'success');
}
