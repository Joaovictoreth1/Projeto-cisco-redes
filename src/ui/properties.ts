import { syncPrompt } from '../core/cli';
import { DEFAULT_MASK } from '../core/devices';
import { isValidIP, isValidMask } from '../core/ip';
import { isHost, type Device, type NetInterface } from '../core/types';
import { renderCli } from './cli-panel';
import { byId, clear, h } from './dom';
import { drawLinks, requestDhcpFor, updateDeviceDOM } from './engine';
import { catalogIcon } from './icons';
import { recordHistory } from './persistence';
import { state } from './state';
import { toast } from './toast';

type Tab = 'config' | 'cli' | 'services' | 'ports';
const TABS: readonly Tab[] = ['config', 'cli', 'services', 'ports'];
export const isTab = (v: string): v is Tab => (TABS as readonly string[]).includes(v);

const input = (id: string): HTMLInputElement => byId(id, HTMLInputElement);
const hasInterfaceSelector = (dev: Device): boolean => dev.typeStr === 'router' || dev.typeStr === 'cloud';

function selectedInterface(dev: Device): NetInterface | undefined {
  if (isHost(dev)) return dev.interfaces[0];
  if (!hasInterfaceSelector(dev)) return undefined;
  return dev.interfaces[Number(byId('prop-interface-sel', HTMLSelectElement).value)];
}

export function openProperties(dev: Device): void {
  state.activeDevice = dev;
  byId('prop-header-title').textContent = dev.name;
  byId('prop-header-mac').textContent = dev.interfaces[0]?.mac ?? '';
  const iconBox = byId('prop-small-icon');
  clear(iconBox);
  iconBox.append(catalogIcon(dev.typeStr));
  input('prop-name').value = dev.name;

  const gw = byId('prop-gateway-container');
  const intf = byId('prop-interface-container');
  const ipMask = byId('prop-ip-mask-container');
  const routes = byId('prop-static-routes-container');
  gw.classList.toggle('hidden', !isHost(dev));
  intf.classList.toggle('hidden', !hasInterfaceSelector(dev));
  routes.classList.toggle('hidden', dev.typeStr !== 'router');
  ipMask.classList.toggle('hidden', dev.typeStr === 'switch');

  if (isHost(dev)) {
    const eth = dev.interfaces[0];
    input('prop-gateway').value = dev.gateway;
    input('prop-ip').value = eth?.ip ?? '';
    input('prop-mask').value = (eth?.mask ?? '') || DEFAULT_MASK;
    input('prop-port-admin').checked = eth?.adminUp ?? true;
  } else if (hasInterfaceSelector(dev)) {
    const sel = byId('prop-interface-sel', HTMLSelectElement);
    const previous = sel.value;
    clear(sel);
    dev.interfaces.forEach((i, idx) => {
      const opt = h('option', { className: 'bg-slate-900', text: `${i.name} ${i.connectedTo ? '● UP' : '○ DOWN'}` });
      opt.value = String(idx);
      sel.append(opt);
    });
    if (previous && Number(previous) < dev.interfaces.length) sel.value = previous;
    loadInterface();
    renderStaticRoutes();
  }
  renderServicesTab();
  renderPortsSummary();
  renderCli();
  byId('properties-panel').classList.remove('translate-x-full');
}

export function closeProperties(): void {
  byId('properties-panel').classList.add('translate-x-full');
  state.activeDevice = null;
}

export function switchTab(tab: Tab): void {
  for (const t of TABS) {
    const panel = byId(`tab-${t}`);
    const btn = byId(`tab-btn-${t}`);
    const active = t === tab;
    panel.classList.toggle('hidden', !active);
    if (t === 'cli') panel.classList.toggle('flex', active);
    btn.classList.toggle('border-sky-500', active);
    btn.classList.toggle('text-sky-400', active);
    btn.classList.toggle('border-transparent', !active);
    btn.classList.toggle('text-slate-400', !active);
    btn.setAttribute('aria-selected', String(active));
  }
  if (tab === 'cli') {
    setTimeout(() => {
      byId('cli-input').focus();
      const out = byId('cli-output');
      out.scrollTop = out.scrollHeight;
    }, 50);
  } else if (tab === 'ports') renderPortsSummary();
  else if (tab === 'services') renderServicesTab();
}

