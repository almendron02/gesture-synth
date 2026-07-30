interface StabilizerOptions {
  startDelayMs?: number
  changeDelayMs?: number
  releaseDelayMs?: number
}

interface KeyedGesture {
  key: string
}

export class GestureStabilizer<TGesture extends KeyedGesture> {
  private readonly startDelayMs: number
  private readonly changeDelayMs: number
  private readonly releaseDelayMs: number
  private pending: TGesture | null = null
  private pendingSince = 0
  private invalidSince: number | null = null
  private active: TGesture | null = null

  constructor({ startDelayMs = 60, changeDelayMs = startDelayMs, releaseDelayMs = 500 }: StabilizerOptions = {}) {
    this.startDelayMs = startDelayMs
    this.changeDelayMs = changeDelayMs
    this.releaseDelayMs = releaseDelayMs
  }

  update(candidate: TGesture | null, timestamp: number): TGesture | null {
    if (!candidate) {
      this.pending = null
      if (!this.active) return null
      this.invalidSince ??= timestamp
      if (timestamp - this.invalidSince >= this.releaseDelayMs) this.active = null
      return this.active
    }

    this.invalidSince = null

    if (this.active?.key === candidate.key) {
      this.pending = null
      return this.active
    }

    if (this.pending?.key !== candidate.key) {
      this.pending = candidate
      this.pendingSince = timestamp
      return this.active
    }

    const confirmationDelay = this.active ? this.changeDelayMs : this.startDelayMs
    if (timestamp - this.pendingSince >= confirmationDelay) {
      this.active = candidate
      this.pending = null
    }

    return this.active
  }

  reset(): void {
    this.pending = null
    this.invalidSince = null
    this.active = null
  }
}
