import { useEffect, useMemo, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { AnimatePresence, motion } from 'framer-motion'
import { applyPatch, parsePatch, type StructuredPatch } from 'diff'
import { api } from '../services/api'
import type { PermissionReply, PermissionRequest } from '../types/opencode'

interface DiffViewerProps {
  spaceId: string
  /** Pending `edit` permission requests; the agent is paused until each one is answered. */
  requests: PermissionRequest[]
}

interface FileDiff {
  path: string
  original: string
  modified: string
  approximate: boolean
  reviewable: boolean
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', md: 'markdown', css: 'css', scss: 'scss', less: 'less', html: 'html',
  py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', cs: 'csharp',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', rb: 'ruby', php: 'php', swift: 'swift',
  sh: 'shell', bash: 'shell', ps1: 'powershell', yml: 'yaml', yaml: 'yaml', toml: 'ini',
  sql: 'sql', xml: 'xml', vue: 'html', svelte: 'html', lua: 'lua', dart: 'dart',
}

const languageFor = (file: string) => LANGUAGE_BY_EXT[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext'
const stripPrefix = (name: string) => name.replace(/^[ab]\//, '')

/** Rebuilds before/after text from hunks alone, used when the file on disk can't be read. */
function fromHunks(patch: StructuredPatch): { original: string; modified: string } {
  const before: string[] = []
  const after: string[] = []
  patch.hunks.forEach((hunk, i) => {
    if (i > 0) {
      before.push('⋯')
      after.push('⋯')
    }
    for (const line of hunk.lines) {
      const body = line.slice(1)
      if (line[0] === ' ') {
        before.push(body)
        after.push(body)
      } else if (line[0] === '-') before.push(body)
      else if (line[0] === '+') after.push(body)
    }
  })
  return { original: before.join('\n'), modified: after.join('\n') }
}

async function resolveDiffs(request: PermissionRequest): Promise<FileDiff[]> {
  const diffText = typeof request.metadata.diff === 'string' ? request.metadata.diff : ''
  const fallbackPath = typeof request.metadata.filepath === 'string' ? request.metadata.filepath : request.patterns[0] ?? 'file'
  if (!diffText) {
    return [{ path: fallbackPath, original: '', modified: 'No diff was provided.', approximate: true, reviewable: false }]
  }

  const patches = parsePatch(diffText).filter((p) => p.hunks.length > 0)
  if (patches.length === 0) {
    return [{ path: fallbackPath, original: '', modified: diffText, approximate: true, reviewable: false }]
  }
  return Promise.all(
    patches.map(async (patch) => {
      const target = stripPrefix(patch.newFileName && patch.newFileName !== '/dev/null' ? patch.newFileName : patch.oldFileName ?? fallbackPath)
      const isNew = patch.oldFileName === '/dev/null' || patch.hunks.every((h) => h.oldLines === 0)
      const onDisk = isNew ? '' : await window.electronAPI.readProjectFile(target)
      if (onDisk !== null) {
        const patched = applyPatch(onDisk, patch, { fuzzFactor: 2 })
        if (patched !== false) return { path: target, original: onDisk, modified: patched, approximate: false, reviewable: true }
      }
      return { path: target, ...fromHunks(patch), approximate: true, reviewable: true }
    }),
  )
}

function RequestReview({ spaceId, request }: { spaceId: string; request: PermissionRequest }) {
  const [files, setFiles] = useState<FileDiff[] | null>(null)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState<PermissionReply | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setFiles(null)
    setActive(0)
    resolveDiffs(request)
      .then((f) => !cancelled && setFiles(f))
      .catch((err) => !cancelled && setError(String(err.message ?? err)))
    return () => {
      cancelled = true
    }
  }, [request])

  const respond = async (reply: PermissionReply) => {
    setBusy(reply)
    setError(null)
    try {
      await api.replyPermission(spaceId, request.id, reply, reply === 'reject' && feedback.trim() ? feedback.trim() : undefined)
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  const file = files?.[active]
  const canAccept = !!files?.length && files.every((item) => item.reviewable)
  const stats = useMemo(() => {
    const diff = typeof request.metadata.diff === 'string' ? request.metadata.diff : ''
    let add = 0
    let del = 0
    for (const line of diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) add++
      else if (line.startsWith('-') && !line.startsWith('---')) del++
    }
    return { add, del }
  }, [request])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <span className="rounded-xl bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-400/30">
          Paused
        </span>
        <span className="truncate font-mono text-xs text-slate-700" title={file?.path}>
          {file?.path ?? '…'}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[11px]">
          <span className="text-emerald-600">+{stats.add}</span> <span className="text-rose-600">−{stats.del}</span>
        </span>
      </div>

      {files && files.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-1.5">
          {files.map((f, i) => (
            <button
              key={f.path}
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-xl px-2 py-0.5 font-mono text-[11px] transition ${
                i === active ? 'bg-aether-50 text-aether-700 ring-1 ring-aether-200' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f.path.split(/[\\/]/).pop()}
            </button>
          ))}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {file ? (
          <DiffEditor
            keepCurrentOriginalModel
            keepCurrentModifiedModel
            onMount={(editor) => {
              const models = editor.getModel()
              // Detach the editor before disposing its models, including on mode changes.
              editor.onDidDispose(() => queueMicrotask(() => {
                models?.original.dispose()
                models?.modified.dispose()
              }))
            }}
            key={`${request.id}:${file.path}`}
            original={file.original}
            modified={file.modified}
            language={languageFor(file.path)}
            theme="olympus-light"
            options={{
              readOnly: true,
              renderSideBySide: false,
              minimap: { enabled: false },
              fontSize: 12.5,
              fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
              scrollBeyondLastLine: false,
              renderOverviewRuler: false,
              hideUnchangedRegions: { enabled: !file.approximate },
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Preparing diff…</div>
        )}
        {file?.approximate && (
          <div className="pointer-events-none absolute bottom-2 left-3 rounded-xl bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-100">
            {file.reviewable ? 'Showing changed regions only' : 'Preview unavailable, raw agent output shown'}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-3">
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Optional: tell the agent why you're rejecting…"
          className="w-full rounded-xl bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-aether-400"
        />
        {error && <div className="text-xs text-rose-600">{error}</div>}
        <div className="flex items-center gap-2">
          <button
            disabled={busy !== null || !canAccept}
            onClick={() => respond('once')}
            className="flex-1 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            {busy === 'once' ? 'Applying…' : canAccept ? 'Accept edit' : 'Cannot verify edit'}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => respond('reject')}
            className="flex-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
          >
            {busy === 'reject' ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DiffViewer({ spaceId, requests }: DiffViewerProps) {
  const current = requests[0]
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={current.id}
            className="flex h-full min-h-0 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {requests.length > 1 && (
              <div className="bg-amber-400/10 px-4 py-1 text-[11px] text-amber-700">
                {requests.length - 1} more edit{requests.length > 2 ? 's' : ''} queued
              </div>
            )}
            <RequestReview spaceId={spaceId} request={current} />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="flex h-full flex-col items-center justify-center gap-2 px-10 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-aether-50 ring-1 ring-aether-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-aether-500">
                <path d="M8 3v12M16 9v12M5 6l3-3 3 3M13 18l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm text-slate-900">No pending edits</p>
            <p className="text-xs leading-relaxed text-slate-500">
              When the agent wants to change a file it pauses here. Nothing is written to disk until you accept.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
