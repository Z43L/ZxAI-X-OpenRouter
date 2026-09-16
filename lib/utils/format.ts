export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatCost(cost?: number): string {
  if (cost === undefined || cost === null || Number.isNaN(cost)) return "—";
  if (cost === 0) return "$0";
  if (cost < 0.0001) return `$${cost.toExponential(1)}`;
  return `$${cost.toFixed(cost < 0.01 ? 4 : 3)}`;
}

/** Precio OpenRouter (string por token) -> $ por millón de tokens. */
export function pricePerMillion(price?: string): number | null {
  if (!price) return null;
  const v = Number(price);
  if (Number.isNaN(v)) return null;
  return v * 1_000_000;
}

export function formatPricePair(prompt?: string, completion?: string): string {
  const p = pricePerMillion(prompt);
  const c = pricePerMillion(completion);
  if (p === null || c === null) return "—";
  if (p === 0 && c === 0) return "Gratis";
  const fmt = (v: number) => (v === 0 ? "0" : v < 0.01 ? v.toFixed(3) : v.toFixed(v < 10 ? 2 : 0));
  return `$${fmt(p)} / $${fmt(c)}/M`;
}

export function formatContext(contextLength?: number): string {
  if (!contextLength) return "—";
  if (contextLength >= 1_000_000) return `${(contextLength / 1_000_000).toFixed(contextLength % 1_000_000 === 0 ? 0 : 2)}M ctx`;
  if (contextLength >= 1000) return `${Math.round(contextLength / 1000)}K ctx`;
  return `${contextLength} ctx`;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return formatTimestamp(ts);
}
