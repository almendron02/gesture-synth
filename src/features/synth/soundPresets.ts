export type SoundPreset = 'original' | 'choir' | 'dream-pad'

export const soundPresetDefinitions: readonly {
  id: SoundPreset
  label: string
  description: string
}[] = [
  { id: 'original', label: 'Original', description: 'Clear triangle synth' },
  { id: 'choir', label: 'Choir', description: 'Soft vowel ensemble' },
  { id: 'dream-pad', label: 'Dream Pad', description: 'Wide ambient pad' },
] as const
