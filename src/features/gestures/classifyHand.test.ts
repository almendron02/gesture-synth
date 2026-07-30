import { describe, expect, it } from 'vitest'
import { classifyTilt } from './classifyHand'

describe('classifyTilt', () => {
  it('uses a small configurable neutral zone', () => {
    expect(classifyTilt(4.8, 'Left', 5)).toBe('neutral')
    expect(classifyTilt(5.2, 'Left', 5)).toBe('inward')
    expect(classifyTilt(-5.2, 'Left', 5)).toBe('outward')
  })

  it('mirrors inward and outward directions for the right hand', () => {
    expect(classifyTilt(-5.2, 'Right', 5)).toBe('inward')
    expect(classifyTilt(5.2, 'Right', 5)).toBe('outward')
  })
})
