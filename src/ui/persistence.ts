import { buildPreset, PRESET_KEYS, type PresetKey } from '../core/presets';
import { emptyTopology, parseTopology, parseTopologyJson, serialize, TopologyValidationError } from '../core/topology';
import type { Topology } from '../core/types';
import { drawLinks, renderDevice, renderZone } from './engine';
import { clearLogs } from './logger';
import { showModal } from './modal';
import { closeProperties } from './properties';
import { state } from './state';
import { toast } from './toast';
import { setTool } from './tools';
import { resetViewport } from './viewport';

export const STORAGE_KEY = 'wpt_switchlab_enterprise_v3';
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export const isPresetKey = (v: string): v is PresetKey => (PRESET_KEYS as readonly string[]).includes(v);

function updateHistoryButtons(): void {
  for (const [id, enabled] of [
    ['btn-undo', state.history.canUndo],
    ['btn-redo', state.history.canRedo],
  ] as const) {
    const btn = document.getElementById(id);
    if (btn instanceof HTMLButtonElement) btn.disabled = !enabled;
  }
}

export function recordHistory(): void {
  state.history.push(serialize(state.topology));
  updateHistoryButtons();
}

/** Swaps in an already-validated topology and repaints the canvas. */
function render(topology: Topology): void {
  setTool('pointer');
  closeProperties();
  state.topology = topology;
  state.cliHistory.clear();
  for (const id of ['devices-layer', 'cables-layer', 'zones-layer']) document.getElementById(id)?.replaceChildren();
  for (const zone of topology.zones) renderZone(zone);
  for (const dev of topology.devices) renderDevice(dev);
  drawLinks();
}

function restoreSnapshot(snapshot: string | null): void {
  if (snapshot === null) return;
  render(parseTopology(JSON.parse(snapshot)));
  updateHistoryButtons();
}

export function undo(): void {
  if (!state.history.canUndo) {
    toast('Nada para desfazer.', 'info', 1200);
    return;
  }
  restoreSnapshot(state.history.undo());
}

export function redo(): void {
  if (!state.history.canRedo) {
    toast('Nada para refazer.', 'info', 1200);
    return;
  }
  restoreSnapshot(state.history.redo());
}

function replaceWorkspace(topology: Topology): void {
  render(topology);
  clearLogs();
  recordHistory();
}

export function clearWorkspace(): void {
  showModal(
    'Limpar Matriz de Rede',
    'Todos os dispositivos, zonas e enlaces ativos serão removidos. Continuar?',
    () => {
      replaceWorkspace(emptyTopology());
      toast('Área de trabalho limpa.', 'info');
    },
  );
}

export function saveLocal(): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state.topology));
    toast('Topologia salva no armazenamento local.', 'success');
  } catch {
    toast('Não foi possível salvar: armazenamento local indisponível ou cheio.', 'error');
  }
}

function describe(err: unknown): string {
  return err instanceof TopologyValidationError ? err.message : 'formato desconhecido';
}

export function loadLocal(): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    toast('Armazenamento local indisponível.', 'error');
    return;
  }
  if (!raw) {
    toast('Nenhuma topologia salva encontrada.', 'warning');
    return;
  }
  const saved = raw;
  showModal('Carregar Topologia', 'Isso substituirá a topologia atual na tela. Deseja continuar?', () => {
    try {
      replaceWorkspace(parseTopologyJson(saved));
      toast('Topologia restaurada com sucesso.', 'success');
    } catch (err) {
      toast(`Falha ao ler dados salvos (${describe(err)}).`, 'error', 4500);
    }
  });
}

export function exportJson(): void {
  const blob = new Blob([serialize(state.topology)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `switchlab-enterprise-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
  toast('Arquivo JSON exportado.', 'success');
}

export async function importFile(input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    toast('Arquivo muito grande (limite de 5 MB).', 'error');
    return;
  }
  try {
    const topology = parseTopologyJson(await file.text());
    replaceWorkspace(topology);
    toast(`Topologia "${file.name}" importada!`, 'success');
  } catch (err) {
    toast(`Arquivo JSON inválido ou corrompido (${describe(err)}).`, 'error', 5000);
  }
}

export function loadPreset(key: PresetKey): void {
  resetViewport();
  const width = Math.max(window.innerWidth, 760);
  const height = Math.max(window.innerHeight - 180, 520);
  render(buildPreset(key, width, height));
  clearLogs();
  state.history.reset(serialize(state.topology));
  updateHistoryButtons();
  if (key === 'dhcp_lab') toast('Clique direito nos PCs -> "Solicitar IP (DHCP)" para testar!', 'info', 4000);
}
