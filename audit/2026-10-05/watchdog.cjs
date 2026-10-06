// Keeps unattended store builds moving. Every 3 minutes: if a store's agent has been quiet for 5+ minutes and
// nothing is resuming it, resume it headlessly. Stops for a store once its last message says STORE COMPLETE,
// or after 15 resumes. Run detached; log in %TEMP%\watchdog.log. Never touches Stripe or Printful.
const { DatabaseSync } = require('node:sqlite')
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs')

const db = process.env.USERPROFILE + '/.local/share/opencode/opencode.db'
const FIX_PIXELTRIM = 'Your STORE COMPLETE report was not accurate. An audit of the live site found these defects, fix every one and re-test on the live address: 1) netlify/functions/visitor-count.js returns Math.random numbers and report.js falls back to mock data. That is fabricated traffic. Replace both with a real counter: store counts in Netlify Blobs using the built-in context (no manual token or site id env vars needed inside a deployed function), count one anonymous hit per page view posted by a small script on every page, return an honest zero when nothing was recorded, and never invent a number. Remove every mock fallback. 2) The report endpoint must require a long random token you generate now, store only in a Netlify environment variable set through the Netlify API with the connected token, and write in STORE-LOG.md. The default token must not work. 3) sitemap.xml, robots.txt and the IndexNow file use https://pixeltrim.tools which nobody owns. Use the real live Netlify address everywhere, and make every canonical link and og:url absolute. 4) Remove all semicolons and em dashes from visible copy. 5) Verify the counter end to end: visit a page in a real browser, then read the report and confirm the count went from 0 to 1, then confirm a page nobody visited reports 0. Submit the sitemap URLs through IndexNow once the key file resolves. Only end with STORE COMPLETE when all five are verified, and list honestly what is still not wired up.';
const DEPLOY_PIXELTRIM = 'Codex has just finished improving this store in the folder. Read STORE-LOG.md and the file .codex-done for what changed. Deploy the folder as it is now to the connected Netlify account, then verify the live address: every page returns 200, the sitemap and canonical links use the live address, a GET or bot request to the counter changes nothing, one real browser page view adds exactly 1, and the report endpoint rejects a missing token. Fix anything that fails. Reset the counter to zero afterwards. Never call Stripe. End with STORE COMPLETE, the live address, and an honest list of what is not wired up.'
const DEPLOY_CHALKLINE = 'Claude Code has just built the storefront for this store in the folder. Read STORE-LOG.md and .engine-done for what changed. Deploy the folder to the connected Netlify account (create a new site for it), set SITE_URL to the live address and rebuild any canonical links and the sitemap with it, then verify the live address: every page returns 200, product downloads are not publicly reachable without a signed link, the counter ignores GET and bots, and no secret appears in any file served. Stripe stays in test shape: never call Stripe, never use a live key, and tell me honestly that checkout is not live until the owner adds a test key. Fix anything that fails. End with STORE COMPLETE, the live address, and an honest list of what is not wired up.'
const stores = [
  { name: 'tools', dir: 'C:\\Users\\Nick\\Downloads\\Stores\\build-me-a-muw576gx', session: 'ses_ef0a8d475ffeUfP9Dl8lytNHjf', reopenAfter: Date.now(), waitFile: 'C:\Users\Nick\Downloads\Stores\build-me-a-muw576gx\.codex-done', afterWaitPrompt: DEPLOY_PIXELTRIM },
]
const PROMPT = 'Continue where you stopped. Read your todo list and STORE-LOG.md, finish the next unfinished step, and keep going until the store is built, deployed to my connected Netlify account, and tested live at desktop and phone width. Write files in small pieces and use bounded commands. Add the first-party visitor counter and token-protected report endpoint from the search playbook, and test it live. Never call Stripe and never place a Printful order. When everything is verified, update STORE-LOG.md and end your final message with the exact words STORE COMPLETE and the live address, plus an honest list of what is not wired up.'

