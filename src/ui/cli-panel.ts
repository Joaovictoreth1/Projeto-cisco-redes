import { complete, executeCommand } from '../core/cli';
import { syncPrompt } from '../core/cli';
import { LIMITS } from '../core/topology';
import type { Device } from '../core/types';
import { byId } from './dom';
import { requestDhcpFor, runPing, runTraceroute, updateDeviceDOM, drawLinks } from './engine';
import { recordHistory } from './persistence';
import { openProperties } from './properties';
import { cliHistoryFor, state } from './state';

export function renderCli(): void {
  const dev = state.activeDevice;
  if (!dev) return;
  const out = byId('cli-output');
  out.textContent = dev.cliOutput.join('\n');
  byId('cli-prompt').textContent = dev.prompt;
  requestAnimationFrame(() => (out.scrollTop = out.scrollHeight));
}

/** Appends to a device's console; only repaints when that device's console is open. */
export function printTo(dev: Device, text: string): void {
  dev.cliOutput.push(text);
  if (dev.cliOutput.length > LIMITS.cliLines) dev.cliOutput.splice(0, dev.cliOutput.length - LIMITS.cliLines);
  if (state.activeDevice?.id === dev.id) renderCli();
}

export function clearCli(): void {
  const dev = state.activeDevice;
  if (!dev) return;
  dev.cliOutput = [];
  renderCli();
}

export async function runCommand(dev: Device, cmd: string): Promise<void> {
  const result = executeCommand(dev, cmd);
  if (result.clear) {
    dev.cliOutput = [];
    renderCli();
    return;
  }
  for (const line of result.lines) printTo(dev, line);
  if (result.mutated) {
    syncPrompt(dev);
    updateDeviceDOM(dev);
    drawLinks();
    recordHistory();
    if (state.activeDevice?.id === dev.id) openProperties(dev);
  }
  if (result.action?.kind === 'ping') await runPing(dev, result.action.target);
  else if (result.action?.kind === 'traceroute') await runTraceroute(dev, result.action.target);
  else if (result.action?.kind === 'dhcp') await requestDhcpFor(dev);
  renderCli();
}

export function handleCliKey(e: KeyboardEvent): void {
  const dev = state.activeDevice;
  if (!dev) return;
  const field = e.currentTarget as HTMLInputElement;
  const buf = cliHistoryFor(dev.id);
  if (e.key === 'Tab') {
    e.preventDefault();
    const match = complete(field.value);
    if (match) field.value = `${match} `;
  } else if (e.key === 'Enter') {
    const cmd = field.value.trim();
    field.value = '';
    if (cmd) {
      buf.cmds.push(cmd);
      if (buf.cmds.length > 100) buf.cmds.shift();
      buf.index = buf.cmds.length;
    }
    printTo(dev, dev.prompt + cmd);
    void runCommand(dev, cmd);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (buf.index > 0) {
      buf.index -= 1;
      field.value = buf.cmds[buf.index] ?? '';
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (buf.index < buf.cmds.length - 1) {
      buf.index += 1;
      field.value = buf.cmds[buf.index] ?? '';
    } else {
      buf.index = buf.cmds.length;
      field.value = '';
    }
  }
}