export function loadInterface(): void {
  const dev = state.activeDevice;
  if (!dev || !hasInterfaceSelector(dev)) return;
  const intf = selectedInterface(dev);
  if (!intf) return;
  input('prop-ip').value = intf.ip;
  input('prop-mask').value = intf.mask || DEFAULT_MASK;
  byId('prop-header-mac').textContent = intf.mac;
  input('prop-port-admin').checked = intf.adminUp;
  const badge = byId('prop-intf-status-badge');
  const up = Boolean(intf.connectedTo) && intf.adminUp;
  badge.textContent = up ? 'LINK UP' : 'DOWN';
  badge.className = up
    ? 'text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20'
    : 'text-[9px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20';
}

export type EditableProp = 'name' | 'gateway' | 'ip' | 'mask' | 'adminUp';
export const isEditableProp = (v: string): v is EditableProp =>
  ['name', 'gateway', 'ip', 'mask', 'adminUp'].includes(v);

export function updateProperty(prop: EditableProp): void {
  const dev = state.activeDevice;
  if (!dev) return;
  if (prop === 'name') {
    const name = input('prop-name').value.trim().slice(0, 64);
    if (!name) {
      input('prop-name').value = dev.name;
      return;
    }
    dev.name = name;
    syncPrompt(dev);
    byId('prop-header-title').textContent = name;
  } else if (prop === 'gateway') {
    const gw = input('prop-gateway').value.trim();
    if (gw && !isValidIP(gw)) {
      toast('Formato de Gateway inválido!', 'error');
      return;
    }
    dev.gateway = gw;
  } else if (prop === 'ip' || prop === 'mask') {
    const val = input(`prop-${prop}`).value.trim();
    const valid = prop === 'ip' ? isValidIP(val) : isValidMask(val);
    if (val && !valid) {
      toast(`Endereço ${prop.toUpperCase()} inválido!`, 'error');
      return;
    }
    const intf = selectedInterface(dev);
    if (!intf) return;
    intf[prop] = val;
    drawLinks();
  } else {
    const intf = selectedInterface(dev);
    if (!intf) return;
    intf.adminUp = input('prop-port-admin').checked;
    loadInterface();
    drawLinks();
  }
  updateDeviceDOM(dev);
  renderPortsSummary();
  renderCli();
  recordHistory();
}

export async function requestDhcpForActive(): Promise<void> {
  const dev = state.activeDevice;
  if (!dev) return;
  await requestDhcpFor(dev);
  if (state.activeDevice?.id === dev.id) openProperties(dev);
}

const emptyNote = (text: string): HTMLElement => h('div', { className: 'text-slate-500 italic text-[10px]', text });
const rowClass =
  'flex items-center justify-between bg-black/50 px-2.5 py-1.5 rounded-lg border border-white/5 text-slate-300';

export function renderServicesTab(): void {
  const dev = state.activeDevice;
  if (!dev) return;
  const hasDhcp = dev.typeStr === 'router' || dev.typeStr === 'server';
  byId('service-dhcp-box').classList.toggle('hidden', !hasDhcp);
  byId('service-mac-box').classList.toggle('hidden', dev.typeStr !== 'switch');
  byId('service-none-box').classList.toggle('hidden', hasDhcp || dev.typeStr === 'switch');
  if (hasDhcp) {
    input('dhcp-enabled').checked = dev.dhcpServer.enabled;
    input('dhcp-start').value = dev.dhcpServer.startIp;
    input('dhcp-mask').value = dev.dhcpServer.mask || DEFAULT_MASK;
    input('dhcp-gw').value = dev.dhcpServer.gateway;
    byId('dhcp-leases-count').textContent = `Concessões ativas no pool: ${Object.keys(dev.dhcpServer.leases).length}`;
  } else if (dev.typeStr === 'switch') {
    const list = byId('mac-table-list');
    clear(list);
    if (dev.macTable.length === 0) list.append(emptyNote('Tabela CAM vazia. Envie tráfego para aprender MACs.'));
    for (const entry of dev.macTable) {
      list.append(
        h('div', { className: rowClass }, [
          h('span', { className: 'text-emerald-400', text: entry.mac }),
          h('span', { className: 'text-slate-400', text: entry.port }),
        ]),
      );
    }
  }
}

