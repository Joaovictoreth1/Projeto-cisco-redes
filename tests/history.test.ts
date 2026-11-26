import { describe, expect, it } from 'vitest';
import { SnapshotHistory } from '../src/core/history';

describe('SnapshotHistory', () => {
  it('undoes and redoes snapshots in order', () => {
    const h = new SnapshotHistory();
    h.reset('a');
    h.push('b');
    h.push('c');
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe('b');
    expect(h.redo()).toBe('c');
    expect(h.redo()).toBeNull();
  });

  it('ignores consecutive duplicates and clears redo on new work', () => {
    const h = new SnapshotHistory();
    h.reset();
    expect(h.push('a')).toBe(true);
    expect(h.push('a')).toBe(false);
    h.push('b');
    h.undo();
    expect(h.canRedo).toBe(true);
    h.push('c');
    expect(h.canRedo).toBe(false);
  });

  it('caps the number of retained snapshots', () => {
    const h = new SnapshotHistory(3);
    ['1', '2', '3', '4'].forEach((s) => h.push(s));
    expect(h.undo()).toBe('3');
    expect(h.undo()).toBe('2');
    expect(h.canUndo).toBe(false);
  });
});
