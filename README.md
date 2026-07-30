# Gesture Synth

**A two-hand browser instrument powered by computer vision.**

Gesture Synth turns live webcam hand signs into chords. The left hand selects the harmony and its major or minor quality; the right hand controls voicing, octave, volume, and brightness. Everything runs locally in the browser—camera frames are never uploaded or stored.

## Highlights

- Two-hand tracking with 21 MediaPipe landmarks per hand
- Seven exact left-hand chord signs with adjustable rotation sensitivity
- Four right-hand voicings plus a thumb-controlled lower octave
- Original, Choir, and Dream Pad sound presets
- Smooth chord transitions that preserve shared notes
- Guided song lessons with two-hand diagrams and lyric or beat-aligned changes
- Motion-adaptive landmark smoothing and gesture hysteresis
- Responsive audio changes with fast replacement confirmation
- No backend, account, or camera upload

## How the instrument works

| Hand | Gesture | Result |
| --- | --- | --- |
| Left | 1–5 fingers, rock sign, or rock sign + thumb | Selects degrees I–VII |
| Left | Rotate inward / outward | Major / minor quality |
| Right | 1 finger | Root position |
| Right | 2 fingers | First inversion |
| Right | 3 fingers | Major or minor seventh |
| Right | 4 fingers | Dominant or diminished color seventh |
| Right | Thumb extended | One octave down |
| Right | Move vertically | Expression volume |
| Right | Rotate | Filter brightness |

Both exact signs must be visible for a chord to sound. A new valid gesture is confirmed quickly and transitions directly from the current chord. If tracking disappears completely, the last chord is held for 0.5 seconds and then fades over 0.3 seconds.

## Guided songs

The first tutorial pack contains:

- **Amazing Grace** — Choir · Beginner
- **Midnight City** — Dream Pad · Beginner–Intermediate
- **Enjoy the Silence** — Original · Intermediate
- **Everything in Its Right Place** — Choir · Advanced

Public-domain material can include lyric-synced cues. Copyrighted songs use section and beat cues with playable gesture arrangements; licensed lyrics are not bundled with the project.

## Technology

- React 19, TypeScript, and Vite
- MediaPipe Hand Landmarker
- Tone.js and the Web Audio API
- HTML Canvas
- Vitest and Oxlint
- Netlify

The full processing pipeline and module boundaries are documented in [docs/architecture.md](docs/architecture.md). The exact left- and right-hand controls are documented in [docs/gesture-reference.md](docs/gesture-reference.md).

## Run locally

### Requirements

- Node.js 22
- A webcam
- A modern desktop browser

```bash
npm install
npm run dev
```

Open the local Vite URL, visit **Play**, select **Start camera**, and allow camera access. Browser audio must be started through a user interaction, so the studio initializes sound from the same action.

## Quality checks

```bash
npm run check
```

This runs linting, TypeScript validation, the test suite, and the production build. Individual commands are also available:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

GitHub Actions runs the same checks on pushes and pull requests.

## Privacy and browser permissions

- Camera processing stays on the device.
- Video is not recorded, uploaded, or stored.
- No microphone permission is requested.
- Camera access requires HTTPS in production; `localhost` is allowed during development.
- Stopping the studio releases active notes and camera tracks.

## Deploy to Netlify

The repository includes a production-ready [`netlify.toml`](netlify.toml).

1. Import the GitHub repository into Netlify.
2. Set `main` as the production branch.
3. Netlify runs `npm run build` and publishes `dist`.
4. SPA redirects, security headers, and cache rules are applied automatically.

## Project status

The free-play studio, two-hand controls, sound presets, Learn guide, and first guided-song pack are implemented. Future work can add camera-driven lesson scoring, recording, MIDI export, and more licensed tutorial content.

## Content notice

Song titles, artist names, and supplied artwork remain the property of their respective owners. They are used here only to identify tutorial material. This repository does not include commercial recordings or unlicensed commercial lyrics.
