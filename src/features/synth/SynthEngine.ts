import * as Tone from 'tone'
import type { Chord } from '../music/chords'
import { planChordTransition } from './planChordTransition'
import type { SoundPreset } from './soundPresets'

const CHORD_FADE_SECONDS = 0.3
const PRESET_CROSSFADE_SECONDS = 0.35

interface DisposableAudioNode {
  dispose(): unknown
}

interface PresetVoice {
  synths: Tone.PolySynth<Tone.Synth>[]
  gain: Tone.Gain
  effects: DisposableAudioNode[]
}

export class SynthEngine {
  private voices: Partial<Record<SoundPreset, PresetVoice>> = {}
  private filter: Tone.Filter | null = null
  private masterGain: Tone.Gain | null = null
  private reverb: Tone.Reverb | null = null
  private activeNotes: string[] = []
  private activePreset: SoundPreset = 'original'
  private ready = false

  async start(): Promise<void> {
    await Tone.start()
    if (!this.filter) {
      this.filter = new Tone.Filter({ frequency: 2100, type: 'lowpass', rolloff: -24 })
      this.masterGain = new Tone.Gain(0.42)
      this.reverb = new Tone.Reverb({ decay: 3.1, preDelay: 0.045, wet: this.reverbWetFor(this.activePreset) }).toDestination()
      this.masterGain.connect(this.filter)
      this.filter.connect(this.reverb)
      this.voices = {
        original: this.createOriginalVoice(),
        choir: this.createChoirVoice(),
        'dream-pad': this.createDreamPadVoice(),
      }
    }
    this.ready = true
  }

  play(chord: Chord): void {
    const voice = this.voices[this.activePreset]
    if (!this.ready || !voice) return
    const now = Tone.now()
    const transition = planChordTransition(this.activeNotes, chord.notes)
    voice.synths.forEach((synth) => {
      if (transition.leaving.length) synth.triggerRelease(transition.leaving, now)
      if (transition.entering.length) synth.triggerAttack(transition.entering, now + 0.005, 0.72)
    })
    this.activeNotes = [...chord.notes]
  }

  setPreset(preset: SoundPreset): void {
    if (preset === this.activePreset) return
    const previousPreset = this.activePreset
    this.activePreset = preset
    if (!this.ready) return

    const previousVoice = this.voices[previousPreset]
    const nextVoice = this.voices[preset]
    if (!previousVoice || !nextVoice) return

    const now = Tone.now()
    nextVoice.gain.gain.cancelScheduledValues(now)
    previousVoice.gain.gain.cancelScheduledValues(now)
    nextVoice.gain.gain.rampTo(1, PRESET_CROSSFADE_SECONDS)
    previousVoice.gain.gain.rampTo(0, PRESET_CROSSFADE_SECONDS)
    this.reverb?.wet.rampTo(this.reverbWetFor(preset), PRESET_CROSSFADE_SECONDS)

    if (this.activeNotes.length) {
      nextVoice.synths.forEach((synth) => {
        synth.releaseAll(now)
        synth.triggerAttack(this.activeNotes, now + 0.005, 0.66)
      })
      previousVoice.synths.forEach((synth) => synth.triggerRelease(this.activeNotes, now + PRESET_CROSSFADE_SECONDS))
    }
  }

  release(): void {
    const now = Tone.now()
    Object.values(this.voices).forEach((voice) => voice?.synths.forEach((synth) => synth.releaseAll(now)))
    this.activeNotes = []
  }

  setVolume(value: number): void {
    if (!this.masterGain) return
    const safeValue = Math.max(0.001, Math.min(1, value))
    this.masterGain.gain.rampTo(safeValue, 0.08)
  }

  setBrightness(value: number): void {
    if (!this.filter) return
    const normalized = Math.max(0, Math.min(1, value))
    const frequency = 520 * Math.pow(8.5, normalized)
    this.filter.frequency.rampTo(frequency, 0.09)
  }

