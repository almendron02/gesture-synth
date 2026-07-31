import { describe, expect, it } from 'vitest'
import { createComposition } from './composition'
import { parseComposition } from './composerStorage'

describe('composer storage', () => {
  it('accepts a valid composition', () => {
    const composition = createComposition(new Date('2026-07-31T12:00:00.000Z'))
    expect(parseComposition(JSON.stringify(composition))).toEqual(composition)
  })

  it('rejects malformed projects and unknown versions', () => {
    const composition = createComposition()
    expect(parseComposition('{broken')).toBeNull()
    expect(parseComposition(JSON.stringify({ ...composition, version: 2 }))).toBeNull()
    expect(parseComposition(JSON.stringify({ ...composition, tracks: [] }))).toBeNull()
  })
})