export function saveDhcpConfig(): void {
  const dev = state.activeDevice;
  if (!dev) return;
  const enabled = input('dhcp-enabled').checked;
  const startIp = input('dhcp-start').value.trim();
  const mask = input('dhcp-mask').value.trim();
  const gateway = input('dhcp-gw').value.trim();
  if (enabled && (!isValidIP(startIp) || !isValidMask(mask) || (gateway !== '' && !isValidIP(gateway)))) {
    input('dhcp-enabled').checked = false;
    toast('Configure um IP Inicial, Máscara e Gateway válidos antes de ativar o DHCP.', 'warning');
    return;
  }
  const wasEnabled = dev.dhcpServer.enabled;
  dev.dhcpServer = { ...dev.dhcpServer, enabled, startIp, mask, gateway };
  updateDeviceDOM(dev);
  recordHistory();
  if (wasEnabled !== enabled) toast(enabled ? 'Servidor DHCP ativado!' : 'Servidor DHCP desativado.', 'info', 1800);
}

export function clearMacTable(): void {
  const dev = state.activeDevice;
  if (!dev) return;
  dev.macTable = [];
  renderServicesTab();
  recordHistory();
  toast('Tabela MAC limpa.', 'info', 1400);
}

export function addStaticRoute(): void {
  const dev = state.activeDevice;
  if (dev?.typeStr !== 'router') return;
  const dest = input('route-dest').value.trim();
  const mask = input('route-mask').value.trim();
  const nextHop = input('route-nh').value.trim();
  if (!isValidIP(dest) || !isValidMask(mask) || !isValidIP(nextHop)) {
    toast('Preencha Rede, Máscara e Next-Hop válidos.', 'error');
    return;
  }
  if (dev.staticRoutes.some((r) => r.dest === dest && r.mask === mask && r.nextHop === nextHop)) {
    toast('Essa rota estática já existe.', 'warning');
    return;
  }
  dev.staticRoutes.push({ dest, mask, nextHop });
  input('route-dest').value = '';
  input('route-nh').value = '';
  renderStaticRoutes();
  recordHistory();
  toast('Rota estática adicionada.', 'success');
}

function removeStaticRoute(idx: number): void {
  const dev = state.activeDevice;
  if (!dev) return;
  dev.staticRoutes.splice(idx, 1);
  renderStaticRoutes();
  recordHistory();
}

export function renderStaticRoutes(): void {
  const dev = state.activeDevice;
  const list = document.getElementById('static-routes-list');
  if (!dev || !list) return;
  clear(list);
  if (dev.staticRoutes.length === 0) list.append(emptyNote('Nenhuma rota estática configurada.'));
  dev.staticRoutes.forEach((r, idx) => {
    const remove = h(
      'button',
      {
        className: 'text-rose-400 hover:text-rose-300',
        attrs: { type: 'button', 'aria-label': `Remover rota ${r.dest}` },
      },
      [h('i', { className: 'ph ph-trash', attrs: { 'aria-hidden': 'true' } })],
    );
    remove.addEventListener('click', () => {
      removeStaticRoute(idx);
    });
    list.append(
      h('div', { className: rowClass }, [h('span', { text: `S ${r.dest} [${r.mask}] via ${r.nextHop}` }), remove]),
    );
  });
}

export function renderPortsSummary(): void {
  const dev = state.activeDevice;
  if (!dev) return;
  const list = byId('ports-summary-list');
  clear(list);
  for (const intf of dev.interfaces) {
    const up = Boolean(intf.connectedTo) && intf.adminUp;
    let peer = 'Desconectado';
    const link = intf.connectedTo ? state.topology.links.find((l) => l.id === intf.connectedTo) : undefined;
    if (link) {
      const peerId = link.sourceId === dev.id ? link.targetId : link.sourceId;
      const peerDev = state.topology.devices.find((d) => d.id === peerId);
      if (peerDev) peer = `Conectado a ${peerDev.name}`;
    }
    list.append(
      h('div', { className: 'bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between' }, [
        h('div', {}, [
          h('div', { className: 'text-xs font-mono font-bold text-slate-200 flex items-center gap-2' }, [
            h('span', {
              className: `w-2 h-2 rounded-full ${up ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`,
            }),
            intf.name,
          ]),
          h('div', { className: 'text-[10px] text-slate-400 mt-0.5', text: peer }),
        ]),
        h('div', { className: 'text-right font-mono' }, [
          h('div', { className: 'text-xs text-sky-400', text: intf.ip || 'L2 / Sem IP' }),
          h('div', { className: 'text-[9px] text-slate-500', text: intf.mac }),
        ]),
      ]),
    );
  }
}
