const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const mime of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

export type ChunkHandler = (
  blob: Blob,
  mimeType: string,
) => void | Promise<void>;
export type ErrorHandler = (err: unknown) => void;

export class ChunkedRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType: string | undefined;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private restarting = false;
  private pendingFlushResolves: Array<() => void> = [];

  constructor(
    private readonly chunkSeconds: number,
    private readonly onChunk: ChunkHandler,
    private readonly onError: ErrorHandler,
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.onError(err);
      throw err;
    }
    this.mimeType = pickMimeType();
    this.running = true;
    this.startRecorder();
    // startRecorder flips running=false + calls onError if MediaRecorder ctor
    // throws; stop() also relies on running being true. If it failed, release
    // the mic stream so the browser's "in use" indicator goes off.
    if (!this.running) {
      this.releaseStream();
      throw new Error("Failed to initialize MediaRecorder");
    }
    this.tickTimer = setInterval(() => this.rotate(), this.chunkSeconds * 1000);
  }

  private releaseStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  stop(): void {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        // ignore — we're tearing down
      }
    }
    this.releaseStream();
    this.recorder = null;
    // Resolve any callers waiting on a flush that will never complete.
    this.resolveFlushes();
  }

  /**
   * Force-emit the current audio buffer as a chunk immediately, without
   * waiting for the next 30s tick. Resolves after the chunk has been handed
   * to onChunk and the handler (possibly async — e.g. a transcription call)
   * has completed. Used by the manual Refresh button so suggestions can
   * reflect whatever was just said.
   */
  flush(): Promise<void> {
    if (!this.running || !this.recorder) return Promise.resolve();
    if (this.recorder.state !== "recording") return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.pendingFlushResolves.push(resolve);
      if (this.pendingFlushResolves.length > 1) return; // piggyback
      this.restarting = true;
      try {
        this.recorder!.stop();
      } catch (err) {
        this.onError(err);
        this.resolveFlushes();
      }
    });
  }

  private resolveFlushes(): void {
    const pending = this.pendingFlushResolves;
    this.pendingFlushResolves = [];
    pending.forEach((r) => r());
  }

  private startRecorder(): void {
    if (!this.stream) return;
    const options: MediaRecorderOptions = this.mimeType
      ? { mimeType: this.mimeType }
      : {};
    try {
      this.recorder = new MediaRecorder(this.stream, options);
    } catch (err) {
      this.onError(err);
      this.running = false;
      return;
    }
    this.chunks = [];
    const activeMime = this.recorder.mimeType || this.mimeType || "audio/webm";
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => {
      const buffered = this.chunks;
      this.chunks = [];
      // Restart the recorder immediately so no audio is lost during the gap
      // while the onChunk handler (transcription) runs asynchronously.
      if (this.running && this.restarting) {
        this.restarting = false;
        this.startRecorder();
      }
      if (buffered.length === 0) {
        this.resolveFlushes();
        return;
      }
      const blob = new Blob(buffered, { type: activeMime });
      if (blob.size === 0) {
        this.resolveFlushes();
        return;
      }
      // onChunk may be async (transcription). Resolve pending flushes only
      // after it settles so callers awaiting flush() see the transcript.
      Promise.resolve()
        .then(() => this.onChunk(blob, activeMime))
        .catch((err) => this.onError(err))
        .finally(() => this.resolveFlushes());
    };
    this.recorder.onerror = (e) => this.onError(e);
    this.recorder.start();
    // Log once for Safari debugging
    if (typeof console !== "undefined") {
      console.info("[recorder] started with mimeType:", this.recorder.mimeType);
    }
  }

  private rotate(): void {
    if (!this.running || !this.recorder) return;
    if (this.recorder.state !== "recording") return;
    this.restarting = true;
    try {
      this.recorder.stop();
    } catch (err) {
      this.onError(err);
    }
  }
}
