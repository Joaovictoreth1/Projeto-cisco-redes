import { byId, h, icon } from './dom';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

const STYLES: Record<ToastType, { icon: string; cls: string }> = {
  success: { icon: 'check-circle', cls: 'toast-success' },
  error: { icon: 'x-circle', cls: 'toast-error' },
  warning: { icon: 'warning', cls: 'toast-warning' },
  info: { icon: 'info', cls: 'toast-message' },
};

export function toast(message: string, type: ToastType = 'success', duration = 2800): void {
  const style = STYLES[type];
  const el = h(
    'div',
    { className: `toast-message ${style.cls}`, attrs: { role: type === 'error' ? 'alert' : 'status' } },
    [icon(`ph-fill ph-${style.icon} text-lg`), ' ', h('span', { className: 'font-medium', text: message })],
  );
  byId('toast-container').append(el);
  requestAnimationFrame(() => {
    el.classList.add('show');
  });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => {
      el.remove();
    }, 350);
  }, duration);
}
