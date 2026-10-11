// A small monochrome mark per Connections provider, for the connection library.
// Renders in `currentColor`, sized by the parent - same pattern as brands.tsx, but keyed by
// connection provider id rather than model id, since the two lists serve different screens.

import type { ReactElement } from 'react'
import {
  siGooglegemini,
  siOpenrouter,
  siMistralai,
  siHuggingface,
  siFigma,
  siStripe,
  siGoogleanalytics,
  siCloudflare,
  siBackblaze,
  siCloudinary,
  siResend,
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

// Simple-icons has no mark for these; a plain, non-trademarked glyph stands in.
const Envelope = svg(<path d="M4 6h16v12H4V6Zm0 0 8 7 8-7m-4 3 4 4" />)
const Cloud = svg(<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 12.1 3.5 3.5 0 0 0 7 18Z" />)
const PaperPlane = svg(<path d="M21 3 3 10.5l7 2.5m11-10L13 20l-3-7m11-10L10 13" />)
const Chip = svg(<path d="M8 8h8v8H8V8Zm2-5v3m4-3v3m-4 12v3m4-3v3M3 10h3m-3 4h3m12-4h3m-3 4h3" />)

/** Keyed by the `id` in electron/connections.ts's `CONNECTION_PROVIDERS`. */
export const CONNECTION_LOGOS: Record<string, (p: LogoProps) => ReactElement> = {
  'opencode-zen': Chip,
  'google-gemini': officialLogo(siGooglegemini),
  openrouter: officialLogo(siOpenrouter),
  mistral: officialLogo(siMistralai),
  huggingface: officialLogo(siHuggingface),
  figma: officialLogo(siFigma),
  stripe: officialLogo(siStripe),
  'google-analytics': officialLogo(siGoogleanalytics),
  'cloudflare-r2': officialLogo(siCloudflare),
  'aws-s3': Cloud,
  'backblaze-b2': officialLogo(siBackblaze),
  cloudinary: officialLogo(siCloudinary),
  resend: officialLogo(siResend),
  sendgrid: PaperPlane,
  postmark: Envelope,
  posthog: officialLogo(siPosthog),
  plausible: officialLogo(siPlausibleanalytics),
  netlify: officialLogo(siNetlify),
  vercel: officialLogo(siVercel),
  render: officialLogo(siRender),
  'cloudflare-pages': officialLogo(siCloudflarepages),
}
