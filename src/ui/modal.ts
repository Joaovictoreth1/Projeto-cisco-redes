import { byId, clear, h } from './dom';

let lastFocus: HTMLElement | null = null;

export function showModal(title: string, message: string | Node, onConfirm?: () => void): void {
  const modal = byId('custom-modal');
  const content = byId('custom-modal-content');
  byId('modal-title').textContent = title;
  const msg = byId('modal-message');
  clear(msg);
  msg.append(message);
  const actions = byId('modal-actions');
  clear(actions);
  const closeBtn = h('button', {
    className: onConfirm
      ? 'px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition outline-none'
      : 'px-6 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition outline-none',
    text: onConfirm ? 'Cancelar' : 'Fechar',
    attrs: { type: 'button' },
  });
  closeBtn.addEventListener('click', closeModal);
  actions.append(closeBtn);
  let focusTarget = closeBtn;
  if (onConfirm) {
    const confirm = h('button', {
      className:
        'px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition outline-none shadow-[0_0_15px_rgba(225,29,72,0.4)]',
      text: 'Confirmar',
      attrs: { type: 'button', id: 'modal-confirm-btn' },
    });
    confirm.addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
    actions.append(confirm);
    focusTarget = confirm;
  }
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-title');
  modal.classList.remove('hidden');
  modal.getBoundingClientRect();
  modal.classList.remove('opacity-0');
  content.classList.remove('scale-95');
  focusTarget.focus();
}

export function isModalOpen(): boolean {
  return !byId('custom-modal').classList.contains('hidden');
}

export function closeModal(): void {
  const modal = byId('custom-modal');
  modal.classList.add('opacity-0');
  byId('custom-modal-content').classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 280);
  lastFocus?.focus();
  lastFocus = null;
}
