import type { AIChangeSet } from "@/types/agent";
import type { WorkspaceProvider } from "@/types/workspace";
import { countLineDelta } from "@/lib/diff/patch";

export function changeSetSummary(set: AIChangeSet): string {
  const counts = { M: 0, A: 0, D: 0 };
  let ins = 0;
  let del = 0;
  for (const f of set.files) {
    if (f.kind === "modify") counts.M++;
    else if (f.kind === "add") counts.A++;
    else counts.D++;
    const d = countLineDelta(f.original, f.proposed);
    ins += d.insertions;
    del += d.deletions;
  }
  return `${set.files.length} cambios  +${ins} -${del}`;
}

export async function applyChangeSet(
  workspace: WorkspaceProvider,
  set: AIChangeSet,
  only?: Set<string>,
): Promise<AIChangeSet> {
  for (const file of set.files) {
    if (file.status === "rejected" || file.status === "applied") continue;
    if (only && !only.has(file.path)) continue;
    if (file.kind === "delete") {
      if (await workspace.exists(file.path)) await workspace.delete(file.path);
    } else if (file.kind === "add") {
      if (await workspace.exists(file.path)) await workspace.writeFile(file.path, file.proposed ?? "");
      else await workspace.createFile(file.path, file.proposed ?? "");
    } else {
      await workspace.writeFile(file.path, file.proposed ?? "");
    }
    file.status = "applied";
  }
  const pending = set.files.filter((f) => f.status === "pending").length;
  const applied = set.files.filter((f) => f.status === "applied").length;
  const rejected = set.files.filter((f) => f.status === "rejected").length;
  let status: AIChangeSet["status"] = "proposed";
  if (applied && pending) status = "partially-applied";
  else if (applied && !pending) status = "applied";
  else if (rejected && !pending && !applied) status = "rejected";
  return { ...set, files: [...set.files], status };
}

export function rejectChangeSet(set: AIChangeSet, only?: Set<string>): AIChangeSet {
  for (const file of set.files) {
    if (only && !only.has(file.path)) continue;
    if (file.status === "pending") file.status = "rejected";
  }
  const pending = set.files.some((f) => f.status === "pending");
  const applied = set.files.some((f) => f.status === "applied");
  return {
    ...set,
    files: [...set.files],
    status: pending ? "proposed" : applied ? "partially-applied" : "rejected",
  };
}
