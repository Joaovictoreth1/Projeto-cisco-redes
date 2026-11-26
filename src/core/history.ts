/** Bounded undo/redo stack of serialized snapshots; consecutive duplicates are ignored. */
export class SnapshotHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  constructor(private readonly limit = 30) {}

  reset(snapshot?: string): void {
    this.undoStack = snapshot === undefined ? [] : [snapshot];
    this.redoStack = [];
  }

  push(snapshot: string): boolean {
    if (this.undoStack.at(-1) === snapshot) return false;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): string | null {
    if (!this.canUndo) return null;
    const current = this.undoStack.pop();
    if (current !== undefined) this.redoStack.push(current);
    return this.undoStack.at(-1) ?? null;
  }

  redo(): string | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    this.undoStack.push(next);
    return next;
  }
}
