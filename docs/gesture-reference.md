# Gesture reference

## Left hand: chord selection

Finger order is thumb, index, middle, ring, pinky. Only the exact patterns below are valid.

| Degree | Pattern | Sign |
| --- | --- | --- |
| I | `01000` | Index |
| II | `01100` | Index + middle |
| III | `01110` | Index + middle + ring |
| IV | `01111` | Four fingers, thumb closed |
| V | `11111` | Open palm |
| VI | `01001` | Rock sign |
| VII | `11001` | Rock sign + thumb |

Rotate the left hand slightly inward for major or outward for minor. The studio sensitivity control changes the neutral zone, and **Set neutral** compensates for the resting camera angle.

## Right hand: chord shaping

| Melodic fingers | Voicing |
| --- | --- |
| Index | Root position |
| Index + middle | First inversion |
| Index + middle + ring | Seventh chord |
| Four fingers, thumb closed | Color seventh |

The right thumb is independent of voicing. Extend it alongside any valid sign to transpose the entire chord down one octave.

Right-hand height controls expression volume. Right-hand rotation controls filter brightness.

## Live-gate behavior

- A stable complete two-hand sign starts a chord.
- The same sign keeps the chord alive without retriggering it.
- A new valid sign transitions directly to the new chord.
- An invalid or missing sign eventually releases the chord.
- There is no separate silence gesture and chords never latch permanently.
