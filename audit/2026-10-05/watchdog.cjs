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
const PROMPT = 'Continue where you stopped. Read your todo list and STORE-LOG.md, finish the next unfinished step, and keep going until the store is built, deployed to my connected Netlify account, and tested live at desktop and phone width. Write files in small pieces and use bounded commands. Never call Stripe and never place a Printful order. When everything is verified, update STORE-LOG.md and end your final message with the exact words STORE COMPLETE and the live address, plus an honest list of what is not wired up.'

const log = (m) => fs.appendFileSync(process.env.TEMP + '/watchdog.log', new Date().toISOString() + ' ' + m + '\n')
const state = Object.fromEntries(stores.map((s) => [s.name, { resumes: 0, last: 0, done: false }]))

// True while some `opencode run` for this session is already alive, so a resume is never doubled up.
const running = (session) => {
  try {
    const out = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match ' run ' -and $_.CommandLine -match '${session}' }).Count"`).toString().trim()
    return Number(out) > 0
  } catch { return false }
}

function tick() {
  for (const s of stores) {
    const st = state[s.name]
    if (st.done || st.resumes >= 15) continue
    try {
      const d = new DatabaseSync(db, { readOnly: true })
      const last = d.prepare('select max(time_created) t from part where session_id=?').get(s.session).t || 0
      const text = d.prepare("select json_extract(data,'$.text') x from part where session_id=? and json_extract(data,'$.type')='text' order by time_created desc limit 1").get(s.session)?.x || ''
      d.close()
      if (/STORE COMPLETE/.test(text)) { st.done = true; log(s.name + ' complete'); continue }
      const quiet = (Date.now() - last) / 1000
      if (quiet > 300 && Date.now() - st.last > 360000 && !running(s.session)) {
        st.resumes++
        st.last = Date.now()
        log(`${s.name} quiet ${Math.round(quiet)}s, resume #${st.resumes}`)
        const child = spawn('opencode', ['run', '--session', s.session, '--dir', s.dir, '--model', 'opencode/big-pickle', '--auto', PROMPT], {
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
