import './styles/main.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import { createDevice } from './core/devices';
import type { CableType, DeviceType } from './core/types';
import { CATEGORIES, type CategoryKey } from './ui/catalog';
import { clearCli, handleCliKey } from './ui/cli-panel';
import { hideContextMenu } from './ui/context-menu';
import { byId, svgById } from './ui/dom';
import { drawLinks, gravityCurve, renderDevice, renderZone, updateLinkGeometry } from './ui/engine';
import { clearLogs } from './ui/logger';
import { closeModal, isModalOpen } from './ui/modal';
import {
  clearWorkspace,
  exportJson,
  importFile,
  isPresetKey,
  loadLocal,
  loadPreset,
  recordHistory,
  redo,
  saveLocal,
  undo,
} from './ui/persistence';
import {
  addStaticRoute,
  clearMacTable,
  closeProperties,
  isEditableProp,
  isTab,
  loadInterface,
  requestDhcpForActive,
  saveDhcpConfig,
  switchTab,
  updateProperty,
} from './ui/properties';
import { toggleSpeed } from './ui/sim-speed';
import { playSound, toggleSound } from './ui/sound';
import { state } from './ui/state';
import { hidePortPicker, isTool, selectCategory, setTool } from './ui/tools';
import { applyViewport, resetViewport, screenToCanvas, snap, toggleSnap, zoom } from './ui/viewport';
import { addZone } from './ui/zones';

const CANVAS_MAX = 3900;
const DRAG_THRESHOLD = 4;
const isCategory = (v: string): v is CategoryKey => v in CATEGORIES;
const CABLES: readonly string[] = ['auto', 'straight', 'cross', 'fiber'];

type Handler = (arg: string, arg2: string, el: HTMLElement) => void;

const ACTIONS: Record<string, Handler> = {
  'catalog.select': (arg) => {
    if (isCategory(arg)) selectCategory(arg);
  },
  'cli.clear': () => {
    clearCli();
  },
  'history.undo': () => {
    undo();
  },
  'history.redo': () => {
    redo();
  },
  'import.open': () => {
    byId('import-file-input').click();
  },
  'logger.clear': () => {
    clearLogs();
  },
  'modal.close': () => {
    closeModal();
  },
  'pdu.toggle': () => byId('pdu-panel').classList.toggle('hidden'),
  'pdu.hide': () => {
    byId('pdu-panel').classList.add('hidden');
  },
  'props.addStaticRoute': () => {
    addStaticRoute();
  },
  'props.clearMacTable': () => {
    clearMacTable();
  },
  'props.close': () => {
    closeProperties();
  },
  'props.requestDHCP': () => void requestDhcpForActive(),
  'props.switchTab': (arg) => {
    if (isTab(arg)) switchTab(arg);
  },
  'sim.speed': () => {
    toggleSpeed();
  },
  'sound.toggle': () => {
    toggleSound();
  },
  'tool.set': (arg, arg2) => {
    if (isTool(arg)) setTool(arg, (CABLES.includes(arg2) ? arg2 : 'auto') as CableType);
  },
  'topology.exportJSON': () => {
    exportJson();
  },
  'topology.load': () => {
    loadLocal();
  },
  'topology.save': () => {
    saveLocal();
  },
  'viewport.reset': () => {
    resetViewport();
  },
  'viewport.toggleSnap': () => {
    toggleSnap();
  },
  'viewport.zoom': (arg) => {
    zoom(Number(arg));
  },
  'workspace.clear': () => {
    clearWorkspace();
  },
};

const CHANGES: Record<string, Handler> = {
  'import.file': (_a, _b, el) => el instanceof HTMLInputElement && void importFile(el),
  'preset.load': (_a, _b, el) => {
    if (el instanceof HTMLSelectElement && isPresetKey(el.value)) loadPreset(el.value);
  },
  'props.update': (arg) => {
    if (isEditableProp(arg)) updateProperty(arg);
  },
  'props.loadInterface': () => {
    loadInterface();
  },
  'props.saveDHCPConfig': () => {
    saveDhcpConfig();
  },
};

function dispatch(map: Record<string, Handler>, attr: 'action' | 'change', e: Event): void {
  const el = (e.target as Element | null)?.closest<HTMLElement>(`[data-${attr}]`);
  if (!el) return;
  if (attr === 'action' && el.dataset.action === 'modal.backdrop') {
    if (e.target === el) closeModal();
    return;
  }
  const handler = map[el.dataset[attr] ?? ''];
  handler?.(el.dataset.arg ?? '', el.dataset.arg2 ?? '', el);
}

const isEditable = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  t instanceof HTMLSelectElement ||
  (t instanceof HTMLElement && t.isContentEditable);

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (isModalOpen()) {
      closeModal();
      return;
    }
    setTool('pointer');
    closeProperties();
    hideContextMenu();
    hidePortPicker();
    return;
  }
  if (isEditable(e.target) || isModalOpen()) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && key === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (mod || e.altKey) return;
  if (e.key === 'Delete' || e.key === 'Backspace') setTool('delete');
  else if (key === 'c') setTool('cable');
  else if (key === 'p') setTool('ping');
  else if (key === 'z') setTool('zone');
  else if (e.code === 'Space') {
    e.preventDefault();
    setTool('pan');
  }
}

