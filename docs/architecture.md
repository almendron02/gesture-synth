# Architecture

Gesture Synth separates camera access, vision processing, musical interpretation, audio, and interface code so each system can be tested and tuned independently.

## Runtime pipeline

```text
Webcam frame
  → MediaPipe Hand Landmarker
  → Motion-adaptive landmark smoothing
  → Left and right hand classification
  → Exact finger-pattern matching
  → Rotation and expression calculation
  → Gesture stabilization
  → Chord and voicing construction
  → Tone.js transition planning
  → Web Audio output
```

The camera frame also feeds a Canvas overlay. React receives only derived diagnostic state instead of every raw landmark, preventing high-frequency camera updates from continuously rerendering the interface.

## Feature boundaries

```text
src/features/
├── camera/          Browser permission and MediaStream lifecycle
├── hand-tracking/   MediaPipe initialization, smoothing, and overlay drawing
├── gestures/        Finger geometry, exact signs, tilt, and stabilization
├── music/           Chord construction and music-theory mapping
├── songs/           Tutorial metadata, chords, and cue timelines
└── synth/           Tone.js voices, effects, and chord transitions
```

## Gesture state

The audio system is a live gate:

1. A complete two-hand gesture becomes a candidate.
2. A first gesture is confirmed after a short stability window.
3. A different valid gesture uses a faster replacement window.
4. Shared notes remain sustained during the chord transition.
5. If recognition disappears, the current chord is briefly held before release.

Gesture recognition and audio generation remain separate. The stabilizer emits musical intent; the synth engine converts that intent into notes and transitions.

## Audio voices

- **Original** uses a responsive triangle-based polyphonic synth.
- **Choir** combines vowel-formant bands, a body layer, vibrato, chorus, and reverb.
- **Dream Pad** uses a wide detuned triangle voice with chorus and a soft envelope.

Preset switching crossfades voices without interrupting the active gesture. Chord changes use set differences so common notes are not retriggered.

## Testing focus

Unit tests cover exact gesture patterns, finger geometry behavior, hand classification, gesture stabilization, landmark smoothing, chord construction, song data integrity, and audio transition planning. Camera and Web Audio integrations are validated through the production build and manual browser testing.
