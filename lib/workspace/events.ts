import type { WorkspaceChangeEvent, WorkspaceChangeListener } from "@/types/workspace";

export class WorkspaceEmitter {
  private listeners = new Set<WorkspaceChangeListener>();

  on(listener: WorkspaceChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: WorkspaceChangeEvent): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        /* el consumidor no debe tumbar al provider */
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}
