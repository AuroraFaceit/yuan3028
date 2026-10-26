// 交互自测：方向键移动 / 左键拖拽转向 / 点击展品
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const port = 9800 + Math.floor(Math.random() * 100);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpi-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--no-first-run', '--no-default-browser-check', '--window-size=1400,900', url,
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 60; i++) {
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
try { await send('Page.bringToFront'); } catch {}
await evaluate("window.focus && window.focus()");
for (let i = 0; i < 200; i++) {
  if (await evaluate('!!window.__texDone')) break;
  await sleep(300);
}
await sleep(1200);

const log = [];
const st = async () => JSON.parse(await evaluate('JSON.stringify(window.__state())'));

// 1) 方向键（先把自动导览停掉）
await sleep(3000);
await evaluate("if(window.__state().active) document.getElementById('tourBtn').click()");
await sleep(1500);
await evaluate("if(window.__state().active) document.getElementById('tourBtn').click()");
await sleep(800);
const before = await st();
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38, nativeVirtualKeyCode: 38 });
await sleep(4000);
log.push(['按下时 keys', JSON.stringify(await evaluate('[...window.__rig.keys]'))]);
log.push(['tour active', await evaluate('window.__state().active')]);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38, nativeVirtualKeyCode: 38 });
await sleep(200);
const afterUp = await st();
log.push(['ArrowUp 前进', before.pos, '->', afterUp.pos]);

// 2) 左右键
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
await sleep(3200);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
await sleep(200);
const afterLeft = await st();
log.push(['ArrowLeft 平移', afterUp.pos, '->', afterLeft.pos]);

// 3) 左键拖拽转向
const yaw0 = await evaluate('+window.__rig.yaw.toFixed(3)');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 420, button: 'left', clickCount: 1 });
for (let i = 1; i <= 12; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700 + i * 18, y: 420 + i * 2, button: 'left', buttons: 1 });
  await sleep(30);
}
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 916, y: 444, button: 'left', clickCount: 1 });
await sleep(200);
const yaw1 = await evaluate('+window.__rig.yaw.toFixed(3)');
log.push(['左键拖拽 yaw', yaw0, '->', yaw1]);

// 4) 点击展品（先跳到粉色章节正对墙面，再点画面中心）
await evaluate('window.__setCam(-15,1.7,-12.6,-21.5,2.6,-18)');
await sleep(600);
const focusBefore = await evaluate('window.__rig.pos.toArray().map(n=>+n.toFixed(1))');
const hit = JSON.parse(await evaluate(`(() => { for (let y = 0.3; y >= -0.3; y -= 0.1) { for (let x = -0.6; x <= 0.6; x += 0.1) { const h = window.__pick(x, y); if (h) return JSON.stringify(Object.assign(h, {x, y})); } } return 'null'; })()`));
log.push(['射线命中展品', JSON.stringify(hit)]);
const vw = await evaluate('innerWidth'); const vh = await evaluate('innerHeight');
const cx = Math.round((hit.x + 1) / 2 * vw); const cy = Math.round((1 - hit.y) / 2 * vh);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
await sleep(80);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
await sleep(4500);
const tweenOn = await evaluate('!!window.__rig.tween');
log.push(['点击后是否触发飞行动画', tweenOn]);
const focusAfter = await evaluate('window.__rig.pos.toArray().map(n=>+n.toFixed(1))');
log.push(['点击展品镜头', focusBefore, '->', focusAfter]);
log.push(['当前章节', await evaluate('window.__state().activeId')]);

// 5) 自动导览
await evaluate("document.getElementById('tourBtn').click()");
await sleep(1500);
const tourActive = await evaluate('window.__state().active');
log.push(['自动导览', tourActive]);

console.log(log.map((l) => l.join(' ')).join('\n'));
ws.close(); chrome.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
