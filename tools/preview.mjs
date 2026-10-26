// 一次性生成 preview/ 里的整套预览图：同一个浏览器里切机位、开会话、逐张截图
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] || 'http://127.0.0.1:8123/';
const port = 9700 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpp-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 1440, H = 900;
const outDir = 'preview';

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion',
  `--window-size=${W},${H}`, url,
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch { /* wait */ }
  await sleep(250);
}
if (!wsUrl) { console.error('no page'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((r) => pending.set(mid, r));
};
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text };
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');

for (let i = 0; i < 400; i++) {
  if (await evaluate('!!window.__texDone')) break;
  await sleep(300);
}
await sleep(1500);
await evaluate("if (window.__state().active) document.getElementById('tourBtn').click()");
await sleep(300);

const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, 'base64'));
  console.log('saved', name);
};

// 点章节条把左侧文案切过去，同时把镜头直接放到位（无头渲染里补间跑不完）
const move = async (id, x, y, z, lx, ly, lz, wait = 2100) => {
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('#chapterBar button')].find(n => n.dataset.id === '${id}');
    if (b) b.click();
    window.__rig.tween = null;
    window.__setCam(${x}, ${y}, ${z}, ${lx}, ${ly}, ${lz});
  })()`);
  await sleep(wait);
  // 无头渲染里 CSS 过渡与定时器都慢，截图前把文案卡直接摆正
  await evaluate("(()=>{const h=document.querySelector('#hero'); h.style.opacity='1'; h.style.transform='translateY(0)';})()");
  await sleep(400);
};

const ONLY = process.argv[3] || 'all';

// 01 中庭
await move('atrium', 0, 2.7, -17.0, 0, 5.4, 0, 1600);
await shot('01-中庭星空.png');

// 02-06 五层
const chapters = JSON.parse(await evaluate('JSON.stringify(Object.fromEntries(Object.entries(window.__layout.chapters).map(([k,v])=>[k,{v:v.view.toArray(),l:v.wallPoint.toArray(),floor:v.floor}])))'));
const order = [
  ['pink', '02-一层-粉色时区.png'],
  ['sunrise', '03-二层-日出的方向.png'],
  ['sky', '04-三层-云的标本.png'],
  ['daily', '05-四层-生活的切片.png'],
  ['dusk', '06-五层-暮色收藏.png'],
];
for (const [key, name] of order) {
  const c = chapters[key];
  await move(key, ...c.v, ...c.l, 2100);
  await shot(name);
}

// 07 小白（点一下，抬爪招手）
await move('atrium', -6.6, 1.55, -9.2, -9.4, 1.05, -6.4, 1200);
await evaluate('window.__layout.dog.userData.excitedUntil = 1e9');
await sleep(1500);
await shot('07-小白.png');
await evaluate('window.__layout.dog.userData.excitedUntil = 0');

// 08 展信佳 + 沙漏
await evaluate("document.querySelector('[data-act=\"about\"]').click()");
await sleep(1500);
await shot('08-展信佳-沙漏.png');
await evaluate("document.getElementById('aboutModal').classList.remove('open')");
await sleep(600);

// 09 全部展品
await evaluate("document.querySelector('[data-act=\"all\"]').click()");
await sleep(1200);
await shot('09-全部展品.png');

ws.close();
chrome.kill();
await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
process.exit(0);
