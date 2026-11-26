import type { CableType, Device } from '../core/types';
import { ACCENT_CLASSES, CATEGORIES, CATEGORY_ACCENT, type CatalogItem, type CategoryKey } from './catalog';
import { byId, clear, h, svgById } from './dom';
import { catalogIcon } from './icons';
import { closeProperties } from './properties';
import { playSound } from './sound';
import { state, type Tool } from './state';

const SELECTED = ['ring-2', 'bg-white/10'];
const ALL_RINGS = Object.values(ACCENT_CLASSES).map((c) => c.ring);

interface ToolStyle {
  label: (cable: CableType) => string;
  dot: string;
  cursor: string;
}

const TOOL_STYLES: Record<Tool, ToolStyle> = {
  pointer: {
    label: () => 'Modo Seleção / Mover',
    dot: 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,1)]',
    cursor: 'default',
  },
  pan: {
    label: () => 'Mover Tela (Arraste)',
    dot: 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]',
    cursor: 'grab',
  },
  delete: {
    label: () => 'Excluir Nó, Cabo ou Zona',
    dot: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,1)]',
    cursor: 'crosshair',
  },
  cable: {
    label: (c) => `Conectar Cabo (${c})`,
    dot: 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,1)] animate-pulse',
    cursor: 'crosshair',
  },
  ping: {
    label: () => 'Enviar PDU (Origem -> Destino)',
    dot: 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,1)] animate-pulse',
    cursor: 'crosshair',
  },
  zone: {
    label: () => 'Clique na matriz para criar Zona de Sub-rede',
    dot: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]',
    cursor: 'crosshair',
  },
};

export const isTool = (v: string): v is Tool => v in TOOL_STYLES;

export function updateStatus(text: string, dotClass: string = TOOL_STYLES.pointer.dot): void {
  byId('tool-status').textContent = text;
  byId('status-dot').className = `w-2 h-2 rounded-full mr-2.5 ${dotClass}`;
}

function clearCatalogSelection(): void {
  document.querySelectorAll('.equipment-item').forEach((el) => {
    el.classList.remove(...SELECTED, ...ALL_RINGS);
  });
}

export function setTool(tool: Tool, cableType: CableType = 'auto'): void {
  state.selectedTool = tool;
  state.itemToPlace = null;
  state.cableSourceDevice = null;
  state.cableSourcePortIdx = null;
  state.pingSourceDevice = null;
  if (tool === 'cable') state.selectedCableType = cableType;

  document.querySelectorAll('.tool-btn').forEach((b) => {
    b.classList.remove('tool-active');
    b.setAttribute('aria-pressed', 'false');
  });
  const active = document.getElementById(`tool-${tool}`);
  active?.classList.add('tool-active');
  active?.setAttribute('aria-pressed', 'true');
  clearCatalogSelection();
  svgById('drawing-cable').classList.add('hidden');
  hidePortPicker();
  for (const d of state.topology.devices) document.getElementById(d.id)?.classList.remove('ping-src', 'cable-src');

  const ws = byId('workspace');
  ws.classList.toggle('delete-mode', tool === 'delete');
  if (tool === 'delete') closeProperties();
  const style = TOOL_STYLES[tool];
  updateStatus(style.label(cableType), style.dot);
  ws.style.cursor = style.cursor;
}

export function selectCategory(cat: CategoryKey): void {
  state.currentCategory = cat;
  for (const key of Object.keys(CATEGORIES) as CategoryKey[]) {
    const btn = document.getElementById(`cat-${key}`);
    if (!btn) continue;
    const isActive = key === cat;
    btn.classList.toggle('bg-white/10', isActive);
    btn.classList.toggle('border', isActive);
    btn.classList.toggle('border-white/5', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
    const i = btn.querySelector('i');
    if (i) {
      i.classList.remove('text-slate-500', ...Object.values(ACCENT_CLASSES).map((c) => c.text));
      i.classList.add(isActive ? ACCENT_CLASSES[CATEGORY_ACCENT[key]].text : 'text-slate-500');
    }
  }
  renderCatalog();
}

function selectItem(btn: HTMLElement, item: CatalogItem): void {
  playSound('click');
  const accent = ACCENT_CLASSES[item.color];
  if (state.currentCategory === 'connections') {
    setTool('cable', item.type as CableType);
  } else {
    if (state.selectedTool !== 'pointer') setTool('pointer');
    clearCatalogSelection();
    state.itemToPlace = item;
    updateStatus(`Clique na matriz para inserir ${item.label}`, `animate-pulse ${accent.bg}`);
    byId('workspace').style.cursor = 'crosshair';
  }
  btn.classList.add(...SELECTED, accent.ring);
}

export function renderCatalog(): void {
  const list = byId('equipment-list');
  clear(list);
  for (const item of CATEGORIES[state.currentCategory]) {
    const btn = h(
      'button',
      {
        className:
          'equipment-item flex flex-col items-center justify-center w-22 md:w-24 h-[84px] md:h-[90px] bg-black/45 border border-white/5 rounded-2xl hover:bg-white/10 transition-all shrink-0 outline-none group shadow-lg px-2',
        attrs: { type: 'button', 'data-item': item.id },
      },
      [
        h(
          'div',
          {
            className:
              'w-9 h-9 mb-1.5 transition-transform duration-300 group-hover:-translate-y-1 flex items-center justify-center text-2xl md:text-3xl opacity-85 group-hover:opacity-100',
          },
          [catalogIcon(item.type)],
        ),
        h('span', {
          className:
            'text-[10px] font-bold text-slate-400 text-center leading-tight group-hover:text-white transition-colors tracking-wide',
          text: item.label,
        }),
      ],
    );
    btn.addEventListener('click', () => {
      selectItem(btn, item);
    });
    list.append(btn);
  }
}

export function showPortPicker(clientX: number, clientY: number, dev: Device, onSelect: (idx: number) => void): void {
  const menu = byId('port-picker-menu');
  const list = byId('pp-list');
  const header = byId('pp-header');
  clear(header);
  header.append(h('span', { text: `${dev.name} — Porta` }));
  clear(list);
  dev.interfaces.forEach((intf, idx) => {
    const busy = Boolean(intf.connectedTo);
    const row = h(
      'div',
      {
        className: `context-item ${busy ? 'disabled' : ''}`,
        attrs: { role: 'menuitem', 'aria-disabled': String(busy) },
      },
      [
        h('span', { className: 'font-mono text-xs flex items-center gap-2' }, [
          h('span', { className: `w-2 h-2 rounded-full ${busy ? 'bg-rose-500' : 'bg-emerald-400'}` }),
          intf.name,
        ]),
        h('span', { className: 'text-[9px] font-mono text-slate-400', text: busy ? 'Em uso' : intf.ip || 'Livre' }),
      ],
    );
    if (!busy) {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        hidePortPicker();
        onSelect(idx);
      });
    }
    list.append(row);
  });
  menu.style.left = `${Math.min(clientX, window.innerWidth - 225)}px`;
  menu.style.top = `${Math.min(clientY, window.innerHeight - 260)}px`;
  menu.classList.remove('hidden');
}

export function hidePortPicker(): void {
  byId('port-picker-menu').classList.add('hidden');
}