  dispose(): void {
    this.release()
    Object.values(this.voices).forEach((voice) => {
      voice?.synths.forEach((synth) => synth.dispose())
      voice?.gain.dispose()
      voice?.effects.forEach((effect) => effect.dispose())
    })
    this.filter?.dispose()
    this.masterGain?.dispose()
    this.reverb?.dispose()
    this.voices = {}
    this.filter = null
    this.masterGain = null
    this.reverb = null
    this.activeNotes = []
    this.ready = false
  }

  private createOriginalVoice(): PresetVoice {
    const gain = this.createPresetGain('original')
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.055, decay: 0.22, sustain: 0.56, release: CHORD_FADE_SECONDS },
    }).connect(gain)
    synth.volume.value = -8
    return { synths: [synth], gain, effects: [] }
  }

  private createChoirVoice(): PresetVoice {
    const gain = this.createPresetGain('choir')
    const formantBus = new Tone.Gain(0.78)
    const formantLow = new Tone.Filter({ type: 'bandpass', frequency: 800, Q: 3.2 })
    const formantMid = new Tone.Filter({ type: 'bandpass', frequency: 1150, Q: 4 })
    const formantHigh = new Tone.Filter({ type: 'bandpass', frequency: 2900, Q: 5.5 })
    const formantLowLevel = new Tone.Gain(1)
    const formantMidLevel = new Tone.Gain(0.72)
    const formantHighLevel = new Tone.Gain(0.26)
    const bodyFilter = new Tone.Filter({ type: 'lowpass', frequency: 1750, rolloff: -12 })
    const bodyLevel = new Tone.Gain(0.24)
    const vibrato = new Tone.Vibrato({ frequency: 5.1, depth: 0.075, wet: 0.48, maxDelay: 0.005, type: 'sine' })
    const chorus = new Tone.Chorus({ frequency: 0.82, delayTime: 4.4, depth: 0.62, spread: 165, wet: 0.52 }).start()
    const vowelSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 9 },
      envelope: { attack: 0.11, decay: 0.36, sustain: 0.74, release: CHORD_FADE_SECONDS },
    })
    const bodySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', count: 3, spread: 10 },
      envelope: { attack: 0.16, decay: 0.42, sustain: 0.68, release: CHORD_FADE_SECONDS },
    })

    vowelSynth.connect(formantLow)
    vowelSynth.connect(formantMid)
    vowelSynth.connect(formantHigh)
    formantLow.chain(formantLowLevel, formantBus)
    formantMid.chain(formantMidLevel, formantBus)
    formantHigh.chain(formantHighLevel, formantBus)
    bodySynth.chain(bodyFilter, bodyLevel, formantBus)
    formantBus.chain(vibrato, chorus, gain)

    vowelSynth.volume.value = -13
    bodySynth.volume.value = -15
    return {
      synths: [vowelSynth, bodySynth],
      gain,
      effects: [
        formantBus,
        formantLow,
        formantMid,
        formantHigh,
        formantLowLevel,
        formantMidLevel,
        formantHighLevel,
        bodyFilter,
        bodyLevel,
        vibrato,
        chorus,
      ],
    }
  }

  private createDreamPadVoice(): PresetVoice {
    const gain = this.createPresetGain('dream-pad')
    const chorus = new Tone.Chorus({ frequency: 0.34, delayTime: 5.2, depth: 0.55, spread: 180, wet: 0.38 }).start()
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fattriangle', count: 4, spread: 28 },
      envelope: { attack: 0.18, decay: 0.5, sustain: 0.68, release: CHORD_FADE_SECONDS },
    })
    synth.chain(chorus, gain)
    synth.volume.value = -12
    return { synths: [synth], gain, effects: [chorus] }
  }

  private createPresetGain(preset: SoundPreset): Tone.Gain {
    const gain = new Tone.Gain(preset === this.activePreset ? 1 : 0)
    gain.connect(this.masterGain!)
    return gain
  }

  private reverbWetFor(preset: SoundPreset): number {
    if (preset === 'choir') return 0.5
    if (preset === 'dream-pad') return 0.36
    return 0.2
  }
}
