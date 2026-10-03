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
    const paneIds = () => page.locator('article[data-session-id]:visible').evaluateAll(nodes => nodes.map(node => node.dataset.sessionId));
    await page.locator(`[data-session-id="${ids[0]}"]:visible`).waitFor();
    assert.deepEqual(await paneIds(), ids, 'startup restores all windows in the Workspace');
    const modes = page.getByRole('navigation', { name: 'Workspace mode' });
    for (const name of ['Chat', 'Agents', 'Thread']) assert.equal(await modes.getByRole('button', { name, exact: true }).count(), 0);
    // Change the FIRST pane: grouping by project would incorrectly move it behind the second.
    const first = page.locator(`[data-session-id="${ids[0]}"]:visible`);
    const other = page.locator(`[data-session-id="${ids[1]}"]:visible`);
    await other.locator('textarea').fill('Keep this draft');
    await first.getByTitle('Change project folder').click();
    const picker = page.getByRole('dialog', { name: 'Change agent folder' });
    await picker.getByRole('button', { name: /Audit target/ }).click();
    await page.locator('article:visible').filter({ hasText: /Audit target.*Audit left/ }).waitFor();
    const replacement = (await paneIds())[0];
    assert.notEqual(replacement, ids[0]);
    assert.deepEqual(await paneIds(), [replacement, ids[1]], 'folder change preserves exact position');
    assert.equal(await other.locator('textarea').inputValue(), 'Keep this draft');
    await page.getByRole('button', { name: 'New agent', exact: true }).click();
    await page.getByRole('dialog', { name: 'New agent', exact: true }).getByRole('button', { name: /Audit source/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('article[data-session-id]').length === 3);
    const afterNew = await paneIds();
    assert.equal(afterNew.length, 3);
    assert.deepEqual(afterNew.slice(0, 2), [replacement, ids[1]], 'new agent stays alongside existing agents');
    await page.getByRole('button', { name: '+ Add agent', exact: true }).click();
    await page.getByRole('dialog', { name: 'New agent', exact: true }).getByRole('button', { name: /Audit target/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('article[data-session-id]').length === 4);
    const afterAdd = await paneIds();
    assert.deepEqual(afterAdd.slice(0, 3), afterNew);
    await page.getByRole('button', { name: 'Open conversation', exact: true }).click();
    await page.getByRole('dialog', { name: 'Open conversation', exact: true }).getByRole('button', { name: 'Audit left Audit source', exact: true }).click();
    await page.locator(`[data-session-id="${ids[0]}"]:visible`).waitFor();
    const reopened = await paneIds();
    assert.deepEqual(reopened, [...afterAdd, ids[0]], 'saved conversation opens in shared workspace');
    await page.reload();
    await page.locator(`[data-session-id="${replacement}"]:visible`).waitFor();
    assert.deepEqual(await paneIds(), reopened, 'window positions survive reload');
    await modes.getByRole('button', { name: 'Code', exact: true }).click();
    await page.getByRole('button', { name: 'Manage projects', exact: false }).first().click();
    await page.getByRole('button', { name: /Audit source/ }).first().click();
    await page.locator(`[data-session-id="${replacement}"]:visible`).waitFor();
    assert.deepEqual(await paneIds(), reopened, 'project navigation returns to shared workspace');
    result.checks = ['startup restores shared Workspace', 'no single-chat or project-only chat tabs', 'first agent keeps position after folder change', 'unrelated draft preserved', 'New agent preserves existing windows', 'Add agent across projects appends only new window', 'saved conversation reopens in Workspace', 'window order persists after reload', 'project navigation returns to shared Workspace'];
    await page.screenshot({ path: path.join(__dirname, 'screenshots/workspace-navigation-live.png') });
  } catch (error) { result.error = String(error); process.exitCode = 1; }
  finally {
    fs.writeFileSync(path.join(__dirname, 'workspace-navigation-live-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
