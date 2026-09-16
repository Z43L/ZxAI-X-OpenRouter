import type { WorkspaceProvider } from "@/types/workspace";

const providers = new Map<string, WorkspaceProvider>();

export function registerProvider(provider: WorkspaceProvider): void {
  providers.get(provider.id)?.dispose();
  providers.set(provider.id, provider);
}

export function getProvider(id: string | null | undefined): WorkspaceProvider | undefined {
  if (!id) return undefined;
  return providers.get(id);
}

export function unregisterProvider(id: string): void {
  const p = providers.get(id);
  p?.dispose();
  providers.delete(id);
}

export function listProviders(): WorkspaceProvider[] {
  return [...providers.values()];
}