// Free models to fall back through when the current one hits its free-tier limit or stops answering.
const MODELS = ['opencode/nemotron-3-ultra-free', 'opencode/longcat-2.5-preview-free', 'opencode/fledge-alpha-free', 'opencode/ling-3.1-flash-free', 'opencode/big-pickle', 'opencode/mimo-v2.6-flash-free']
// A free model that is out of usage retries silently and prints nothing, so ask it for one word before trusting it.
const answers = (model) => {
  try {
    const out = execSync(`opencode run --model ${model} --dir "${process.env.TEMP}" --auto "Reply with the single word ok"`, { timeout: 70000, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
    log('probe ' + model + ' => ' + JSON.stringify(out.slice(0, 80)))
    return /ok/i.test(out)
  } catch (e) {
    log('probe error: ' + String(e.stderr || e.message).slice(0, 160).replace(/\s+/g, ' '))
    return false
  }
}
const LIMIT = /limit|quota|rate|credit|exceed|429|too many|usage/i
const log = (m) => fs.appendFileSync(process.env.TEMP + '/watchdog.log', new Date().toISOString() + ' ' + m + '\n')
const state = Object.fromEntries(stores.map((s) => [s.name, { resumes: 0, last: 0, done: false, model: 0, lastSeen: 0, stuck: 0 }]))

// True while some `opencode run` for this session is already alive, so a resume is never doubled up.
const running = (session) => {
  try {
    const out = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'opencode|node' -and $_.CommandLine -match ' run ' -and $_.CommandLine -match '${session}' -and $_.CommandLine -notmatch 'Get-CimInstance' }).Count"`).toString().trim()
    return Number(out) > 0
  } catch { return false }
}

// A resume that lost its connection can hang for hours and block every later resume, so kill any for this session.
const killRuns = (session) => {
  try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'opencode|node' -and $_.CommandLine -match ' run ' -and $_.CommandLine -match '${session}' -and $_.CommandLine -notmatch 'Get-CimInstance' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`) } catch { /* nothing to kill */ }
}

function tick() {
  for (const s of stores) {
    const st = state[s.name]
    if (st.done || st.resumes >= 15) continue
    if (s.waitFile && !fs.existsSync(s.waitFile)) continue
    if (s.waitFile && s.afterWaitPrompt && !s.switched) { s.switched = true; s.prompt = s.afterWaitPrompt; s.reopenAfter = Date.now(); st.last = 0 }
    try {
      const d = new DatabaseSync(db, { readOnly: true })
      const d2 = new DatabaseSync(db, { readOnly: true })
      const last = d.prepare('select max(time_created) t from part where session_id=?').get(s.session).t || 0
      const row = d.prepare("select json_extract(p.data,'$.text') x, p.time_created tc from part p join message m on m.id=p.message_id where p.session_id=? and json_extract(m.data,'$.role')='assistant' and json_extract(p.data,'$.type')='text' order by p.time_created desc limit 1").get(s.session)
      const lastText = row?.tc
      const text = row?.x || ''
      d.close()
      const err = d2.prepare("select json_extract(data,'$.error') e from message where session_id=? and json_extract(data,'$.role')='assistant' order by time_created desc limit 1").get(s.session)?.e || ''
      d2.close()
      if (err && LIMIT.test(String(err))) { st.model = (st.model + 1) % MODELS.length; st.last = 0; log(`${s.name} hit a limit (${String(err).slice(0, 80)}), switching to ${MODELS[st.model]}`) }
      if (/STORE COMPLETE/.test(text) && (lastText || 0) > (s.reopenAfter || 0)) { st.done = true; log(s.name + ' complete'); continue }
      if (st.resumes > 0 && last <= st.lastSeen && Date.now() - st.last > 240000) { st.stuck++ } else if (last > st.lastSeen) { st.stuck = 0 }
      if (st.stuck >= 2) { st.model = (st.model + 1) % MODELS.length; st.stuck = 0; st.last = 0; log(`${s.name} not answering, switching to ${MODELS[st.model]}`) }
      st.lastSeen = Math.max(st.lastSeen, last)
      const quiet = (Date.now() - last) / 1000
      if (quiet > 600 && running(s.session)) { log(`${s.name} has a hung resume process, stopping it`); killRuns(s.session) }
      if (quiet > 300 && Date.now() - st.last > 360000 && !running(s.session)) {
        for (let i = 0; i < MODELS.length && !answers(MODELS[st.model]); i++) { log(`${MODELS[st.model]} is not answering, trying the next free model`); st.model = (st.model + 1) % MODELS.length }
        st.resumes++
        st.last = Date.now()
        log(`${s.name} quiet ${Math.round(quiet)}s, resume #${st.resumes} on ${MODELS[st.model]}`)
        const child = spawn('opencode', ['run', '--session', s.session, '--dir', s.dir, '--model', MODELS[st.model], '--auto', s.prompt || PROMPT], {
          detached: true, stdio: 'ignore', windowsHide: true, shell: true,
          env: { ...process.env, OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS: '180000' },
        })
        child.unref()
      }
    } catch (e) { log(s.name + ' check failed: ' + e.message) }
  }
}

log('watchdog started')
tick()
setInterval(tick, 180000)
