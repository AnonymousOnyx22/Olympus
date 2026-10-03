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

  it('prefers vector art and watermark checks over blindly trusting an AI image call', () => {
    const brief = buildStationBrief({ name: 'Sticker Co.', request: 'Sell sticker packs' })
    expect(brief).toContain('write it as real SVG markup yourself')
    expect(brief).toContain('UNSPLASH_ACCESS_KEY')
    expect(brief).toContain('check the corners of the image for a visible text or logo watermark')
    expect(brief).toContain('a watermarked result is not usable artwork')
    expect(brief).toContain('always also render a .png copy')
  })

  it('steers simple commodity products toward the fastest real platform instead of a custom build', () => {
    const brief = buildStationBrief({ name: '', request: 'Sell sticker packs' })
    expect(brief).toContain('prefer the fastest path to something genuinely live over hand-building a custom storefront')
    expect(brief).toContain('Printify or Printful')
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
