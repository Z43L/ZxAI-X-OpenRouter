export interface NormalizedError {
  code: number | string;
  message: string;
  /** Mensaje original del proveedor (normalmente en inglés). */
  detail?: string;
  retryable: boolean;
  /** Ms sugeridos antes de reintentar (header Retry-After o defecto). */
  retryAfterMs?: number;
  provider?: string;
}

const DEFAULT_RATE_LIMIT_WAIT_MS = 15_000;

function parseRetryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const secs = Number(raw);
  if (!Number.isNaN(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

interface OpenRouterErrorBody {
  error?: {
    message?: string;
    code?: number | string;
    metadata?: {
      raw?: string;
      providerName?: string;
    };
  };
  message?: string;
}

/**
 * Normaliza errores HTTP + cuerpo de OpenRouter a un mensaje legible.
 * Referencia: OpenRouter normaliza finish_reason a
 * tool_calls | stop | length | content_filter | error.
 */
export async function normalizeOpenRouterError(res: Response): Promise<NormalizedError> {
  const status = res.status;
  let detail = "";
  let provider: string | undefined;
  try {
    const body = (await res.json()) as OpenRouterErrorBody;
    const err = body?.error;
    if (typeof err?.message === "string") detail = err.message;
    else if (typeof body === "object" && body !== null && typeof body.message === "string") {
      detail = body.message;
    }
    if (typeof err?.metadata?.providerName === "string") provider = err.metadata.providerName;
  } catch {
    try {
      detail = await res.text();
    } catch {
      detail = "";
    }
  }
  // Recortar detalles larguísimos (algunos proveedores devuelven trazas).
  if (detail.length > 500) detail = `${detail.slice(0, 500)}…`;

  const base: Record<number, { message: string; retryable: boolean }> = {
    400: { message: "Solicitud inválida para el modelo.", retryable: false },
    401: { message: "API key inválida o ausente. Revisa tu clave en Ajustes.", retryable: false },
    402: { message: "Sin créditos en OpenRouter.", retryable: false },
    403: { message: "Acceso denegado por el proveedor.", retryable: false },
    404: {
      message:
        "OpenRouter no pudo enrutar este modelo (404). Puede estar retirado o sin proveedores disponibles.",
      retryable: true,
    },
    408: { message: "Timeout del proveedor.", retryable: true },
    429: {
      message:
        "Límite de peticiones de OpenRouter alcanzado (429). Los modelos gratuitos tienen límites estrictos por minuto.",
      retryable: true,
    },
    500: { message: "Error interno de OpenRouter.", retryable: true },
    502: { message: "Proveedor no disponible.", retryable: true },
    503: {
      message: "No hay proveedores disponibles para este modelo ahora mismo. Reintenta o elige otro.",
      retryable: true,
    },
  };

  const fallback = base[status] ?? {
    message: `Error HTTP ${status}.`,
    retryable: status >= 500 || status === 429,
  };

  const retryAfterMs =
    status === 429 ? (parseRetryAfterMs(res) ?? DEFAULT_RATE_LIMIT_WAIT_MS) : undefined;

  return {
    code: status,
    message: fallback.message,
    detail: detail || undefined,
    retryable: fallback.retryable,
    retryAfterMs,
    provider,
  };
}

/** Normaliza un error que llega dentro del stream SSE (chunk.error). */
export function normalizeUpstreamError(
  code: number | string | undefined,
  message: string | undefined,
): NormalizedError {
  const msg = message ?? "El proveedor devolvió un error.";
  const isRateLimit = /rate.?limit|429|too many requests/i.test(`${code} ${msg}`);
  return {
    code: code ?? "UPSTREAM",
    message: isRateLimit
      ? "Límite de peticiones de OpenRouter alcanzado durante el streaming. Se conserva lo recibido hasta ahora."
      : "El proveedor interrumpió la generación.",
    detail: msg.slice(0, 500) || undefined,
    retryable: true,
    retryAfterMs: isRateLimit ? DEFAULT_RATE_LIMIT_WAIT_MS : undefined,
  };
}

export function networkError(message: string): NormalizedError {
  return { code: "NETWORK", message, retryable: true };
}

const NO_ENDPOINTS_RE =
  /no endpoints|no available.*(provider|model)|data policy|all profiles unavailable|in cooldown|not available/i;
const MISSING_MODEL_RE = /not found|does not exist|unknown model|invalid model|no such model/i;

/**
 * Distingue 404 "el id no existe" de 404 "no hay endpoints"
 * (muy habitual en :free justo después de un 429).
 */
export function refineOpenRouterError(
  err: NormalizedError,
  ctx: { modelId: string; knownModel: boolean },
): NormalizedError {
  const blob = `${err.message} ${err.detail ?? ""} ${err.code}`;
  const is404 = err.code === 404 || err.code === "404";
  const is503 = err.code === 503 || err.code === "503";
  const id = ctx.modelId.trim();

  // Id vacío o ausente del catálogo: no reintentar el mismo 404.
  if (!id || (is404 && !ctx.knownModel) || (MISSING_MODEL_RE.test(blob) && !ctx.knownModel)) {
    return {
      ...err,
      message: id
        ? `El modelo «${id}» no está disponible en OpenRouter. Elige otro en el selector.`
        : "No hay un modelo válido seleccionado. Elige uno en el selector.",
      retryable: false,
    };
  }

  if (NO_ENDPOINTS_RE.test(blob) || (is404 && ctx.knownModel) || is503) {
    return {
      ...err,
      message:
        "No hay proveedores disponibles para este modelo ahora mismo. En modelos gratuitos suele ocurrir justo después de un límite de peticiones. Espera un momento o elige otro modelo.",
      retryable: true,
      retryAfterMs: err.retryAfterMs ?? DEFAULT_RATE_LIMIT_WAIT_MS,
    };
  }

  return err;
}

export function isMissingModelError(err: NormalizedError): boolean {
  return (err.code === 404 || err.code === "404") && err.retryable === false;
}
