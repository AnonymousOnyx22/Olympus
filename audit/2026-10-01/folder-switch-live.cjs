const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { _electron } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');

(async () => {
  const root = path.resolve(__dirname, '../../lantern');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-folder-audit-'));
  const source = path.join(scratch, 'Audit source');
  const target = path.join(scratch, 'Audit target');
  for (const folder of [source, target]) { fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, 'README.md'), `# ${path.basename(folder)}\n`); }
  const fromId = source.toLowerCase(), toId = target.toLowerCase();
  fs.writeFileSync(path.join(scratch, 'settings.json'), JSON.stringify({ schemaVersion: 1, projects: [{ id: fromId, path: source, name: 'Audit source' }, { id: toId, path: target, name: 'Audit target' }], lastSpace: fromId, permissionMode: 'ask' }));
  const launcher = path.join(scratch, 'launch.cjs');
  fs.writeFileSync(launcher, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(scratch)});app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.setSize(1440,940);w.webContents.setBackgroundThrottling(false);});require(${JSON.stringify(path.join(root, 'dist-electron/main.js'))});`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [launcher], cwd: root, env });
  const result = { scratch, checks: [] };
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    await page.getByRole('button', { name: 'New agent', exact: true }).waitFor();
    const ids = await page.evaluate(async ({ fromId }) => {
      await window.electronAPI.openSpace(fromId);
      const one = await window.electronAPI.request(fromId, 'POST', '/session', { title: 'Audit left' });
      const two = await window.electronAPI.request(fromId, 'POST', '/session', { title: 'Audit right' });
      if (!one.ok || !two.ok) throw Error('Session creation failed');
      localStorage.setItem('olympus.agentWindows', JSON.stringify({ [fromId]: [one.data.id, two.data.id] }));
      return [one.data.id, two.data.id];
    }, { fromId });
    await page.reload();
    await page.getByRole('button', { name: /Workspace/ }).first().click();
    const right = page.locator(`[data-session-id="${ids[1]}"]:visible`);
    await right.getByTitle('Change project folder').click();
    const picker = page.getByRole('dialog', { name: 'Change agent folder' });
    assert.equal(await picker.getByRole('button', { name: /General/ }).count(), 0);
    await picker.getByRole('button', { name: /Audit target/ }).click();
    await page.locator('article:visible').filter({ hasText: 'Audit target · Audit right' }).waitFor();
    assert.equal(await page.locator(`[data-session-id="${ids[0]}"]:visible`).count(), 1);
    assert.equal(await page.locator(`[data-session-id="${ids[1]}"]:visible`).count(), 0);
    const state = await page.evaluate(async ({ fromId, toId, originalId }) => ({
      source: await window.electronAPI.request(fromId, 'GET', '/session'),
      target: await window.electronAPI.request(toId, 'GET', '/session'),
      wrongScope: await window.electronAPI.request(toId, 'GET', `/session/${originalId}/message`),
      windows: JSON.parse(localStorage.getItem('olympus.agentWindows')),
    }), { fromId, toId, originalId: ids[1] });
    assert(state.source.data.some(session => session.id === ids[1]));
    assert(state.target.data.some(session => session.title === 'Audit right' && session.directory.toLowerCase() === toId));
    assert.equal(state.wrongScope.ok, false);
    assert.deepEqual(state.windows[fromId], [ids[0]]);
    assert.equal(state.windows[toId].length, 1);
    result.checks = ['only selected pane changed folder', 'other pane remained open', 'old session retained in source', 'new session directory is target', 'cross-project session request rejected', 'window mapping persisted', 'General excluded from folder picker'];
    await page.screenshot({ path: path.join(__dirname, 'screenshots/folder-switch-live.png') });
  } catch (error) { result.error = String(error); process.exitCode = 1; }
  finally {
    fs.writeFileSync(path.join(__dirname, 'folder-switch-live-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
