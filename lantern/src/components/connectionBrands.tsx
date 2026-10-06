// A small monochrome mark per Connections provider, for the library grid and ticker.
// Renders in `currentColor`, sized by the parent - same pattern as brands.tsx, but keyed by
// connection provider id rather than model id, since the two lists serve different screens.

import type { ReactElement } from 'react'
import {
  siGooglegemini,
  siOpenrouter,
  siMistralai,
  siHuggingface,
  siBluesky,
  siBrevo,
  siBunnydotnet,
  siCarrd,
  siFedex,
  siFigma,
  siFramer,
  siHelpscout,
  siItchdotio,
  siKlarna,
  siKofi,
  siMatomo,
  siPexels,
  siRedbubble,
  siReddit,
  siRevolut,
  siSellfy,
  siTumblr,
  siUps,
  siWebflow,
  siYoutube,
  siStripe,
  siPaypal,
  siSquare,
  siShopify,
  siWoocommerce,
  siBigcommerce,
  siEtsy,
  siEbay,
  siPinterest,
  siMeta,
  siTiktok,
  siX,
  siMailchimp,
  siDiscord,
  siGoogleanalytics,
  siCloudflare,
  siBackblaze,
  siCloudinary,
  siGumroad,
  siWix,
  siSquarespace,
  siBigcartel,
  siRazorpay,
  siAdyen,
  siDhl,
  siResend,
  siKit,
  siZendesk,
  siIntercom,
  siUnsplash,
  siPosthog,
  siPlausibleanalytics,
  siNetlify,
  siVercel,
  siRender,
  siCloudflarepages,
} from 'simple-icons'

type LogoProps = { className?: string; title?: string }

const officialLogo = (icon: { path: string; title: string }) => (p: LogoProps) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="currentColor" aria-hidden>
    <title>{p.title ?? icon.title}</title>
    <path d={icon.path} />
  </svg>
)

const svg = (children: ReactElement) => (p: LogoProps) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <title>{p.title}</title>
    {children}
  </svg>
)

