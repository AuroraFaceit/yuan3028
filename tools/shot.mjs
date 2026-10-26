// CDP 截图工具：等纹理全部加载后再截图
// 用法: node tools/shot.mjs <url> <out.png> [evalExpr] [waitMs] [width] [height]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [url, out, expr = '', waitMs = '1200', W = '1440', H = '900'] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--hide-scrollbars',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion',
  `--window-size=${W},${H}`,
  url,
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch { /* not up yet */ }
  await sleep(250);
}
if (!wsUrl) { console.error('no page ws'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res) => pending.set(mid, res));
}

await send('Page.enable');
await send('Runtime.enable');

// 等页面就绪 + 纹理加载完成
let ready = false;
for (let i = 0; i < 400; i++) {
  const r = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({p: window.__texDone?1:(window.__texProgress||0), e: !!window.__err})',
    returnByValue: true,
  });
  try {
    const v = JSON.parse(r.result.result.value);
    if (v.p >= 0.99) { ready = true; break; }
  } catch { /* ignore */ }
  await sleep(250);
}
if (!ready) console.error('warning: textures not fully loaded');

if (expr) {
  await send('Runtime.evaluate', { expression: expr, awaitPromise: true });
}
await sleep(Number(waitMs));

const st = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__state?.()||null)', returnByValue: true });
console.log('state:', st.result?.result?.value);
const pr = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__probe??null)', returnByValue: true });
console.log('probe:', pr.result?.result?.value);

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);

ws.close();
chrome.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
