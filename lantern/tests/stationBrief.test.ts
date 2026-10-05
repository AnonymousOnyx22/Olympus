import { describe, expect, it } from 'vitest'
import { buildStationBrief, buildStationCheckBrief } from '../src/services/stationBrief'

describe('Station store brief', () => {
  it('keeps a custom Etsy request and does not promise live listings', () => {
    const brief = buildStationBrief({ name: 'Bookish Stickers', request: 'Make ten cozy book lover stickers on Etsy and use Canva artwork' })
    expect(brief).toContain('Make ten cozy book lover stickers on Etsy and use Canva artwork')
    expect(brief).toContain('treat it as the target and build for it')
    expect(brief).toContain('Do not claim to have connected, authenticated with, or published to any third-party service unless a connection for it has actually been provided')
    expect(brief).toContain('Never claim a store, listing, design, or checkout is live unless you have verified it')
  })

  it('requests a working checkout for a standalone store', () => {
    const brief = buildStationBrief({ name: 'Trail Tees', request: 'Sell illustrated hiking shirts with Stripe checkout' })
    expect(brief).toContain('Sell illustrated hiking shirts with Stripe checkout')
    expect(brief).toContain('not just write a plan or a mockup')
    expect(brief).toContain('complete every independent step first')
    expect(brief).toContain('not finished until it actually works end to end')
    expect(brief).toContain('walk through the full purchase flow in test mode')
  })

  it('mandates hand-written SVG art and never contradicts itself by also telling the agent to call an image service', () => {
    const brief = buildStationBrief({ name: 'Sticker Co.', request: 'Sell sticker packs' })
    expect(brief).toContain('real SVG markup you compose yourself')
    expect(brief).toContain('Never call an image-generation service')
    expect(brief).toContain('never download stock or generated imagery')
    expect(brief).toContain('always also render a .png copy')
    // The whole point of this test: the brief must not also tell the agent to use an image
    // service somewhere else, which is exactly the self-contradiction two concurrent edits
    // produced here once before.
    expect(brief).not.toContain('UNSPLASH_ACCESS_KEY')
    expect(brief).not.toContain('pollinations')
  })

  it('states the no-image-service policy the same way regardless of whether a store name was given', () => {
    const named = buildStationBrief({ name: 'Sticker Co.', request: 'Sell sticker packs' })
    const unnamed = buildStationBrief({ name: '', request: 'Sell sticker packs' })
    expect(named).toContain('Never call an image-generation service')
    expect(unnamed).toContain('Never call an image-generation service')
  })

  it('steers simple commodity products toward the fastest real platform instead of a custom build', () => {
    const brief = buildStationBrief({ name: '', request: 'Sell sticker packs' })
    expect(brief).toContain('prefer the fastest path to something genuinely live over hand-building a custom storefront')
    expect(brief).toContain('Printify or Printful')
  })

  it('defaults an open-ended request toward something simple enough to run unattended', () => {
    const brief = buildStationBrief({ name: '', request: 'Build me a store, you decide what to sell' })
    expect(brief).toContain('stickers, print-on-demand mugs or apparel, small digital downloads, or a narrow dropshipping niche')
    expect(brief).toContain('managed by one agent running continuously with nobody watching it')
  })

  it('requires the agent to keep its live todo list current as it works', () => {
    for (const text of [buildStationBrief({ name: 'Sticker Co.', request: 'Sell stickers' }), buildStationCheckBrief()]) {
      expect(text).toContain('Keep your todo list true')
      expect(text).toContain('tick items off as they are done (not in a batch at the end)')
    }
  })

  it('tells the agent not to wait forever on a task orphaned by an app restart or crash', () => {
    const brief = buildStationBrief({ name: 'Sticker Co.', request: 'Sell sticker packs' })
    const check = buildStationCheckBrief()
    for (const text of [brief, check]) {
      expect(text).toContain('has been abandoned, not merely slow')
      expect(text).toContain('it will never complete on its own')
    }
  })

  it('tells the 24/7 pass to act on real performance signal, not just fix-and-report', () => {
    const check = buildStationCheckBrief()
    expect(check).toContain('judge it by whatever real signal this store and its connections actually provide')
    expect(check).toContain('When something is clearly not working, change it instead of leaving it as-is')
    expect(check).toContain('When something is clearly working, do more of that')
  })

  it('assigns useful specialist work and bounds recurring management checks', () => {
    const brief = buildStationBrief({ name: '', request: 'Build a sticker store' })
    expect(brief).toContain('delegate independent work')
    expect(brief).toContain('report who is handling which task')
    const check = buildStationCheckBrief()
    expect(check).toContain('actually use the store the way a customer would')
    expect(check).toContain('Fix whatever you find broken in this same pass')
    expect(check).toContain('make one concrete improvement this pass')
    expect(check).toContain('Do not publish, purchase, change live payments')
  })
})
