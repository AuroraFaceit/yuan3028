// 展馆展示视频：沿镜头路径逐帧截图，输出到 tmp/frames/
// 用法: node tools/videocap.mjs [fps]   （默认 8fps，先清空 tmp/frames）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FPS = Number(process.argv[2] || 8);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = '1280', H = '720';
const OUT = 'tmp/frames';
const port = 9400 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion',
  `--window-size=${W},${H}`, 'http://127.0.0.1:8125/',
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
if (!wsUrl) { console.error('no page ws'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => {
  const mid = ++id; ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res) => pending.set(mid, res));
};
await send('Page.enable'); await send('Runtime.enable');

// 等纹理
for (let i = 0; i < 400; i++) {
  const r = await send('Runtime.evaluate', { expression: 'String(!!window.__texDone)', returnByValue: true });
  if (r.result?.result?.value === 'true') break;
  await sleep(300);
}
console.log('textures ready');

// 隐藏 UI，只留 3D 画面
await send('Runtime.evaluate', { expression: `
  const st = document.createElement('style');
  st.textContent = '#ui,#loader,.topscrim{display:none!important}';
  document.head.appendChild(st);
  window.__err = null;
`});
await sleep(1500);

// 取各章节机位
const ch = JSON.parse((await send('Runtime.evaluate', {
  expression: `JSON.stringify(Object.fromEntries(Object.entries(window.__layout.chapters).map(([k,v])=>[k,{view:[v.view.x,v.view.y,v.view.z],lookAt:[v.lookAt.x,v.lookAt.y,v.lookAt.z]}])))`,
  returnByValue: true,
})).result.result.value);
const CEIL = 4.9 * 4;

// 镜头段落：t∈[0,1] → [pos, look]
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const V = (x, y, z) => [x, y, z];
const segs = [
  // 1. 中庭推进：慢慢走向电视
  { d: 5, cam: (t) => [V(0, 3.5, -15.5 + t * 3.2), V(0, 2.7 - t * 0.4, 28)] },
  // 2. 环绕电视
  { d: 6, cam: (t) => {
      const a = -0.62 + t * 1.24, r = 6.6;
      return [V(Math.sin(a) * r, 2.35 + Math.sin(t * Math.PI) * 0.35, -2.0 + Math.cos(a) * r), V(0, 2.1, -2.0)];
    } },
  // 3. 一楼画墙横摇：左三幅 → 电视 → 右三幅
  { d: 6, cam: (t) => {
      const a = 5.55 + t * 1.6;
      return [V(0, 2.9, -8.5 + Math.sin(t * Math.PI) * 2.0), V(Math.sin(a) * 28, 2.5, Math.cos(a) * 28)];
    } },
  // 4. 去看小白
  { d: 4, cam: (t) => [V(-14.5 + t * 2.2, 1.7, -10.5 + t * 2.4), V(-9.4, 1.15, -6.4)] },
  // 5. 沿中庭升起：地面一路仰视到纸鹤
  { d: 7, cam: (t) => [V(0, 2.8 + t * 13.6, -14 + t * 3.0), V(0, 4.5 + t * 14.5, 16 - t * 16)] },
  // 6-8. 2F / 3F / 4F 章节机位（各自轻轻推进）
  ...['sky', 'daily', 'dusk'].map((cid) => {
    const c = ch[cid];
    const v0 = c.view.map((x) => x * 1.06), v1 = c.view;
    const l = c.lookAt;
    return { d: 4.5, cam: (t) => [v0.map((x, i) => lerp(x, v1[i], ease(t))), l] };
  }),
  // 9. 塔顶：纸鹤与灯
  { d: 5, cam: (t) => [V(Math.sin(-0.4 + t * 0.8) * 7.5, CEIL - 3.4, Math.cos(-0.4 + t * 0.8) * 7.5), V(0, CEIL - 1.6, 0)] },
  // 10. 收尾：拉远看整座塔
  { d: 6, cam: (t) => [V(0, 9 - t * 4.5, -15 + t * 2.5), V(0, 8.5 - t * 3.5, 4)] },
];

const total = segs.reduce((s, x) => s + x.d, 0);
const frames = Math.round(total * FPS);
console.log(`total ${total}s -> ${frames} frames @ ${FPS}fps`);

let idx = 0;
for (let f = 0; f < frames; f++) {
  const tAll = f / frames;
  let acc = 0, seg = segs[0], t = 0;
  const tt = f / FPS;
  for (const s of segs) { if (tt < acc + s.d) { seg = s; t = (tt - acc) / s.d; break; } acc += s.d; }
  const [p, l] = seg.cam(Math.min(1, Math.max(0, t)));
  await send('Runtime.evaluate', {
    expression: `__setCam(${p.map((x) => x.toFixed(3)).join(',')}, ${l.map((x) => x.toFixed(3)).join(',')})`,
  });
  await sleep(1050);   // 等软渲染出一帧
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `${String(idx++).padStart(4, '0')}.png`), Buffer.from(shot.result.data, 'base64'));
  if (f % 20 === 0) console.log(`frame ${f}/${frames}`);
}

ws.close(); chrome.kill(); await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
console.log('done', idx, 'frames');
process.exit(0);