function placeItem(clientX: number, clientY: number): void {
  const item = state.itemToPlace;
  if (!item || CABLES.includes(item.type)) return;
  const pos = screenToCanvas(clientX, clientY);
  const dev = createDevice(state.topology, item.type as DeviceType, item.name, snap(pos.x), snap(pos.y));
  state.topology.devices.push(dev);
  renderDevice(dev);
  recordHistory();
  playSound('click');
  setTool('pointer');
}

function onWorkspaceClick(e: MouseEvent): void {
  hideContextMenu();
  hidePortPicker();
  const target = e.target as Element;
  if (target.closest('.device, .link-group')) return;
  if (state.selectedTool === 'zone') {
    const pos = screenToCanvas(e.clientX, e.clientY);
    const zone = addZone(pos.x, pos.y);
    if (zone) {
      renderZone(zone);
      recordHistory();
      playSound('click');
    }
    setTool('pointer');
  } else if (state.itemToPlace) {
    placeItem(e.clientX, e.clientY);
  } else if (state.selectedTool === 'pointer') {
    closeProperties();
    for (const d of state.topology.devices) document.getElementById(d.id)?.classList.remove('selected');
  } else if (state.selectedTool === 'cable' && state.cableSourceDevice) {
    setTool('cable', state.selectedCableType);
  } else if (state.selectedTool === 'ping' && state.pingSourceDevice) {
    setTool('ping');
  }
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(v, max));
let frame = 0;
let pending: { x: number; y: number } | null = null;

function applyPointerMove(): void {
  frame = 0;
  if (!pending) return;
  const { x: clientX, y: clientY } = pending;
  pending = null;
  const vp = state.viewport;
  if (vp.isPanning) {
    vp.x = clientX - vp.panStartX;
    vp.y = clientY - vp.panStartY;
    applyViewport();
    return;
  }
  const { x: mx, y: my } = screenToCanvas(clientX, clientY);
  const pastThreshold =
    state.dragMoved || Math.hypot(clientX - state.dragStart.x, clientY - state.dragStart.y) >= DRAG_THRESHOLD;
  if (state.draggingZone && pastThreshold && state.selectedTool === 'pointer') {
    const z = state.draggingZone;
    z.x = clamp(snap(mx - state.dragOffset.x), 10, 3700);
    z.y = clamp(snap(my - state.dragOffset.y), 10, 3700);
    const el = document.getElementById(z.id);
    if (el) Object.assign(el.style, { left: `${z.x}px`, top: `${z.y}px` });
    state.dragMoved = true;
  }
  if (state.draggingDevice && pastThreshold && state.selectedTool === 'pointer') {
    const d = state.draggingDevice;
    d.x = clamp(snap(mx), 40, CANVAS_MAX);
    d.y = clamp(snap(my), 40, CANVAS_MAX);
    const el = document.getElementById(d.id);
    if (el) Object.assign(el.style, { left: `${d.x}px`, top: `${d.y}px` });
    updateLinkGeometry(d);
    state.dragMoved = true;
  }
  const src = state.cableSourceDevice;
  if (state.selectedTool === 'cable' && src)
    svgById('drawing-line').setAttribute('d', gravityCurve(src.x, src.y, mx, my));
}

function onPointerMove(clientX: number, clientY: number): void {
  pending = { x: clientX, y: clientY };
  frame ||= requestAnimationFrame(applyPointerMove);
}

function endPointer(): void {
  if (frame) {
    cancelAnimationFrame(frame);
    applyPointerMove();
  }
  if ((state.draggingDevice || state.draggingZone) && state.dragMoved) recordHistory();
  state.draggingDevice = null;
  state.draggingZone = null;
  setTimeout(() => (state.dragMoved = false), 0);
  if (state.viewport.isPanning) {
    state.viewport.isPanning = false;
    byId('workspace').style.cursor = state.selectedTool === 'pan' ? 'grab' : 'default';
  }
}

function bindEvents(): void {
  document.addEventListener('click', (e) => {
    dispatch(ACTIONS, 'action', e);
  });
  document.addEventListener('change', (e) => {
    dispatch(CHANGES, 'change', e);
  });
  document.addEventListener('contextmenu', (e) => {
    if ((e.target as Element | null)?.closest('[data-no-contextmenu]')) e.preventDefault();
  });
  window.addEventListener('keydown', onKeyDown);
  byId('cli-input').addEventListener('keydown', handleCliKey);

  const ws = byId('workspace');
  ws.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 0.1 : -0.1, e.clientX, e.clientY);
    },
    { passive: false },
  );
  ws.addEventListener('mousedown', (e) => {
    const onDevice = (e.target as Element).closest('.device');
    if (e.button === 1 || (e.button === 0 && state.selectedTool === 'pan' && !onDevice)) {
      state.viewport.isPanning = true;
      state.viewport.panStartX = e.clientX - state.viewport.x;
      state.viewport.panStartY = e.clientY - state.viewport.y;
      ws.style.cursor = 'grabbing';
    }
  });
  ws.addEventListener('click', onWorkspaceClick);
  ws.addEventListener('mousemove', (e) => {
    onPointerMove(e.clientX, e.clientY);
  });
  ws.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (e.touches.length === 1 && t) onPointerMove(t.clientX, t.clientY);
    },
    { passive: true },
  );
  window.addEventListener('mouseup', endPointer);
  window.addEventListener('touchend', endPointer);
  window.addEventListener('resize', () => {
    drawLinks();
  });
}

bindEvents();
applyViewport();
selectCategory('routers');
loadPreset('default');
