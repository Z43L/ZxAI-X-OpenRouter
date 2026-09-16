"use client";

import { useCallback } from "react";
import { useSendOpts } from "@/hooks/use-send-opts";
import { MessageList } from "./MessageList";

export function ChatWindow({ onDraftChange }: { draft: string; onDraftChange: (v: string) => void }) {
  const sendOpts = useSendOpts();

  const handleSuggestion = useCallback(
    (text: string) => {
      onDraftChange(text);
    },
    [onDraftChange],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList sendOpts={sendOpts} onSuggestion={handleSuggestion} />
    </div>
  );
}
