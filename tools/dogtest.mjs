// 自测：点击小狗是否有反应 + 点击展品是否仍能聚焦
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const port = 9900 + Math.floor(Math.random() * 90);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpd-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--no-first-run', '--no-default-browser-check', '--window-size=1400,900', url,
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
  await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => { const mid = ++id; ws.send(JSON.stringify({ id: mid, method, params })); return new Promise((r) => pending.set(mid, r)); };
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text };
  return r.result?.result?.value;
};

await send('Page.enable'); await send('Runtime.enable');
for (let i = 0; i < 240; i++) {
  if (await evaluate('!!window.__texDone')) break;
  await sleep(300);
}
await sleep(1500);

const log = [];
await evaluate("if(window.__state().active) document.getElementById('tourBtn').click()");
await sleep(800);
await evaluate("document.getElementById('tourBtn').click()");
await sleep(600);
await evaluate('window.__setCam(0,2.7,-18.2,0,6.8,0)');
await sleep(1200);

// 小狗在屏幕上的位置
const cx = await evaluate(`(() => {
  const d = window.__layout.dog;
  const p = d.position.clone(); p.y += 0.75 * d.scale.y;
  const v = p.project(window.__camera);
  return JSON.stringify({ x: Math.round((v.x*0.5+0.5)*innerWidth), y: Math.round((-v.y*0.5+0.5)*innerHeight) });
})()`);
const p = JSON.parse(cx);
log.push(['小狗屏幕坐标', JSON.stringify(p)]);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
await sleep(400);
log.push(['悬停提示', await evaluate("document.getElementById('capTitle').textContent + ' / 显示:' + document.getElementById('caption').classList.contains('show')")]);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
await sleep(60);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
await sleep(500);
log.push(['点击后小狗兴奋', await evaluate('window.__layout.dog.userData.excitedUntil > 0')]);
log.push(['点击后提示', await evaluate("document.getElementById('capTitle').textContent")]);
log.push(['点击后错误', await evaluate('window.__err || null')]);

// 仍然能点开展品：站到粉色楼层某件展品正前方
log.push(['站到展品前', await evaluate("JSON.stringify(window.__facePhoto('pink-01', 4.0))")]);
await sleep(2000);
const hit = JSON.parse(await evaluate(`(() => { for (let y = 0.3; y >= -0.3; y -= 0.1) { for (let x = -0.6; x <= 0.6; x += 0.1) { const h = window.__pick(x, y); if (h) return JSON.stringify(Object.assign(h,{x,y})); } } return 'null'; })()`));
log.push(['射线命中展品', JSON.stringify(hit)]);
if (hit && hit.id) {
  const vw = await evaluate('innerWidth'); const vh = await evaluate('innerHeight');
  const px = Math.round((hit.x + 1) / 2 * vw); const py = Math.round((1 - hit.y) / 2 * vh);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1 });
  await sleep(60);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1 });
  await sleep(600);
  log.push(['点击展品触发飞行', await evaluate('!!window.__rig.tween')]);
}

console.log(log.map((l) => l.join(' ')).join('\n'));
ws.close(); chrome.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
