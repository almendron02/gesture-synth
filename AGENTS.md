# Gesture Synth

Gesture Synth is a browser instrument controlled by hand signs captured from a webcam.

## Stack

- React, TypeScript, and Vite
- MediaPipe Hand Landmarker
- Tone.js and the Web Audio API
- Vitest
- Netlify

## Architecture

Keep camera access, hand tracking, gesture recognition, gesture stabilization, music theory, audio, and UI as separate modules under `src/features`.

Sound is a two-hand live gate. A stable exact left-hand chord sign and right-hand voicing sign start a chord; an invalid or missing hand releases it. Never latch chords. The seven left-hand patterns in `gesturePatterns.ts` and four sequential right-hand voicing patterns are valid.

Avoid React state updates for every raw landmark. Draw tracking data directly to canvas and expose only derived diagnostic state to React.

## Required checks

Run these before completing a task:

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
