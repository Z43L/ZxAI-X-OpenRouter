import type { StudioClip } from "@/types/studio";

type Listener = (state: StudioQueueState) => void;

export interface StudioQueueState {
  current: StudioClip | null;
  upcoming: StudioClip[];
  past: StudioClip[];
  playing: boolean;
  positionMs: number;
  durationMs: number;
}

const empty: StudioQueueState = {
  current: null,
  upcoming: [],
  past: [],
  playing: false,
  positionMs: 0,
  durationMs: 0,
};

export class StudioAudioQueue {
  private ctx: AudioContext | null = null;
  private current: StudioClip | null = null;
  private upcoming: StudioClip[] = [];
  private past: StudioClip[] = [];
  private playing = false;
  private bufferMap = new Map<string, AudioBuffer>();
  private source: AudioBufferSourceNode | null = null;
  private startedAtMs = 0;
  private offsetMs = 0;
  private rafId: number | null = null;
  private listeners = new Set<Listener>();
  private onEnded: ((clip: StudioClip) => void) | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.emit();
    return () => {
      this.listeners.delete(listener);
    };
  }

  onClipEnded(cb: (clip: StudioClip) => void) {
    this.onEnded = cb;
  }

  setQueue(upcoming: StudioClip[]) {
    this.upcoming = [...upcoming];
    this.emit();
  }

  enqueue(clip: StudioClip) {
    this.upcoming.push(clip);
    this.emit();
  }

  state(): StudioQueueState {
    return {
      current: this.current,
      upcoming: [...this.upcoming],
      past: [...this.past],
      playing: this.playing,
      positionMs: this.computePositionMs(),
      durationMs: this.current
        ? Math.round((this.bufferMap.get(this.current.id)?.duration ?? 0) * 1000)
        : 0,
    };
  }

  private async ensureCtx(): Promise<AudioContext | null> {
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
    return this.ctx;
  }

  async start(): Promise<boolean> {
    const ctx = await this.ensureCtx();
    if (!ctx) return false;
    if (this.playing) return true;
    if (!this.current && this.upcoming.length > 0) {
      this.current = this.upcoming.shift() ?? null;
    }
    if (!this.current) return false;
    const buffer = await this.ensureBuffer(this.current);
    if (!buffer) return false;
    this.startedAtMs = ctx.currentTime * 1000 - this.offsetMs;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = () => {
      if (this.current && src === this.source) {
        this.handleClipEnded();
      }
    };
    src.start(0, this.offsetMs / 1000);
    this.source = src;
    this.playing = true;
    this.startRaf();
    this.emit();
    return true;
  }

  pause() {
    if (!this.playing || !this.ctx) return;
    this.offsetMs = this.computePositionMs();
    try {
      this.source?.stop();
    } catch {
      /* ignore */
    }
    this.source = null;
    this.playing = false;
    this.stopRaf();
    this.emit();
  }

  skip() {
    if (!this.source) return;
    this.offsetMs = 0;
    try {
      this.source.onended = null;
      this.source.stop();
    } catch {
      /* ignore */
    }
    this.source = null;
    this.handleClipEnded();
  }

  stop() {
    try {
      this.source?.stop();
    } catch {
      /* ignore */
    }
    this.source = null;
    this.playing = false;
    this.offsetMs = 0;
    this.current = null;
    this.stopRaf();
    this.emit();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  private handleClipEnded() {
    if (!this.current) return;
    const finished = this.current;
    this.past.push(finished);
    this.onEnded?.(finished);
    this.offsetMs = 0;
    this.current = null;
    if (this.upcoming.length > 0) {
      this.current = this.upcoming.shift() ?? null;
      void this.start();
    } else {
      this.playing = false;
      this.stopRaf();
    }
    this.emit();
  }

  private async ensureBuffer(clip: StudioClip): Promise<AudioBuffer | null> {
    const cached = this.bufferMap.get(clip.id);
    if (cached) return cached;
    const ctx = this.ctx;
    if (!ctx) return null;
    try {
      const bytes = await clipBytesFromDataUrl(clip.dataUrl);
      const buf = await ctx.decodeAudioData(bytes);
      this.bufferMap.set(clip.id, buf);
      return buf;
    } catch {
      return null;
    }
  }

  private computePositionMs(): number {
    if (!this.ctx || !this.playing) return this.offsetMs;
    return Math.min(this.offsetMs + (this.ctx.currentTime * 1000 - this.startedAtMs), this.durationMs());
  }

  private durationMs(): number {
    if (!this.current) return 0;
    return Math.round((this.bufferMap.get(this.current.id)?.duration ?? 0) * 1000);
  }

  private startRaf() {
    if (this.rafId != null) return;
    const tick = () => {
      if (!this.playing) {
        this.rafId = null;
        return;
      }
      this.emit();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopRaf() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private emit() {
    const s = this.state();
    this.listeners.forEach((l) => l(s));
  }

  dispose() {
    this.stop();
    this.listeners.clear();
    this.bufferMap.clear();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
    }
  }
}

export const emptyQueueState: StudioQueueState = empty;

async function clipBytesFromDataUrl(dataUrl: string): Promise<ArrayBuffer> {
  const i = dataUrl.indexOf(",");
  if (i < 0) throw new Error("data URL inválido");
  const b64 = dataUrl.slice(i + 1);
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i2 = 0; i2 < bin.length; i2++) u8[i2] = bin.charCodeAt(i2);
  return buf;
}
