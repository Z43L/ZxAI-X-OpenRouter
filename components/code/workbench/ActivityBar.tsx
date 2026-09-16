"use client";

import { Files, GitBranch, Search, Settings, Sparkles } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSettingsStore } from "@/store/settings-store";
import { cn } from "@/lib/utils/cn";
import type { ActivityView } from "@/types/code";

const ITEMS: { id: ActivityView; label: string; icon: typeof Files }[] = [
  { id: "explorer", label: "Explorer", icon: Files },
  { id: "search", label: "Search", icon: Search },
  { id: "scm", label: "Source Control", icon: GitBranch },
  { id: "ai", label: "AI", icon: Sparkles },
];

export function ActivityBar() {
  const activity = useWorkspaceStore((s) => s.activity);
  const setActivity = useWorkspaceStore((s) => s.setActivity);
  const setRightOpen = useWorkspaceStore((s) => s.setRightOpen);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-50 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activity === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => {
              if (item.id === "ai") {
                setRightOpen(true);
                setActivity("ai");
                return;
              }
              setActivity(item.id);
            }}
            className={cn(
              "mb-1 flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
              active && "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        type="button"
        title="Ajustes"
        onClick={() => setSettingsOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Settings className="h-[18px] w-[18px]" />
      </button>
    </nav>
  );
}
