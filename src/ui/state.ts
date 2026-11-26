import { SnapshotHistory } from '../core/history';
import { emptyTopology } from '../core/topology';
import type { CableType, Device, Topology, Zone } from '../core/types';
import type { CatalogItem, CategoryKey } from './catalog';

export type Tool = 'pointer' | 'pan' | 'cable' | 'ping' | 'zone' | 'delete';

export interface PduLog {
  id: number;
  time: string;
  src: string;
  dest: string;
  proto: string;
  status: string;
  osi: { l1: string; l2: string; l3: string; l4: string } | null;
}

export interface AppState {
  topology: Topology;
  history: SnapshotHistory;
  pduLogs: PduLog[];
  selectedTool: Tool;
  selectedCableType: CableType;
  currentCategory: CategoryKey;
  itemToPlace: CatalogItem | null;
  activeDevice: Device | null;
  draggingDevice: Device | null;
  draggingZone: Zone | null;
  dragOffset: { x: number; y: number };
  dragMoved: boolean;
  dragStart: { x: number; y: number };
  cableSourceDevice: Device | null;
  cableSourcePortIdx: number | null;
  pingSourceDevice: Device | null;
  cliHistory: Map<string, { cmds: string[]; index: number }>;
  contextMenuTarget: Device | null;
  viewport: {
    x: number;
    y: number;
    scale: number;
    snap: boolean;
    isPanning: boolean;
    panStartX: number;
    panStartY: number;
  };
}

export const state: AppState = {
  topology: emptyTopology(),
  history: new SnapshotHistory(30),
  pduLogs: [],
  selectedTool: 'pointer',
  selectedCableType: 'auto',
  currentCategory: 'end_devices',
  itemToPlace: null,
  activeDevice: null,
  draggingDevice: null,
  draggingZone: null,
  dragOffset: { x: 0, y: 0 },
  dragMoved: false,
  dragStart: { x: 0, y: 0 },
  cableSourceDevice: null,
  cableSourcePortIdx: null,
  pingSourceDevice: null,
  cliHistory: new Map(),
  contextMenuTarget: null,
  viewport: { x: 0, y: 0, scale: 1, snap: false, isPanning: false, panStartX: 0, panStartY: 0 },
};

export function cliHistoryFor(deviceId: string): { cmds: string[]; index: number } {
  let buf = state.cliHistory.get(deviceId);
  if (!buf) {
    buf = { cmds: [], index: -1 };
    state.cliHistory.set(deviceId, buf);
  }
  return buf;
}
