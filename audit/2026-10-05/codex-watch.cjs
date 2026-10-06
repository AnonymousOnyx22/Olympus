// Read-only observation. Never records prompts, commands, tool output or credentials.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const db = new DatabaseSync(path.join(process.env.USERPROFILE, '.local/share/opencode/opencode.db'), { readOnly: true });
const targets = [
  { name: 'Chalkline', id: 'ses_ef11fb2c2ffeFTdgW1F2NcHIvX', folder: 'build-me-a-muw0k7fb' },
  { name: 'Browser tools', id: 'ses_ef0a8d475ffeUfP9Dl8lytNHjf', folder: 'build-me-a-muw576gx' },
];
const seen = new Map();
function inventory(root) {
  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || ['node_modules', 'dist', 'build'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) files.push(path.relative(root, full));
    }
  }
  try { walk(root); } catch {}
  return files;
}
function tick() {
  for (const target of targets) {
    const messages = db.prepare('SELECT data FROM message WHERE session_id=? ORDER BY time_created DESC LIMIT 4').all(target.id).map(r => JSON.parse(r.data));
    const parts = db.prepare('SELECT id,data,time_updated FROM part WHERE session_id=? ORDER BY time_updated DESC LIMIT 20').all(target.id);
    const tools = parts.map(r => ({ ...JSON.parse(r.data), partId: r.id })).filter(p => p.type === 'tool').slice(0, 3).map(p => ({ id: p.partId, tool: p.tool, status: p.state?.status, start: p.state?.time?.start, end: p.state?.time?.end }));
    const files = inventory(path.join(process.env.USERPROFILE, 'Downloads/Stores', target.folder));
    const snapshot = { name: target.name, at: new Date().toISOString(), latestPartAt: parts[0]?.time_updated, assistant: messages.filter(m => m.role === 'assistant').map(m => ({ created: m.time?.created, completed: m.time?.completed, error: m.error?.name, finish: m.finish })), tools, fileCount: files.length, files };
    const signature = JSON.stringify({ assistant: snapshot.assistant, tools, files });
    fs.writeFileSync(path.join(__dirname, `codex-${target.folder}-latest.json`), JSON.stringify(snapshot, null, 2));
    if (signature !== seen.get(target.id)) {
      seen.set(target.id, signature);
      fs.appendFileSync(path.join(__dirname, 'codex-watch-timeline.jsonl'), JSON.stringify(snapshot) + '\n');
      console.log(JSON.stringify({ ...snapshot, files: undefined }));
    }
  }
}
tick();
if (!process.argv.includes('--once')) setInterval(() => { try { tick(); } catch (e) { console.error('Observer read failed:', e.code || e.name); } }, 15000);
