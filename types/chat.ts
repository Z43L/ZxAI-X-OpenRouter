import type { CapabilityConfig, Citation, MessageCapabilities, SearchPhase } from "./capabilities";
import type { ParsedAttachment } from "./attachments";
import type { MessageAudio, MessageImage, MessageVideo } from "./media";

export type { CapabilityConfig, Citation, MessageCapabilities, SearchPhase };
export type { ParsedAttachment, MessageAudio, MessageImage, MessageVideo };

export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "stopped"
  | "error";

export interface MessageUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  cost?: number;
  webSearchRequests?: number;
}

export interface MessageError {
  code?: string | number;
  message: string;
  /** Detalle original del proveedor (normalmente en inglés). */
  detail?: string;
  retryable?: boolean;
  /** Ms sugeridos antes de reintentar (429: header Retry-After). */
  retryAfterMs?: number;
  provider?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  requestedModel?: string;
  actualModel?: string;
  usage?: MessageUsage;
  finishReason?: string;
  elapsedMs?: number;
  error?: MessageError;
  capabilities?: MessageCapabilities;
  citations?: Citation[];
  searchWarning?: string;
  attachments?: ParsedAttachment[];
  images?: MessageImage[];
  audio?: MessageAudio;
  video?: MessageVideo;
  createdAt: number;
}

export interface Chat {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  capabilities: CapabilityConfig;
  projectId?: string;
}

export type GenerationState =
  | "idle"
  | "submitting"
  | "streaming"
  | "stopping"
  | "error";

export interface FailedRequest {
  chatId: string;
  assistantMessageId: string;
  /** Payload tal cual se envió (para reintentar sin reconstruir). */
  payloadMessages: { role: MessageRole; content: string }[];
  requestedModel: string;
  capabilities?: CapabilityConfig;
}

/** Texto en curso, aislado de `chats` para no re-renderizar sidebar/lista. */
export interface StreamingSlice {
  chatId: string;
  messageId: string;
  text: string;
  searchPhase?: SearchPhase;
  sourceCount?: number;
  searchFailed?: boolean;
}

export interface RateLimitNotice {
  message: string;
  retryAfterMs?: number;
}
