import { byId, clear, h, icon } from './dom';
import { showModal } from './modal';
import { state, type PduLog } from './state';

const MAX_LOGS = 200;
let nextId = 1;

function placeholder(): HTMLElement {
  return h('div', {
    className: 'text-slate-500 text-center italic mt-14 font-mono text-[11px] placeholder-text',
    text: 'Aguardando tráfego ICMP/ARP/DHCP...',
  });
}

export function logPdu(src: string, dest: string, proto: string, status: string, osi: PduLog['osi'] = null): void {
  byId('pdu-panel').classList.remove('hidden');
  const list = byId('pdu-list');
  list.querySelector('.placeholder-text')?.remove();
  const entry: PduLog = { id: nextId++, time: new Date().toLocaleTimeString(), src, dest, proto, status, osi };
  state.pduLogs.push(entry);
  if (state.pduLogs.length > MAX_LOGS) {
    state.pduLogs.shift();
    list.lastElementChild?.remove();
  }
  const color =
    status === 'Success'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15'
      : proto.includes('DHCP')
        ? 'text-sky-400 bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/15'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15';
  const row = h(
    'button',
    {
      className: `w-full text-left cursor-pointer border rounded-xl px-3 py-2 flex items-center justify-between shadow-md ${color} animate-slide-up transition`,
      attrs: { type: 'button' },
    },
    [
      h('div', { className: 'flex flex-col gap-0.5' }, [
        h('span', { className: 'font-bold font-mono tracking-tight text-[11.5px] flex items-center gap-1.5' }, [
          proto,
          icon('ph ph-magnifying-glass text-[10px] opacity-60'),
        ]),
        h('span', { className: 'text-[10px] text-slate-300 font-mono flex items-center gap-1.5' }, [
          src,
          icon('ph ph-arrow-right text-slate-500'),
          dest,
        ]),
      ]),
      h('span', {
        className:
          'font-bold text-[9px] uppercase tracking-widest bg-black/60 px-2 py-1 rounded-md border border-white/5',
        text: status,
      }),
    ],
  );
  row.addEventListener('click', () => {
    inspectPdu(entry);
  });
  list.prepend(row);
}

const LAYERS = [
  { key: 'l4', tone: 'purple', title: (p: PduLog) => `Camada 4 / Aplicação (${p.proto})` },
  { key: 'l3', tone: 'sky', title: () => 'Camada 3 — Rede (IPv4)' },
  { key: 'l2', tone: 'emerald', title: () => 'Camada 2 — Enlace (Ethernet II)' },
  { key: 'l1', tone: 'amber', title: () => 'Camada 1 — Física' },
] as const;

const TONES = {
  purple: ['bg-purple-500/10 border-purple-500/30', 'text-purple-400'],
  sky: ['bg-sky-500/10 border-sky-500/30', 'text-sky-400'],
  emerald: ['bg-emerald-500/10 border-emerald-500/30', 'text-emerald-400'],
  amber: ['bg-amber-500/10 border-amber-500/30', 'text-amber-400'],
} as const;

function inspectPdu(p: PduLog): void {
  const osi = p.osi ?? {
    l1: 'Ethernet 802.3 / Fibra Óptica — Sinalização Física Ativa',
    l2: 'Src MAC: 00:1A:2B:3C:4D:5E | Dst MAC: FF:FF:FF:FF:FF:FF | EtherType: 0x0800',
    l3: `IPv4 Header — Src: ${p.src} -> Dst: ${p.dest} | TTL: 64`,
    l4: `${p.proto} — Status: ${p.status} (${p.time})`,
  };
  const body = h(
    'div',
    { className: 'space-y-2.5 font-mono text-xs' },
    LAYERS.map((layer) => {
      const [box, label] = TONES[layer.tone];
      return h('div', { className: `${box} border p-3 rounded-xl` }, [
        h('div', { className: `text-[10px] font-bold ${label} uppercase mb-1`, text: layer.title(p) }),
        h('div', { className: 'text-slate-200', text: osi[layer.key] }),
      ]);
    }),
  );
  showModal(`Inspetor de Cabeçalhos OSI — ${p.proto}`, body);
}

export function clearLogs(): void {
  state.pduLogs = [];
  const list = byId('pdu-list');
  clear(list);
  list.append(placeholder());
}
