// Maps a model id to the company that makes it, plus a small monochrome logo.
// Logos render in `currentColor` and are sized and coloured by the parent.

import type { ReactElement } from 'react'
import {
  siAnthropic,
  siClaude,
  siDeepseek,
  siGooglegemini,
  siHuggingface,
  siMetaai,
  siMistralai,
  siNvidia,
  siQwen,
} from 'simple-icons'

type LogoProps = { className?: string; title?: string }
type Brand = { name: string; Logo: (p: LogoProps) => ReactElement }

const svg = (children: ReactElement, extra?: { fill?: boolean }) => (p: LogoProps) => (
  <svg
    viewBox="0 0 24 24"
    className={p.className}
    fill={extra?.fill ? 'currentColor' : 'none'}
    stroke={extra?.fill ? 'none' : 'currentColor'}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <title>{p.title}</title>
    {children}
  </svg>
)

const officialLogo = (icon: { path: string; title: string }) => (p: LogoProps) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="currentColor" aria-hidden>
    <title>{p.title ?? icon.title}</title>
    <path d={icon.path} />
  </svg>
)

// Google — the four-point Gemini spark
const Google = officialLogo(siGooglegemini)
const Claude = officialLogo(siClaude)
// Microsoft — four squares
const Microsoft = svg(
  <>
    <rect x="3" y="3" width="8" height="8" rx="0.5" />
    <rect x="13" y="3" width="8" height="8" rx="0.5" />
    <rect x="3" y="13" width="8" height="8" rx="0.5" />
    <rect x="13" y="13" width="8" height="8" rx="0.5" />
  </>,
  { fill: true },
)
// Meta — the ribbon / infinity wave
const Meta = officialLogo(siMetaai)
// Hugging Face — the smiley
const HuggingFace = officialLogo(siHuggingface)
// OpenAI — the interlocking knot (simplified hexafoil)
const OpenAI = svg(
  <path d="M12 3.2 18.6 7v7L12 17.8 5.4 14V7L12 3.2ZM12 3.2v7M12 10.2 5.4 7M12 10.2 18.6 7M12 10.2v7M12 10.2 5.4 14M12 10.2 18.6 14" strokeWidth={1.6} />,
)
// IBM — stacked bars
const IBM = svg(
  <>
    <path d="M3 5h18M3 9h18M3 13h18M3 17h18" strokeWidth={2.2} />
  </>,
)
// xAI — the X
const xAI = svg(<path d="M4 4l16 16M20 4 4 20" />)
// Mistral — bold letter-mark from bands
const Mistral = officialLogo(siMistralai)
// DeepSeek — stylized wave/whale
const DeepSeek = officialLogo(siDeepseek)
// Qwen — hexagon core
const Qwen = officialLogo(siQwen)
// Cohere — concentric arcs
const Cohere = svg(
  <>
    <path d="M7 9.5c2-1 8-1 10 0M6 14.5c2.5 1.2 9.5 1.2 12 0" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  </>,
)
// Zhipu / GLM — stacked chevrons
const Zhipu = svg(<path d="M5 7l7 4 7-4M5 12l7 4 7-4M5 17l7 4 7-4" strokeWidth={1.8} />)
// 01.AI (Yi) — stylized 0/1
const Yi = svg(
  <>
    <rect x="4" y="4" width="7" height="16" rx="3.5" />
    <path d="M17 4v16" />
  </>,
)
// Nvidia — stylized eye/swirl
const Nvidia = officialLogo(siNvidia)
// Nous / community fine-tunes — a compass rose
const Nous = svg(<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" strokeWidth={1.6} />)
// Anthropic — the starburst
const Anthropic = officialLogo(siAnthropic)
// Generic local model — a chip
const Chip = svg(
  <>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" strokeWidth={1.6} />
  </>,
)

const BRANDS: Record<string, Brand> = {
  google: { name: 'Google', Logo: Google },
  claude: { name: 'Anthropic', Logo: Claude },
  anthropic: { name: 'Anthropic', Logo: Anthropic },
  microsoft: { name: 'Microsoft', Logo: Microsoft },
  meta: { name: 'Meta', Logo: Meta },
  huggingface: { name: 'Hugging Face', Logo: HuggingFace },
  openai: { name: 'OpenAI', Logo: OpenAI },
  ibm: { name: 'IBM', Logo: IBM },
  xai: { name: 'xAI', Logo: xAI },
  mistral: { name: 'Mistral AI', Logo: Mistral },
  deepseek: { name: 'DeepSeek', Logo: DeepSeek },
  qwen: { name: 'Qwen', Logo: Qwen },
  cohere: { name: 'Cohere', Logo: Cohere },
  zhipu: { name: 'Zhipu AI', Logo: Zhipu },
  yi: { name: '01.AI', Logo: Yi },
  nvidia: { name: 'NVIDIA', Logo: Nvidia },
  nous: { name: 'Nous Research', Logo: Nous },
  generic: { name: 'Local model', Logo: Chip },
}

// Ordered most-specific first so e.g. "codellama" hits meta, "codestral" hits mistral.
const RULES: [RegExp, string][] = [
  [/claude|haiku|sonnet|opus/, 'claude'],
  [/anthropic/, 'anthropic'],
  [/deepseek/, 'deepseek'],
  [/qwen|qwq|qvq/, 'qwen'],
  [/gemma|gemini|paligemma/, 'google'],
  [/phi-?\d|phi3|phi4|\bphi\b/, 'microsoft'],
  [/codestral|mixtral|mistral|ministral|magistral|devstral|pixtral/, 'mistral'],
  [/codellama|llama|(?:^|[^a-z])meta[- ]/, 'meta'],
  [/gpt|o1-|o3-|o4-|davinci/, 'openai'],
  [/granite/, 'ibm'],
  [/command|aya|cohere/, 'cohere'],
  [/glm|chatglm|codegeex/, 'zhipu'],
  [/(?:^|[^a-z])yi-?\d|yi-/, 'yi'],
  [/grok/, 'xai'],
  [/nemotron|nvlm|nvidia/, 'nvidia'],
  [/smollm|zephyr|starchat|starcoder/, 'huggingface'],
  [/hermes|nous/, 'nous'],
]

/** Best guess at the company behind a model id, with a monochrome logo. */
export function brandFor(modelId: string): Brand {
  const id = modelId.toLowerCase()
  for (const [re, key] of RULES) if (re.test(id)) return BRANDS[key]
  return BRANDS.generic
}

// Words that should keep a specific casing rather than plain Title Case.
const WORD_CASE: Record<string, string> = {
  deepseek: 'DeepSeek', qwen: 'Qwen', qwen2: 'Qwen2', qwen3: 'Qwen3', qwq: 'QwQ', qvq: 'QVQ',
  llama: 'Llama', codellama: 'CodeLlama', gemma: 'Gemma', codegemma: 'CodeGemma', gemini: 'Gemini',
  mistral: 'Mistral', mixtral: 'Mixtral', codestral: 'Codestral', ministral: 'Ministral', devstral: 'Devstral',
  nemo: 'Nemo', phi: 'Phi', command: 'Command', granite: 'Granite', hermes: 'Hermes', nous: 'Nous',
  yi: 'Yi', falcon: 'Falcon', starcoder: 'StarCoder', smollm: 'SmolLM', wizardlm: 'WizardLM',
  openchat: 'OpenChat', dolphin: 'Dolphin', nemotron: 'Nemotron', aya: 'Aya', glm: 'GLM',
  instruct: 'Instruct', distill: 'Distill', abliterated: 'Abliterated', uncensored: 'Uncensored',
  chat: 'Chat', coder: 'Coder', code: 'Code', vision: 'Vision', math: 'Math', reasoning: 'Reasoning',
  mini: 'Mini', small: 'Small', medium: 'Medium', large: 'Large', base: 'Base', tiny: 'Tiny', pro: 'Pro',
}
// Standalone tokens that are acronyms.
const ACRONYMS = new Set(['gpt', 'oss', 'ai', 'llm', 'vl', 'moe', 'it', 'sft', 'rl', 'r1', 'hf', 'awq', 'gptq'])
// Trailing quant / format tags to drop.
const QUANT = /^(q\d[\w.]*|iq\d[\w.]*|fp?\d{1,2}|bf16|f16|f32|int[48]|gguf|mlx|ud|dw|xl|hf)$/i
const isSize = (w: string) => /^\d+(\.\d+)?(x\d+)?(\.\d+)?b$/i.test(w) || /^r\d+b$/i.test(w) || /^\d+(\.\d+)?[mk]$/i.test(w)
const isVersion = (w: string) => /^v?\d+(\.\d+)+$/i.test(w)

/** Turns a raw model id into a readable display name (e.g. "deepseek-r1-distill-qwen-14b" → "DeepSeek R1 Distill Qwen 14B"). */
export function prettyModelName(modelId: string): string {
  let s = modelId.split(/[\\/]/).pop() ?? modelId
  s = s.replace(/\.(gguf|bin|safetensors|pt)$/i, '')

  // Ollama-style tag after ":" — keep it only if it encodes a size.
  let sizeTag = ''
  const colon = s.indexOf(':')
  if (colon >= 0) {
    const tag = s.slice(colon + 1)
    if (isSize(tag)) sizeTag = tag
    s = s.slice(0, colon)
  }

  // Strip common uploader/repo prefixes.
  s = s.replace(/^(huihui-ai|huihui|lmstudio-community|thebloke|unsloth|bartowski|mradermacher|nousresearch|cognitivecomputations)[-_]/i, '')

  // Split on -, _ and whitespace; a "." inside a token (e.g. "qwen3.8", "3.3") is kept.
  const words = s.split(/[-_\s]+/).filter(Boolean)

  const out: string[] = []
  for (const w of words) {
    const lw = w.toLowerCase()
    if (QUANT.test(w) && !isSize(w)) continue // drop quant noise
    if (/^[ksme]$/i.test(w)) continue // stray quant letters, e.g. the K_M in Q4_K_M
    if (isSize(w)) {
      out.push(w.toUpperCase().replace(/X/g, 'x')) // 8X7B → 8x7B
      continue
    }
    if (isVersion(w)) {
      out.push(lw.replace(/^v/, 'v'))
      continue
    }
    if (ACRONYMS.has(lw)) {
      out.push(w.toUpperCase())
      continue
    }
    if (WORD_CASE[lw]) {
      out.push(WORD_CASE[lw])
      continue
    }
    // e.g. "qwen3.8" or "phi4" → keep the brand casing and its number
    const m = lw.match(/^([a-z]+)(\d[\w.]*)$/)
    if (m && WORD_CASE[m[1]]) {
      out.push(WORD_CASE[m[1]] + m[2].toUpperCase().replace(/B$/, 'B'))
      continue
    }
    out.push(w.charAt(0).toUpperCase() + w.slice(1))
  }
  if (sizeTag) out.push(sizeTag.toUpperCase())
  // Provider ids commonly encode decimal model versions with a dash:
  // claude-opus-4-5 -> Claude Opus 4.5, gpt-4-1-mini -> GPT 4.1 Mini.
  return out.join(' ').replace(/\b(\d+)\s+(\d+)\b/, '$1.$2').replace(/\s+/g, ' ').trim() || modelId
}
