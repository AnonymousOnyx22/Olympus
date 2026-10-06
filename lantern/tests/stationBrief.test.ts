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

  it('forbids invented social proof and generic template output in the storefront', () => {
    const brief = buildStationBrief({ name: 'Sticker Co.', request: 'Sell stickers' })
    expect(brief).toContain('Never invent social proof or scarcity')
    expect(brief).toContain('no "best seller", "popular" or "trending" badges')
    expect(brief).toContain('Do not repeat the same block of content twice on a page')
    expect(brief).toContain('a bundle or set must be marked available whenever its components are')
  })

  it('demands a real, human, interactive selling site and bans invented social proof', () => {
    const brief = buildStationBrief({ name: 'Sticker Co.', request: 'Sell stickers' })
    expect(brief).toContain('no em dashes and no semicolons anywhere in the copy')
    expect(brief).toContain('a real selling site, not two pages')
    expect(brief).toContain('smooth page and tab transitions')
    expect(brief).toContain('loop without gaps or jumps')
    expect(brief).toContain('Never invent social proof or scarcity')
    expect(brief).toContain('a bundle must show as available whenever its parts are')
  })

  it('picks ideas from evidence, keeps a memory log, and never promises income', () => {
    const brief = buildStationBrief({ name: '', request: 'Build me a store' })
    expect(brief).toContain('choose it with evidence, not taste')
    expect(brief).toContain('STORE-LOG.md')
    expect(brief).toContain('Never promise or imply income')
  })

  it('runs a continuous idea and testing loop in the 24/7 pass without inventing numbers', () => {
    const check = buildStationCheckBrief()
    expect(check).toContain('Keep STORE-LOG.md current as the memory of this store')
    expect(check).toContain('run the idea pipeline')
    expect(check).toContain('with a stated hypothesis and a date to judge it')
    expect(check).toContain('never invent numbers, and never claim the store is earning')
  })

  it('only builds stores that run hands-off, with fulfilment, support and disputes automated', () => {
    const brief = buildStationBrief({ name: '', request: 'Build me a store' })
    expect(brief).toContain('The store must run with no work from the owner, ever')
    expect(brief).toContain('print on demand, digital downloads, or dropshipping through a supplier with an order API')
    expect(brief).toContain('Handle disputes yourself too')
    expect(brief).toContain('one short list rather than interrupting them one item at a time')
  })

  it('requires a real supply chain and hosting before calling a store done', () => {
    const brief = buildStationBrief({ name: '', request: 'Build me a store' })
    expect(brief).toContain('Drawing artwork is not a supply chain')
    expect(brief).toContain('Printful, Printify, or Gelato')
    expect(brief).toContain('price every item above cost plus shipping, payment fees and a margin')
    expect(brief).toContain('NETLIFY_AUTH_TOKEN')
    expect(brief).toContain('Never describe a store as live, shipping, or earning when it only runs on this computer')
  })

  it('builds on Shopify only when that store can really sell, without its own checkout', () => {
    const brief = buildStationBrief({ name: '', request: 'Build me a store' })
    expect(brief).toContain('If, and only if, the Shopify store can really sell')
    expect(brief).toContain('do not build your own checkout or add Stripe')
    expect(brief).toContain("use Shopify's staged uploads")
    expect(brief).toContain('a store with no traffic earns nothing')
  })

  it('ranks digital downloads first and avoids marketplace dropshipping', () => {
    const brief = buildStationBrief({ name: '', request: 'Build me a store' })
    expect(brief).toContain('digital downloads first')
    expect(brief).toContain('avoid marketplace dropshipping')
    expect(brief).toContain('Read STORE-PLAN.md')
  })

  it('defaults to a free-to-run stack and only uses Shopify when it can really sell', () => {
    const brief = buildStationBrief({ name: '', request: 'Build me a store' })
    expect(brief).toContain('The free route comes first')
    expect(brief).toContain('creates the order through the Printful API directly')
    expect(brief).toContain('a trial or development store cannot take real orders')
  })

  it('offers every business model and design theme and forbids repeating a theme', async () => {
    const { BUSINESS_MODELS, STORE_THEMES } = await import('../src/services/storeModels')
    const brief = buildStationBrief({ name: '', request: 'Build me a store' })
    for (const model of BUSINESS_MODELS) expect(brief).toContain(model.name)
    for (const theme of STORE_THEMES) expect(brief).toContain(theme.name)
    expect(brief).toContain('do not reuse a theme another store already has')
    expect(brief).toContain('never assume or promise that income')
    expect(BUSINESS_MODELS.length).toBeGreaterThanOrEqual(8)
    expect(STORE_THEMES.length).toBeGreaterThanOrEqual(12)
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
