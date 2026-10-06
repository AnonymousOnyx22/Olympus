// Keeps unattended store builds moving. Every 3 minutes: if a store's agent has been quiet for 5+ minutes and
// nothing is resuming it, resume it headlessly. Stops for a store once its last message says STORE COMPLETE,
// or after 15 resumes. Run detached; log in %TEMP%\watchdog.log. Never touches Stripe or Printful.
const { DatabaseSync } = require('node:sqlite')
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs')

const db = process.env.USERPROFILE + '/.local/share/opencode/opencode.db'
const stores = [
  { name: 'chalkline', dir: 'C:\\Users\\Nick\\Downloads\\Stores\\build-me-a-muw0k7fb', session: 'ses_ef11fb2c2ffeFTdgW1F2NcHIvX' },
  { name: 'tools', dir: 'C:\\Users\\Nick\\Downloads\\Stores\\build-me-a-muw576gx', session: 'ses_ef0a8d475ffeUfP9Dl8lytNHjf' },
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

function tick() {
  for (const s of stores) {
    const st = state[s.name]
    if (st.done || st.resumes >= 15) continue
    try {
      const d = new DatabaseSync(db, { readOnly: true })
      const d2 = new DatabaseSync(db, { readOnly: true })
      const last = d.prepare('select max(time_created) t from part where session_id=?').get(s.session).t || 0
      const text = d.prepare("select json_extract(p.data,'$.text') x from part p join message m on m.id=p.message_id where p.session_id=? and json_extract(m.data,'$.role')='assistant' and json_extract(p.data,'$.type')='text' order by p.time_created desc limit 1").get(s.session)?.x || ''
      d.close()
      const err = d2.prepare("select json_extract(data,'$.error') e from message where session_id=? and json_extract(data,'$.role')='assistant' order by time_created desc limit 1").get(s.session)?.e || ''
      d2.close()
      if (err && LIMIT.test(String(err))) { st.model = (st.model + 1) % MODELS.length; st.last = 0; log(`${s.name} hit a limit (${String(err).slice(0, 80)}), switching to ${MODELS[st.model]}`) }
      if (/STORE COMPLETE/.test(text)) { st.done = true; log(s.name + ' complete'); continue }
      if (st.resumes > 0 && last <= st.lastSeen && Date.now() - st.last > 240000) { st.stuck++ } else if (last > st.lastSeen) { st.stuck = 0 }
      if (st.stuck >= 2) { st.model = (st.model + 1) % MODELS.length; st.stuck = 0; st.last = 0; log(`${s.name} not answering, switching to ${MODELS[st.model]}`) }
      st.lastSeen = Math.max(st.lastSeen, last)
      const quiet = (Date.now() - last) / 1000
      if (quiet > 300 && Date.now() - st.last > 360000 && !running(s.session)) {
        for (let i = 0; i < MODELS.length && !answers(MODELS[st.model]); i++) { log(`${MODELS[st.model]} is not answering, trying the next free model`); st.model = (st.model + 1) % MODELS.length }
        st.resumes++
        st.last = Date.now()
        log(`${s.name} quiet ${Math.round(quiet)}s, resume #${st.resumes} on ${MODELS[st.model]}`)
        const child = spawn('opencode', ['run', '--session', s.session, '--dir', s.dir, '--model', MODELS[st.model], '--auto', PROMPT], {
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
