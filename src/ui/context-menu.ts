import { isHost, isLayer3, type Device } from '../core/types';
import { byId, clear, h, svgById } from './dom';
import { deleteDevice, gravityCurve, requestDhcpFor } from './engine';
import { openProperties, switchTab } from './properties';
import { state } from './state';
import { setTool, showPortPicker } from './tools';

const MENU_W = 215;
const MENU_H = 230;

function bind(id: string, handler: () => void): void {
  byId(id).onclick = () => {
    hideContextMenu();
    handler();
  };
}

export function showContextMenu(x: number, y: number, dev: Device): void {
  state.contextMenuTarget = dev;
  const header = byId('ctx-header');
  clear(header);
  header.append(
    h('span', { text: dev.name }),
    h('span', { className: 'text-[9px] text-sky-400 font-mono', text: dev.typeStr.toUpperCase() }),
  );
  const safeX = Math.min(x, window.innerWidth - MENU_W);
  const safeY = Math.min(y, window.innerHeight - MENU_H);
  const menu = byId('context-menu');
  menu.style.left = `${safeX}px`;
  menu.style.top = `${safeY}px`;
  menu.classList.remove('hidden');

  bind('ctx-btn-config', () => {
    openProperties(dev);
    switchTab('config');
  });
  bind('ctx-btn-cli', () => {
    openProperties(dev);
    switchTab('cli');
  });
  bind('ctx-btn-cable', () => {
    setTool('cable', 'auto');
    showPortPicker(safeX, safeY, dev, (portIdx) => {
      state.cableSourceDevice = dev;
      state.cableSourcePortIdx = portIdx;
      document.getElementById(dev.id)?.classList.add('cable-src');
      svgById('drawing-cable').classList.remove('hidden');
      svgById('drawing-line').setAttribute('d', gravityCurve(dev.x, dev.y, dev.x, dev.y));
    });
  });
  const ping = byId('ctx-btn-ping');
  ping.style.display = isLayer3(dev) ? 'flex' : 'none';
  bind('ctx-btn-ping', () => {
    setTool('ping');
    state.pingSourceDevice = dev;
    document.getElementById(dev.id)?.classList.add('ping-src');
  });
  const dhcp = byId('ctx-btn-dhcp');
  dhcp.style.display = isHost(dev) ? 'flex' : 'none';
  bind('ctx-btn-dhcp', () => void requestDhcpFor(dev));
  bind('ctx-btn-delete', () => {
    deleteDevice(dev);
  });
}

export function hideContextMenu(): void {
  byId('context-menu').classList.add('hidden');
  state.contextMenuTarget = null;
}