// Simple-icons has no mark for these; a plain, non-trademarked glyph stands in, same as the
// hand-drawn ones in brands.tsx for companies without an official icon there.
const Box = svg(<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9ZM3 7.5 12 12m0 9v-9m9-4.5L12 12" />)
const Printer = svg(<path d="M6 9V3h12v6M6 18h12v3H6v-3ZM4 9h16v7H4V9Zm3 2h2M4 13h16" />)
const ShippingBox = svg(<path d="M3 8h13v10H3V8Zm13 2 5-2v8l-5 2M3 12h13M8 8V5h5l3 3" />)
const Envelope = svg(<path d="M4 6h16v12H4V6Zm0 0 8 7 8-7m-4 3 4 4" />)
const Cloud = svg(<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 12.1 3.5 3.5 0 0 0 7 18Z" />)
const Repeat = svg(<path d="M4 7h11a4 4 0 0 1 4 4v1M20 17H9a4 4 0 0 1-4-4v-1M8 4 4 7l4 3M16 20l4-3-4-3" />)
const Tag = svg(<path d="m12 3 8 8-9 9-8-8V3h9Z M8.5 7.5h.01" />)
const Globe = svg(<path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />)
const PaperPlane = svg(<path d="M21 3 3 10.5l7 2.5m11-10L13 20l-3-7m11-10L10 13" />)
const ChatBubble = svg(<path d="M4 5h16v11H8l-4 4V5Z" />)
const Palette = svg(<path d="M12 3a9 8 0 1 0 0 16c1.1 0 1.6-.8 1.1-1.7-.3-.6.1-1.3.9-1.3H16a4 4 0 0 0 4-4c0-5-3.6-9-8-9Z M7 11h.01M9.5 8h.01M14.5 8h.01M17 11h.01" />)

const Stripe = officialLogo(siStripe)
const PayPal = officialLogo(siPaypal)
const Square = officialLogo(siSquare)
const Shopify = officialLogo(siShopify)
const WooCommerce = officialLogo(siWoocommerce)
const BigCommerce = officialLogo(siBigcommerce)
const Etsy = officialLogo(siEtsy)
const Ebay = officialLogo(siEbay)
const Pinterest = officialLogo(siPinterest)
const Meta = officialLogo(siMeta)
const TikTok = officialLogo(siTiktok)
const X = officialLogo(siX)
const Mailchimp = officialLogo(siMailchimp)
const Discord = officialLogo(siDiscord)
const GoogleAnalytics = officialLogo(siGoogleanalytics)
const Cloudflare = officialLogo(siCloudflare)
const Backblaze = officialLogo(siBackblaze)
const Cloudinary = officialLogo(siCloudinary)
const Gumroad = officialLogo(siGumroad)
const Wix = officialLogo(siWix)
const Squarespace = officialLogo(siSquarespace)
const BigCartel = officialLogo(siBigcartel)
const Razorpay = officialLogo(siRazorpay)
const Adyen = officialLogo(siAdyen)
const Dhl = officialLogo(siDhl)
const Resend = officialLogo(siResend)
const Kit = officialLogo(siKit)
const Zendesk = officialLogo(siZendesk)
const Intercom = officialLogo(siIntercom)
const Unsplash = officialLogo(siUnsplash)
const PostHog = officialLogo(siPosthog)
const Plausible = officialLogo(siPlausibleanalytics)
const Netlify = officialLogo(siNetlify)
const Vercel = officialLogo(siVercel)
const Render = officialLogo(siRender)
const CloudflarePages = officialLogo(siCloudflarepages)

const Bluesky = officialLogo(siBluesky)
const Brevo = officialLogo(siBrevo)
const Bunnydotnet = officialLogo(siBunnydotnet)
const Carrd = officialLogo(siCarrd)
const Fedex = officialLogo(siFedex)
const Figma = officialLogo(siFigma)
const Framer = officialLogo(siFramer)
const Helpscout = officialLogo(siHelpscout)
const Itchdotio = officialLogo(siItchdotio)
const Klarna = officialLogo(siKlarna)
const Kofi = officialLogo(siKofi)
const Matomo = officialLogo(siMatomo)
const Pexels = officialLogo(siPexels)
const Redbubble = officialLogo(siRedbubble)
const Reddit = officialLogo(siReddit)
const Revolut = officialLogo(siRevolut)
const Sellfy = officialLogo(siSellfy)
const Tumblr = officialLogo(siTumblr)
const Ups = officialLogo(siUps)
const Webflow = officialLogo(siWebflow)
const Youtube = officialLogo(siYoutube)
const Chart = svg(<path d="M4 20V10m6 10V4m6 16v-7m4 7H3" />)
const LinkedIn = svg(<path d="M4 4h16v16H4V4Zm4 6v7m0-10.5v.01M12 17v-7m0 3c0-2 4-3 4 0v4" />)

const GoogleGemini = officialLogo(siGooglegemini)
const OpenRouter = officialLogo(siOpenrouter)
const Mistral = officialLogo(siMistralai)
const HuggingFace = officialLogo(siHuggingface)
const Chip = svg(<path d="M8 8h8v8H8V8Zm2-5v3m4-3v3m-4 12v3m4-3v3M3 10h3m-3 4h3m12-4h3m-3 4h3" />)

/** Keyed by the `id` in electron/connections.ts's `CONNECTION_PROVIDERS`. */
export const CONNECTION_LOGOS: Record<string, (p: LogoProps) => ReactElement> = {
  'opencode-zen': Chip,
  'google-gemini': GoogleGemini,
  openrouter: OpenRouter,
  mistral: Mistral,
  huggingface: HuggingFace,
  affirm: Tag,
  amplitude: Chart,
  bluesky: Bluesky,
  brevo: Brevo,
  'bunny-net': Bunnydotnet,
  carrd: Carrd,
  contrado: Printer,
  customerio: Envelope,
  fedex: Fedex,
  figma: Figma,
  framer: Framer,
  freshdesk: ChatBubble,
  gelato: Printer,
  helpscout: Helpscout,
  icelolly: Globe,
  imgbb: Cloud,
  'itch-io': Itchdotio,
  klarna: Klarna,
  'ko-fi': Kofi,
  linkedin: LinkedIn,
  matomo: Matomo,
  pexels: Pexels,
  postmark: Envelope,
  redbubble: Redbubble,
  reddit: Reddit,
  revolut: Revolut,
  sellfy: Sellfy,
  shipbob: ShippingBox,
  shutterstock: Palette,
  teelaunch: Printer,
  tidio: ChatBubble,
  tumblr: Tumblr,
  ups: Ups,
  webflow: Webflow,
  youtube: Youtube,
  stripe: Stripe,
  paypal: PayPal,
  square: Square,
  shopify: Shopify,
  woocommerce: WooCommerce,
  bigcommerce: BigCommerce,
  etsy: Etsy,
  ebay: Ebay,
  amazon: Box,
  printify: Printer,
  printful: Printer,
  shippo: ShippingBox,
  pinterest: Pinterest,
  meta: Meta,
  tiktok: TikTok,
  x: X,
  mailchimp: Mailchimp,
  klaviyo: Envelope,
  discord: Discord,
  'google-analytics': GoogleAnalytics,
  'cloudflare-r2': Cloudflare,
  'aws-s3': Cloud,
  'backblaze-b2': Backblaze,
  cloudinary: Cloudinary,
  gumroad: Gumroad,
  wix: Wix,
  squarespace: Squarespace,
  bigcartel: BigCartel,
  razorpay: Razorpay,
  adyen: Adyen,
  gocardless: Repeat,
  shipstation: Tag,
  easyship: Globe,
  dhl: Dhl,
  resend: Resend,
  sendgrid: PaperPlane,
  kit: Kit,
  crisp: ChatBubble,
  zendesk: Zendesk,
  intercom: Intercom,
  canva: Palette,
  unsplash: Unsplash,
  posthog: PostHog,
  plausible: Plausible,
  netlify: Netlify,
  vercel: Vercel,
  render: Render,
  'cloudflare-pages': CloudflarePages,
}
