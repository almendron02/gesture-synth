import { describe, expect, it } from 'vitest'
import { absoluteUrl, buildStructuredData, getRouteSeo, SITE_URL } from './routeSeo'

describe('route SEO metadata', () => {
  it('provides a descriptive, canonical home page', () => {
    const metadata = getRouteSeo('/')

    expect(metadata.title).toBe('Play Chords With Hand Gestures | Gesture Synth')
    expect(absoluteUrl(metadata.canonicalPath)).toBe(`${SITE_URL}/`)
    expect(metadata.robots).toContain('index')
  })

  it('normalizes trailing slashes for static pages', () => {
    expect(getRouteSeo('/learn/')).toEqual(getRouteSeo('/learn'))
  })

  it('describes the studio as a Web MIDI controller', () => {
    const metadata = getRouteSeo('/play')

    expect(metadata.title).toContain('MIDI Controller')
    expect(metadata.description).toContain('Web MIDI')
  })

  it('publishes indexable metadata for the recording and MIDI guide', () => {
    const metadata = getRouteSeo('/guide')

    expect(metadata.title).toContain('Recording and MIDI Guide')
    expect(metadata.schemaType).toBe('LearningResource')
    expect(JSON.stringify(buildStructuredData(metadata))).toContain('Recording and MIDI guide')
  })

  it('builds unique metadata for a guided song', () => {
    const metadata = getRouteSeo('/songs/amazing-grace')

    expect(metadata.title).toContain('Amazing Grace Gesture Tutorial')
    expect(metadata.description).toContain('3-chord')
    expect(metadata.canonicalPath).toBe('/songs/amazing-grace')
    expect(metadata.schemaType).toBe('LearningResource')
  })

  it('marks unknown routes as noindex', () => {
    expect(getRouteSeo('/not-a-page').robots).toBe('noindex, follow')
  })

  it('includes the site, app, page, and breadcrumbs in structured data', () => {
    const data = buildStructuredData(getRouteSeo('/songs/midnight-city')) as { '@graph': object[] }

    expect(data['@graph']).toHaveLength(4)
    expect(JSON.stringify(data)).toContain('BreadcrumbList')
    expect(JSON.stringify(data)).toContain('Guided song practice')
  })
})
