import * as THREE from '../vendor/three.module.js';
import { CHAPTERS, FLOWERS, ATRIUM, PROFILE, SONGS } from './data.js';
import { buildMuseum, setupLights, DIM } from './museum.js';
import { CameraRig, Tour } from './controls.js';
import { MuseumPlayer } from './player.js';

const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------- 沙漏计时器（初相识 2026.12.07）
// 一天的沙从午夜开始往下漏，漏完翻一次沙漏——所以它一天翻一次身
const SINCE = new Date('2025-12-07T00:00:00+08:00').getTime();
const SAND_TOP = 34, SAND_NECK = 190, SAND_BOTTOM = 352;
let hgDay = null;

function tickTimer() {
  const daysEl = document.querySelector('#hgDays');
  if (!daysEl) return;
  const now = new Date();
  const ms = Math.abs(now.getTime() - SINCE);
  const before = now.getTime() < SINCE;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  // 还没到「初相识」那天时，天数前面挂个「还有」
  const pre = document.querySelector('#hgPre');
  if (pre) pre.textContent = before ? '还有' : '已经';
  daysEl.textContent = d.toLocaleString('zh-CN');
  const unit = document.querySelector('#hgUnit');
  if (unit) unit.textContent = before ? '天' : '天';
  const clock = document.querySelector('#hgClock');
  if (clock) clock.textContent = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');

  // 今天还剩下的比例 → 上方的沙还剩多少
  const secOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const f = 1 - secOfDay / 86400;
  hgPaint(f);

  // 跨过午夜：整个沙漏翻个身
  const today = Math.floor(now.getTime() / 86400000);
  if (hgDay !== null && today !== hgDay) flipHourglass();
  hgDay = today;
}

function hgPaint(f) {
  const top = document.querySelector('#hgSandTop');
  const bot = document.querySelector('#hgSandBot');
  const stream = document.querySelector('#hgStream');
  if (!top || !bot) return;
  const yTop = SAND_TOP + (SAND_NECK - SAND_TOP) * (1 - f);
  const yBot = SAND_BOTTOM - (SAND_BOTTOM - SAND_NECK) * (1 - f);
  top.setAttribute('points', `30,${yTop.toFixed(1)} 230,${yTop.toFixed(1)} 230,200 30,200`);
  bot.setAttribute('points', `30,${yBot.toFixed(1)} 230,${yBot.toFixed(1)} 230,362 30,362`);
  if (stream) {
    const hgt = Math.max(0, yBot - SAND_NECK - 2);
    stream.setAttribute('y', String(SAND_NECK - 2));
    stream.setAttribute('height', hgt.toFixed(1));
    stream.style.opacity = f > 0.002 && f < 0.999 ? '1' : '0';
  }
}

function flipHourglass() {
  const svg = document.querySelector('#hgSvg');
  if (!svg) return;
  svg.classList.add('flip');
  setTimeout(() => {
    svg.classList.add('no-anim');
    svg.classList.remove('flip');
    hgPaint(1);
    requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('no-anim')));
  }, 900);
}

setInterval(tickTimer, 1000);
tickTimer();

// ---------------------------------------------------------------- 基础三件套
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5eef0);
scene.fog = new THREE.FogExp2(0xf4edee, 0.0036);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 240);
setupLights(scene);

const maxAniso = renderer.capabilities.getMaxAnisotropy();
const texCache = new Map();
const texQueue = [];
let texActive = 0;
const MAX_TEX_LOADS = 18;   // 多开几条并行，加载更快（原来是 8）

async function loadImage(url) {
  if (self.createImageBitmap) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch fail ' + url);
    const blob = await res.blob();
    return await createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image error: ' + url));
    img.src = url;
  });
}

function makeTexture(img) {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.flipY = true;
  t.needsUpdate = true;
  return t;
}

function pumpTextures() {
  while (texActive < MAX_TEX_LOADS && texQueue.length) {
    const job = texQueue.shift();
    texActive++;
    loadImage(job.url)
      .then((img) => { texActive--; job.resolve(makeTexture(img)); pumpTextures(); })
      .catch((e) => { texActive--; job.reject(e); pumpTextures(); });
  }
}

function loadTexture(url) {
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise((resolve, reject) => {
    texQueue.push({ url, resolve, reject });
    pumpTextures();
  });
  texCache.set(url, p);
  return p;
}

// ---------------------------------------------------------------- 载入布展
const bar = $('#loaderBar');
const pct = $('#loaderPct');
let progress = 0;
let loaderHidden = false;
function hideLoader() {
  if (loaderHidden) return;
  loaderHidden = true;
  $('#loader').classList.add('done');
}
function setProgress(v) {
  progress = v;
  window.__texProgress = v;
  const n = Math.round(v * 100);
  bar.style.width = `${n}%`;
  pct.textContent = n >= 100 ? '布展完成 · 请进' : `正在布展 ${n}%`;
  if (v >= 0.999) hideLoader();
}

let layout, pickables = [];
let rig, tour, ui, player;
// 「陪你一起看」：index = 第几件；opened = 是否已经凑近当前这一件
const watch = { on: false, index: 0, opened: false };

async function boot() {
  const manifest = await (await fetch('js/manifest.json')).json();
  setProgress(0.04);   // 一开始就给个进度，别让人对着 0% 发呆

  const built = buildMuseum({
    scene, chapters: CHAPTERS, flowers: FLOWERS, manifest,
    loadTexture,
    onProgress: (p) => { setProgress(0.04 + p * 0.95); if (p >= 1) window.__texDone = true; },
  });
  pickables = built.pickables;
  layout = built.layout;
  layout.ceilStars = scene.children.find((o) => o.userData && o.userData.ceilStars) || null;

  // 镜头 & 导览
  rig = new CameraRig(camera, canvas);
  rig.setView(layout.atrium.view, layout.atrium.lookAt);

  const stops = [
    { pos: new THREE.Vector3(2.6, 2.6, -14.6), look: new THREE.Vector3(-5.0, 3.2, 26.5) },
    // 按楼层顺序巡展：一层一层往上（CHAPTERS 顺序 = 楼层顺序）
    ...CHAPTERS.map((ch) => {
      const c = layout.chapters[ch.id];
      return { pos: c.view.clone(), look: c.wallPoint.clone() };
    }),
    { pos: new THREE.Vector3(0, 1.7, 7.4), look: new THREE.Vector3(0, 4.6, 0) },
    { pos: new THREE.Vector3(0, 11.5, 11.5), look: new THREE.Vector3(0, 7.4, 0) },
  ];
  tour = new Tour(rig, stops, { leg: 8.5, hold: 2.4 });

  ui = initUI();
  bindPicking();

  // 一楼的电视：默认选中 Stay With Me，但一声不出，等你自己点
  player = new MuseumPlayer(SONGS, layout);
  player.setScene(scene);
  player.bindUI({
    listEl: document.getElementById('tvList'),
    artCanvas: document.getElementById('tvArt'),
    titleEl: document.getElementById('tvTitle'),
    subEl: document.getElementById('tvSub'),
  });
  player.startRaf();

  // 「一起听听」下面的播放状态：歌名 + 正在播放/暂停
  const npText = document.getElementById('npText');
  const npEl = document.getElementById('nowPlaying');
  const paintNowPlaying = (st) => {
    const song = SONGS.find((s) => s.id === st.current) || SONGS[0];
    npText.textContent = st.playing
      ? `正在播放 · ${song.cn} — ${song.en}`
      : `已选《${song.cn}》，点一下就唱`;
    npEl.classList.toggle('on', !!st.playing);
    // 切歌按钮：正在播的那首亮起来
    document.querySelectorAll('#songSwitch button').forEach((b) => {
      b.classList.toggle('active', b.dataset.song === st.current);
    });
  };
  player._onUpdate = paintNowPlaying;
  paintNowPlaying(player.state());
  // 点歌名直接切换播放（事件委托，元素什么时候出现都能点）
  // 再点一次正在播的那首 = 停止
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('#songSwitch button');
    if (!b) return;
    e.stopPropagation();
    if (tour && tour.active) tour.stop();
    if (player.current === b.dataset.song && player.playing) {
      player.pause();
    } else {
      player.play(b.dataset.song);
    }
  });
  window.__player = player;
  document.getElementById('tvScreen').addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById('tvPanel');
    const first = !panel.classList.contains('open');
    document.getElementById('ui').classList.add('tv-open');
    panel.classList.add('open');
    if (first) player.play(player.current); else player.toggle();
  });
  document.getElementById('tvPanel').addEventListener('click', (e) => e.stopPropagation());
  window.__watch = () => ({ ...watch });
  window.__order = () => layout.order.length;
  window.__watchStart = () => startWatch();
  window.__watchNext = (n = 1) => { for (let i = 0; i < n; i++) watchNext(); return watch.index; };
  window.__watchStop = () => stopWatch();

  // 调试接口
  window.__scene = scene;
  window.__THREE = THREE;
  window.__camera = camera;
  window.__rig = rig;
  window.__setCam = (x, y, z, lx = 0, ly = 3, lz = 0) => {
    ui.noteInteraction();
    if (tour.active) tour.stop();
    // 直接把机位钉死（自检用）
    rig.lockView(new THREE.Vector3(x, y, z), new THREE.Vector3(lx, ly, lz));
  };
  window.__state = () => ({ pos: rig.pos.toArray().map((n) => +n.toFixed(2)), active: tour.active, activeId: ui.state() });
  window.__layout = layout;
  window.__order = () => layout.order.length;
  window.__watchNext = (n = 1) => { for (let i = 0; i < n; i++) watchNext(); return watch.index; };
  window.__watchStart = () => startWatch();
  window.__watchStop = () => stopWatch();
  window.__focus = (id) => { focusPhoto(id); return ui.state(); };
  window.__closeFocus = () => closePhotoFocus();

  // 站到某张展品正前方（调试用）
  window.__facePhoto = (id, dist = 4.2) => {
    const rec = layout.photos[id];
    if (!rec) return 'no photo ' + id;
    const n = rec.normal.clone().normalize();
    const p = rec.position.clone().addScaledVector(n, dist);
    rig.setView(p, rec.position.clone(), 0);
    return [id, rec.position.toArray().map((v) => +v.toFixed(1)), n.toArray().map((v) => +v.toFixed(2))];
  };

  // 调试机位：?cam=x,y,z&look=x,y,z
  const qs = new URLSearchParams(location.search);
  if (qs.get('cam')) {
    const p = qs.get('cam').split(',').map(Number);
    const l = (qs.get('look') || '0,3,0').split(',').map(Number);
    rig.setView(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(l[0], l[1], l[2]));
    ui.noteInteraction();
  }

  setProgress(1);
  setTimeout(hideLoader, 620);

  // 开幕后镜头只在「能看见大部分展品」的中庭机位轻轻漂一下，
  // 不乱飞整座塔（想看全馆就点「陪你一起看看」或者自动导览）
  setTimeout(() => {
    if (!ui.hasUserInteracted) ui.markIdleAmbient();
  }, 1500);

  // 切到别的标签页时把声音收掉
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && player && player.playing) player.pause();
  });

  animate();
}

// ---------------------------------------------------------------- 陪你一起看
// 从一楼第一件开始，一件一件往前走；点一下画面 = 凑近这一件，
// 再点一下 = 退回上一步（退回上一件，第一件就退回中庭全景）
function order() { return layout.order || []; }

function watchNext() {
  const ids = order();
  if (!ids.length) return;
  // 第一遍：还在全景上就先凑近这一件；已经凑近了才往前走
  if (!watch.opened) { watch.opened = true; applyWatch(1.2); return; }
  watch.index = Math.min(ids.length - 1, watch.index + 1);
  watch.opened = true;
  applyWatch(1.2);
}

function watchPrev() {
  const ids = order();
  if (!ids.length) return;
  if (watch.opened) { watch.opened = false; applyWatch(1.0); return; }
  if (watch.index === 0) { stopWatch(); return; }
  watch.index -= 1;
  watch.opened = false;
  applyWatch(1.15);
}

function applyWatch(dur = 1.1) {
  const ids = order();
  const id = ids[watch.index];
  const rec = layout.photos[id];
  if (!rec) return;
  if (tour.active) tour.stop();
  // 先退到本层环廊上「看整面墙」的位置，再凑近
  const ch = rec.chapter;
  if (!watch.opened) {
    const cam = layout.chapters[ch.id];
    if (cam && rec.floor > 0) rig.flyTo(cam.view, rec.wallPoint, dur);
    else rig.flyTo(rec.view, rec.look, dur);
  } else {
    rig.flyTo(rec.view, rec.look, dur);
  }
  ui.setActiveChapter(ch.id);
  ui.syncWatch();
}

function startWatch() {
  if (!order().length) return;
  watch.on = true;
  watch.index = 0;
  watch.opened = true;
  document.body.classList.add('watching');
  ui.noteInteraction();
  applyWatch(1.5);
}

function stopWatch() {
  if (!watch.on) return;
  watch.on = false;
  watch.opened = false;
  document.body.classList.remove('watching');
  ui.goTo('atrium');
}

// ---------------------------------------------------------------- 拾取
const raycaster = new THREE.Raycaster();
let hovered = null;

function bindPicking() {
  rig.onHover = (nx, ny) => {
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    // 电视优先
    const tv = layout.tv;
    if (tv && raycaster.intersectObject(tv.group, true).length) {
      hovered = tv.group;
      canvas.style.cursor = 'pointer';
      showCaption({ num: '♫', cn: '一楼的电视', caption: player.playing ? '正在放歌 · 点一下可以暂停' : '点一下，看它亮起来' });
      return;
    }
    // 小白：碰到它就打招呼
    const dog = layout.dog;
    if (dog && raycaster.intersectObject(dog, true).length) {
      hovered = dog;
      canvas.style.cursor = 'pointer';
      showCaption({ num: '🐾', cn: '小白', caption: '汪！点我一下，我给你招手' });
      return;
    }
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit) {
      hovered = hit.object;
      canvas.style.cursor = 'pointer';
      showCaption(hit.object.userData.pick);
    } else {
      hovered = null;
      canvas.style.cursor = '';
      hideCaption();
    }
  };

  rig.onTap = (nx, ny) => {
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const tv = layout.tv;
    if (tv && raycaster.intersectObject(tv.group, true).length) {
      // 点电视：直接开声（默认那首），再点一下暂停
      if (player.playing) player.toggle(); else player.play(player.current);
      showCaption({ num: '♪', cn: '一起听听', caption: player.playing ? '正在播放' : '点一下，看它亮起来' }, true);
      setTimeout(() => hideCaption(), 2200);
      return;
    }
    const dog = layout.dog;
    if (dog && raycaster.intersectObject(dog, true).length) {
      dogReact();
      openDogChat();
      return;
    }
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit) {
      const id = hit.object.userData.pick.id;
      // 「陪你一起看」里：点一下凑近这件，再点一下退回上一步
      if (watch.on) {
        const idx = order().indexOf(id);
        if (idx >= 0 && idx !== watch.index) {
          watch.index = idx;
          watch.opened = true;
          applyWatch(1.1);
          return;
        }
        watch.opened = !watch.opened;
        applyWatch(watch.opened ? 1.15 : 1.0);
        return;
      }
      focusPhoto(id);
      return;
    }
    // 点空处：陪你一起看时就是「再点一下退回」
    if (watch.on) { watchPrev(); return; }
    document.getElementById('ui').classList.remove('tv-open');
  };

  window.__pick = (nx, ny) => {
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return hit ? { id: hit.object.userData.pick.id, caption: hit.object.userData.pick.caption } : null;
  };
  window.__pickTV = (nx, ny) => {
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    return !!raycaster.intersectObject(layout.tv.group, true).length;
  };

  rig.onInteract = () => {
    ui.noteInteraction();
    if (tour && tour.active) tour.stop();
    // 自己动了镜头，就不再「陪你」走了（状态条先留着，可以继续按下一件）
    if (watch.on && watch.opened) { watch.opened = false; ui.syncWatch(); }
  };
}

// 凑近某一张时：暂时不让楼层检测改写章节名，也不让「没人动就回中庭」打断
let focusHold = 0;

function focusPhoto(id) {
  const rec = layout.photos[id];
  if (!rec) return;
  if (tour.active) tour.stop();
  // 尽量在原位把视线转过去：站得太远才往前飞一点
  const pos = rig.pos.clone();
  const dir = rec.position.clone().sub(pos);
  const dist = dir.length();
  const dist0 = Math.max(3.0, (rec.size ? rec.size.pw : 3) * 1.05);
  if (dist > dist0 * 1.9) {
    const t = pos.clone().addScaledVector(dir.normalize(), dist - dist0);
    t.y = Math.max(rig.pos.y, rec.position.y - 0.25);
    rig.flyTo(t, rec.position, 1.45);
  } else {
    rig.flyTo(pos, rec.position, 1.15);   // 原地转头
  }
  ui.setActiveChapter(rec.chapter.id);
  showCaption(rec.mesh.userData.pick, true);
  const pc = $('#photoClose');
  if (pc) { pc.classList.add('show'); pc.dataset.id = id; }
  setTimeout(() => hideCaption(), 3200);
  focusHold = 3.5;
}

// 关掉凑近的这一张：退回本层的环廊，重新看整面墙
function closePhotoFocus() {
  const pc = $('#photoClose');
  const id = pc && pc.dataset.id;
  if (pc) { pc.classList.remove('show'); pc.dataset.id = ''; }
  hideCaption();
  const rec = id && layout.photos[id];
  const ch = rec && layout.chapters[rec.chapter.id];
  if (ch && ch.view) rig.flyTo(ch.view, ch.lookAt, 1.4);
}

// 点小白：开心得跳起来，尾巴摇成风车，抬起前爪招手
const DOG_LINES = ['汪汪！你也在这里呀', '汪～今天也超好看', '摸摸头，我一直都在', '小白最喜欢你了'];
function dogReact() {
  const d = layout.dog;
  if (!d) return;
  d.userData.excitedUntil = clock.elapsedTime + 2.6;
  const line = DOG_LINES[Math.floor(Math.random() * DOG_LINES.length)];
  showCaption({ num: '🐾', cn: '小白', caption: line }, true);
  setTimeout(hideCaption, 2600);
}

// ---- 小白聊天机器人 ----
const dogChatEl = document.getElementById('dogChat');
const dogMsgsEl = document.getElementById('dogMsgs');
const dogInputEl = document.getElementById('dogInput');
let chatGreeted = false;

// 小白懂什么：关键词 → 回复池（每次随机挑一句）
let isOwner = false;   // 答对姓名缩写后就是主人啦
const DOG_BRAIN = [
  // 主人专属暗号（要放最前面，优先匹配）
  [/^\s*yyy\s*$/i, () => {
    isOwner = true;
    return '主人，你好呀！我会一直陪着你。';
  }],
  [/^\s*ly\s*$/i, () => '再惹主人生气，就咬你'],
  // 报了别的姓名缩写/昵称（纯字母，1-12位）：请善待主人
  [/^\s*[a-z][a-z.·-]{0,11}\s*$/i, () => isOwner ? '汪？你谁呀，不认识' : '请做我主人最好的朋友，不要惹她生气哦！'],
  [/主人|姓名|缩写|暗号/, [
    isOwner ? '汪！主人你忘了吗，你的姓名缩写是 yyy 呀' : '告诉我你的姓名缩写，我就知道你是不是主人啦～',
  ]],
  [/你好|您好|hi|hello|嗨|哈喽|在吗/i, [
    '汪汪！你好呀～我是小白，馆里的萨摩耶向导！',
    '汪～你来啦！我从早上就开始等你了',
  ]],
  [/你是谁|你叫什么|介绍|向导/, [
    '我是小白！一只会看展的萨摩耶🐾 这座「碎碎念念」展塔就是我家，随时带你逛',
  ]],
  [/歌|音乐|听|唱|播放/, [
    "点电视或「一起听听」就能放歌哟～现在有三首：Stay With Me、粉雾海、Baby, Don't Cry。再点一次同一首就会停下来",
  ]],
  [/楼层|怎么逛|导览|路线|怎么玩| help /i, [
    '按数字键 1–4 直接飞到某一层，0 回中庭；点「陪你一起看看」，我会陪你自动逛完全馆～',
  ]],
  [/照片|展品|画|图片|看什么/, [
    '凑近看哪张就点哪张，右下角「关掉这张」随时退回来；顶部「全部展品」能一次翻完所有作品',
  ]],
  [/烟花|特效|点击/, [
    '在画面上随便点一下，就会放一朵小烟花，还会飘出「生活顺利」哦🎆',
  ]],
  [/时间|多久|沙漏|计时|纪念/, [
    '沙漏从 2025年12月7日 开始计，滴答滴答替你记着每一天',
  ]],
  [/喜欢|爱你|想你|可爱|乖/, [
    '汪汪！我也最喜欢你啦，尾巴都摇成风车了',
  ]],
  [/谢谢|感谢|辛苦/, [
    '不客气！摸摸头就好汪～',
  ]],
  [/再见|拜拜|晚安|走了/, [
    '汪呜～下次再来玩，我一直在电视旁边等你！',
  ]],
];
const DOG_FALLBACK = [
  '汪汪？(歪头) 呜…换种说法再说一遍好不好',
  '汪！这个我不太懂，不过你笑起来真好看',
  '尾巴摇了摇——要不要问问歌曲、楼层或者烟花怎么玩？',
  '呜汪…我只是一只狗狗，但我会努力听懂的！',
];

function dogReply(text) {
  for (const [re, pool] of DOG_BRAIN) {
    if (re.test(text)) {
      const r = typeof pool === 'function' ? pool(text) : pool[Math.floor(Math.random() * pool.length)];
      return typeof r === 'function' ? r(text) : r;
    }
  }
  return DOG_FALLBACK[Math.floor(Math.random() * DOG_FALLBACK.length)];
}

function addDogMsg(cls, text) {
  const d = document.createElement('div');
  d.className = `dc-msg ${cls}`;
  d.textContent = text;
  dogMsgsEl.appendChild(d);
  dogMsgsEl.scrollTop = dogMsgsEl.scrollHeight;
}

function openDogChat() {
  dogChatEl.classList.add('open');
  if (!chatGreeted) {
    chatGreeted = true;
    setTimeout(() => addDogMsg('dog', '汪汪！我是小白～可以问我歌、楼层、烟花怎么玩哟'), 280);
    // 跟着问主人的名字缩写
    setTimeout(() => addDogMsg('dog', '你是我的主人吗？你要先告诉我你的姓名缩写哦？'), 1900);
  }
}

function sendDogMsg() {
  const t = dogInputEl.value.trim();
  if (!t) return;
  dogInputEl.value = '';
  addDogMsg('me', t);
  // 思考中…
  const tip = document.createElement('div');
  tip.className = 'dc-typing';
  tip.innerHTML = '<i></i><i></i><i></i>';
  dogMsgsEl.appendChild(tip);
  dogMsgsEl.scrollTop = dogMsgsEl.scrollHeight;
  setTimeout(() => {
    tip.remove();
    addDogMsg('dog', dogReply(t));
    // 回答的时候高兴地摇尾巴
    if (layout.dog) layout.dog.userData.excitedUntil = clock.elapsedTime + 2.2;
  }, 650 + Math.random() * 500);
}

document.getElementById('dogSend').addEventListener('click', sendDogMsg);
dogInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendDogMsg(); });
document.getElementById('dogChatClose').addEventListener('click', () => dogChatEl.classList.remove('open'));

// 手机 / 平板打开时的温馨提醒：用电脑观看体验更好
{
  const tip = document.getElementById('mobileTip');
  const isMobile = matchMedia('(max-width: 820px)').matches
    || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (isMobile) {
    setTimeout(() => {
      tip.classList.add('show');
      setTimeout(() => tip.classList.remove('show'), 6500);
    }, 1800);
  }
}

let capTimer = null;
function showCaption(pick, sticky = false) {
  if (!pick) return;
  $('#capNum').textContent = `${pick.num} · ${pick.cn}`;
  $('#capTitle').textContent = pick.caption || '';
  const cap = $('#caption');
  cap.classList.add('show');
  clearTimeout(capTimer);
  if (!sticky) capTimer = setTimeout(() => cap.classList.remove('show'), 2600);
}
function hideCaption() {
  clearTimeout(capTimer);
  $('#caption').classList.remove('show');
}

// ---------------------------------------------------------------- 界面
function initUI() {
  const chapterBar = $('#chapterBar');
  const exList = $('#exList');
  const state = { activeId: 'atrium', hasUserInteracted: false, heroTimer: null };

  // 底部章节条（按楼层分组）
  const floorOf = (id) => {
    const c = layout.chapters[id];
    return c ? (c.floor || 0) : 0;
  };
  const allEntries = [{ id: 'atrium', num: '00', cn: '逆转时间' }, ...CHAPTERS];
  let lastFloor = -1;
  allEntries.forEach((ch) => {
    const f = floorOf(ch.id);
    if (f !== lastFloor) {
      const sep = document.createElement('span');
      sep.className = 'fl-sep';
      sep.textContent = `${f + 1}F`;
      chapterBar.appendChild(sep);
      lastFloor = f;
    }
    const b = document.createElement('button');
    b.dataset.id = ch.id;
    b.innerHTML = `<i>${ch.num}</i>${ch.cn}`;
    b.addEventListener('click', () => goTo(ch.id));
    chapterBar.appendChild(b);
  });

  // 右侧展品目录（编号从大到小，带楼层）
  const rev = [...CHAPTERS].reverse();
  rev.forEach((ch) => {
    const c = layout.chapters[ch.id];
    const li = document.createElement('li');
    li.dataset.id = ch.id;
    li.innerHTML = `<span class="num">${ch.num}</span><span class="name">${ch.cn}</span><span class="cnt">${c.count} 件</span>`;
    li.title = `${(c.floor || 0) + 1}F`;
    li.addEventListener('click', () => goTo(ch.id));
    exList.appendChild(li);
  });

  function goTo(id) {
    state.hasUserInteracted = true;
    if (tour.active) tour.stop();
    if (watch.on && id !== 'atrium') { watch.on = false; document.body.classList.remove('watching'); }
    if (id === 'atrium') {
      rig.flyTo(layout.atrium.view, layout.atrium.lookAt, 1.6);
    } else {
      const c = layout.chapters[id];
      rig.flyTo(c.view, c.wallPoint, 1.7);
    }
    setActiveChapter(id);
  }

  function setActiveChapter(id) {
    if (state.activeId === id) return;
    state.activeId = id;
    [...chapterBar.children].forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    [...exList.children].forEach((li) => li.classList.toggle('on', li.dataset.id === id));

    const data = id === 'atrium' ? ATRIUM : layout.chapters[id];
    const hero = $('#hero');
    hero.style.opacity = '0';
    hero.style.transform = 'translateY(6px)';
    clearTimeout(state.heroTimer);
    state.heroTimer = setTimeout(() => {
      $('#heroTitle').innerHTML = data.headline;
      $('#heroEn').textContent = data.en;
      $('#heroDesc').textContent = data.desc;
      $('#heroNum').textContent = data.num;
      $('#heroCn').textContent = data.cn;
      const fl = $('#heroFloor');
      if (id === 'atrium') {
        fl.textContent = '0F';
        fl.classList.add('dim');
      } else {
        fl.textContent = `${(data.floor || 0) + 1}F`;
        fl.classList.remove('dim');
      }
      hero.style.opacity = '1';
      hero.style.transform = 'translateY(0)';
    }, 240);
  }

  // 自动导览
  const tourBtn = $('#tourBtn');
  tourBtn.addEventListener('click', () => {
    state.hasUserInteracted = true;
    tour.toggle();
  });
  tour.onChange = (active) => tourBtn.classList.toggle('on', active);
  tourBtn.classList.add('on');

  // 全屏
  $('#fsBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  // 主要按钮
  // 逆转时间：回到中庭那个能看见大部分照片的机位
  $('#enterBtn').addEventListener('click', () => {
    state.hasUserInteracted = true;
    if (watch.on) stopWatch();
    goTo('atrium');
    showCaption({ num: '00', cn: '逆转时间', caption: '时间被倒回去了，我们再看一遍' }, true);
    setTimeout(() => hideCaption(), 2600);
  });
  // 陪你一起看看：从一楼第一件开始，一件一件往前走
  $('#watchBtn').addEventListener('click', () => {
    state.hasUserInteracted = true;
    startWatch();
  });
  // 一起听听：原地直接放歌，不跑镜头（默认 Stay With Me）
  $('#listenBtn').addEventListener('click', () => {
    state.hasUserInteracted = true;
    player.toggle();
  });
  $('#wbNext').addEventListener('click', () => watchNext());
  $('#wbPrev').addEventListener('click', () => watchPrev());
  $('#wbExit').addEventListener('click', () => stopWatch());
  $('#photoClose').addEventListener('click', (e) => { e.stopPropagation(); closePhotoFocus(); });

  // 点哪儿哪儿开花：一小圈彩色粒子 + 「生活顺利」飘上来
  const FW_COLORS = ['#ff8fb5', '#ffc2d6', '#ffd76e', '#9ad7ff', '#d9a7ff', '#ff6f91'];
  const fxBursts = [];
  window.__fxCount = () => fxBursts.length;
  const spawnFirework = (x, y) => {
    const b = document.createElement('div');
    b.className = 'fw-burst';
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    const N = 20;
    const parts = [];
    for (let i = 0; i < N; i++) {
      const s = document.createElement('i');
      const ang = (i / N) * Math.PI * 2 + Math.random() * 0.35;
      const dist = 42 + Math.random() * 62;
      const color = FW_COLORS[i % FW_COLORS.length];
      s.style.background = color;
      s.style.boxShadow = `0 0 10px ${color}`;
      b.appendChild(s);
      parts.push({
        el: s,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        delay: Math.random() * 80,
        dur: 880 + Math.random() * 260,
      });
    }
    const tEl = document.createElement('span');
    tEl.className = 'fw-text';
    tEl.textContent = '生活顺利';
    b.appendChild(tEl);
    document.body.appendChild(b);
    fxBursts.push({ el: b, t0: performance.now(), parts, text: tEl, drift: Math.random() * 40 - 20 });
  };
  // 每帧手动推进（走 rAF，任何环境下都画得出来）
  const updateFireworks = () => {
    const now = performance.now();
    for (let i = fxBursts.length - 1; i >= 0; i--) {
      const fx = fxBursts[i];
      const age = now - fx.t0;
      if (age > 1500) { fx.el.remove(); fxBursts.splice(i, 1); continue; }
      fx.parts.forEach((p) => {
        const k = Math.min(1, Math.max(0, (age - p.delay) / p.dur));
        const e = 1 - Math.pow(1 - k, 3);
        p.el.style.transform = `translate(${(p.dx * e).toFixed(1)}px, ${(p.dy * e).toFixed(1)}px) scale(${(1 - 0.8 * k).toFixed(2)})`;
        p.el.style.opacity = String((1 - k).toFixed(2));
      });
      const kt = Math.min(1, age / 1250);
      const rise = 12 - 92 * (1 - Math.pow(1 - kt, 2));
      const fade = kt < 0.18 ? kt / 0.18 : Math.max(0, 1 - (kt - 0.18) / 0.82);
      fx.text.style.transform = `translate(calc(-50% + ${(fx.drift * kt).toFixed(1)}px), ${rise.toFixed(1)}px) scale(${(0.72 + 0.34 * Math.min(1, kt * 5)).toFixed(2)})`;
      fx.text.style.opacity = fade.toFixed(2);
    }
  };
  document.getElementById('scene').addEventListener('click', (e) => {
    spawnFirework(e.clientX, e.clientY);
  });
  window.__firework = (x = innerWidth / 2, y = innerHeight / 2) => spawnFirework(x, y);
  fxTick = updateFireworks;   // 交给主循环推进
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((x) => x.classList.toggle('active', x === b));
      const act = b.dataset.act;
      if (act === 'hall') { closeAll(); goTo('atrium'); }
      if (act === 'all') buildAllModal();
      if (act === 'about') buildAbout();
    });
  });

  // 弹层
  function closeAll() {
    document.querySelectorAll('.modal').forEach((m) => m.classList.remove('open'));
  }
  document.querySelectorAll('[data-close]').forEach((b) => {
    b.addEventListener('click', () => document.getElementById(b.dataset.close).classList.remove('open'));
  });
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAll(); if (watch.on) stopWatch(); }
    // 数字键快速换层：0 = 中庭，1~4 = 对应楼层
    if (/^[0-4]$/.test(e.key) && !e.repeat && CHAPTERS[+e.key - 1]) {
      state.hasUserInteracted = true;
      goTo(e.key === '0' ? 'atrium' : CHAPTERS[+e.key - 1].id);
    }
    // 「陪你一起看」时：→ / 空格 = 下一件，← = 退回上一步
    if (watch.on && !e.repeat) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); watchNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); watchPrev(); }
    }
  });

  function buildAllModal() {
    const body = $('#allBody');
    if (body.dataset.built) { $('#allModal').classList.add('open'); return; }
    const groups = [...CHAPTERS, FLOWERS];
    groups.forEach((ch) => {
      const list = Object.values(layout.photos).filter((p) => p.chapter.id === ch.id);
      const sec = document.createElement('section');
      sec.className = 'group';
      sec.innerHTML = `
        <div class="group-head">
          <span class="g-num">${ch.num}</span>
          <span class="g-cn">${ch.cn}</span>
          <span class="g-en">${ch.en}</span>
          <em></em>
          <span class="g-en">${list.length} 件</span>
        </div>
        <div class="grid"></div>`;
      const grid = sec.querySelector('.grid');
      list.forEach((p) => {
        const card = document.createElement('figure');
        card.className = 'card';
        card.innerHTML = `<img loading="lazy" src="${p.photo.file}" alt="${p.photo.caption || ''}">
          <div class="c-meta"><span class="c-title">${p.photo.caption || ''}</span><span>${p.photo.id.split('-')[1]}</span></div>`;
        card.addEventListener('click', () => {
          closeAll();
          state.hasUserInteracted = true;
          focusPhoto(p.id);
        });
        grid.appendChild(card);
      });
      body.appendChild(sec);
    });
    body.dataset.built = '1';
    $('#allModal').classList.add('open');
  }

  function buildAbout() {
    const body = $('#aboutBody');
    body.innerHTML = `
      <div class="letter-grid">
        <div class="letter">
          <div class="letter-head">
            <span class="letter-en">${PROFILE.en}</span>
            <h3 class="letter-title">${PROFILE.title}</h3>
            <span class="letter-date">${PROFILE.date}</span>
          </div>
          ${PROFILE.paragraphs.map((p) => `<p class="letter-p">${p}</p>`).join('')}
          <div class="letter-sign">${PROFILE.sign}</div>
        </div>

        <!-- 时间沙漏：初相识 2026.12.07，每一天漏完一次就翻个身 -->
        <aside class="hg-card">
          <div class="hg-head"><span>ALWAYS ONLINE</span><i></i><span>2026.12.07</span></div>
          <div class="hg-stage">
            <svg class="hg-svg" id="hgSvg" viewBox="0 0 260 400" aria-hidden="true">
              <defs>
                <linearGradient id="hgWood" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#f0d3dd"/>
                  <stop offset=".45" stop-color="#d79fb4"/>
                  <stop offset="1" stop-color="#b97b93"/>
                </linearGradient>
                <linearGradient id="hgGlass" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#ffffff" stop-opacity=".82"/>
                  <stop offset=".45" stop-color="#ffeeF4" stop-opacity=".38"/>
                  <stop offset="1" stop-color="#ffffff" stop-opacity=".7"/>
                </linearGradient>
                <linearGradient id="hgSand" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#f0b9c9"/>
                  <stop offset=".5" stop-color="#d2789a"/>
                  <stop offset="1" stop-color="#b2577b"/>
                </linearGradient>
                <radialGradient id="hgHalo">
                  <stop offset="0" stop-color="#ffd9e6" stop-opacity=".85"/>
                  <stop offset=".55" stop-color="#ffd0e0" stop-opacity=".28"/>
                  <stop offset="1" stop-color="#ffd0e0" stop-opacity="0"/>
                </radialGradient>
                <clipPath id="hgTopClip">
                  <path d="M58,30 H202 C202,118 154,158 137,192 H123 C106,158 58,118 58,30 Z"/>
                </clipPath>
                <clipPath id="hgBotClip">
                  <path d="M123,200 H137 C154,234 202,274 202,358 H58 C58,274 106,234 123,200 Z"/>
                </clipPath>
              </defs>

              <ellipse cx="130" cy="196" rx="118" ry="168" fill="url(#hgHalo)"/>

              <!-- 木框 -->
              <rect x="42" y="14" width="176" height="13" rx="6.5" fill="url(#hgWood)"/>
              <rect x="42" y="361" width="176" height="13" rx="6.5" fill="url(#hgWood)"/>
              <rect x="55" y="22" width="4.5" height="345" rx="2.2" fill="#d9a3b7" opacity=".55"/>
              <rect x="200" y="22" width="4.5" height="345" rx="2.2" fill="#d9a3b7" opacity=".55"/>

              <!-- 玻璃瓶身 -->
              <path d="M58,30 H202 C202,118 154,158 137,192 H123 C106,158 58,118 58,30 Z"
                    fill="url(#hgGlass)" stroke="#ddb6c4" stroke-width="1.3"/>
              <path d="M123,200 H137 C154,234 202,274 202,358 H58 C58,274 106,234 123,200 Z"
                    fill="url(#hgGlass)" stroke="#ddb6c4" stroke-width="1.3"/>

              <!-- 沙 -->
              <polygon id="hgSandTop" points="30,34 230,34 230,200 30,200" fill="url(#hgSand)" clip-path="url(#hgTopClip)"/>
              <polygon id="hgSandBot" points="30,352 230,352 230,362 30,362" fill="url(#hgSand)" clip-path="url(#hgBotClip)"/>
              <rect id="hgStream" x="128.6" y="188" width="2.8" height="0" rx="1.4" fill="#c86c8c"/>

              <!-- 玻璃的高光 -->
              <path d="M74,44 C74,110 104,148 122,182" stroke="#ffffff" stroke-width="3.4" fill="none"
                    opacity=".7" stroke-linecap="round"/>
              <path d="M188,44 C188,110 158,148 140,182" stroke="#ffffff" stroke-width="1.8" fill="none"
                    opacity=".4" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="hg-count"><em id="hgPre">还有</em><b id="hgDays">—</b><span id="hgUnit">天</span></div>
          <div class="hg-clock" id="hgClock">00:00:00</div>
          <div class="hg-cap">${PROFILE.timerCaption}</div>
        </aside>
      </div>`;
    $('#aboutModal').classList.add('open');
    hgDay = null;
    tickTimer();
  }

  // 触屏方向键
  document.querySelectorAll('#dpad button').forEach((b) => {
    const code = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[b.dataset.move];
    const press = (e) => { e.preventDefault(); rig.keys.add(code); state.hasUserInteracted = true; if (tour.active) tour.stop(); };
    const release = () => rig.keys.delete(code);
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointerleave', release);
    b.addEventListener('pointercancel', release);
  });

  setActiveChapter('atrium');

  // 陪你一起看：把状态条上的字和后一张的名字刷出来
  function syncWatch() {
    const ids = order();
    const id = ids[watch.index];
    const rec = id && layout.photos[id];
    if (!rec) return;
    $('#wbNum').textContent = `${rec.chapter.num} · ${rec.chapter.cn}`;
    $('#wbTitle').textContent = rec.mesh.userData.pick.caption || '';
    $('#wbCount').textContent = `${watch.index + 1} / ${ids.length}`;
    $('#wbProg').style.width = `${((watch.index + 1) / ids.length) * 100}%`;
    const nxt = ids[watch.index + 1] && layout.photos[ids[watch.index + 1]];
    $('#wbNext').textContent = nxt ? '下一件 →' : '回到第一件';
    document.body.classList.toggle('watching', watch.on);
  }

  // 没人动的时候：镜头只在这个「看得见大部分展品」的机位轻轻呼吸
  function markIdleAmbient() {
    rig.flyTo(layout.atrium.view, layout.atrium.lookAt, 2.4);
  }

  return {
    goTo,
    setActiveChapter,
    syncWatch,
    markIdleAmbient,
    state: () => state.activeId,
    noteInteraction: () => { state.hasUserInteracted = true; },
    get hasUserInteracted() { return state.hasUserInteracted; },
  };
}

// ---------------------------------------------------------------- 主循环
const clock = new THREE.Clock();
let activeCheck = 0;
let detectedId = 'atrium';
let detectedAt = 0;
let fxTick = null;      // 点击烟花的每帧推进（在 init 里赋上）

function animate() {
  requestAnimationFrame(animate);
  window.__frames = (window.__frames || 0) + 1;
  const dt = Math.min(clock.getDelta(), 0.06);
  const t = clock.elapsedTime;
  if (focusHold > 0) focusHold = Math.max(0, focusHold - dt);
  if (fxTick) fxTick();

  tour.update(dt);
  rig.update(dt);

  // 悬浮展板轻轻呼吸
  Object.values(layout.photos).forEach((rec) => {
    if (rec.floating) {
      const f = rec.floating.userData.float;
      rec.floating.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * 0.11;
      if (f.baseRot !== undefined) {
        rec.floating.rotation.y = f.baseRot + Math.sin(t * 0.22 + f.phase) * 0.05;
      }
    }
  });

  // 小白：摇尾巴、呼吸、歪头、吐舌头；点了会跳起来抬爪招手
  const dog = layout.dog;
  if (dog) {
    const u = dog.userData;
    const excited = t < u.excitedUntil;
    const speed = excited ? 15 : 4.6;
    u.tail.rotation.y = Math.sin(t * speed) * (excited ? 0.55 : 0.26);
    u.tail.rotation.x = Math.sin(t * speed * 0.5) * (excited ? 0.22 : 0.1);
    dog.scale.y = u.baseScale * (1 + Math.sin(t * 2.1) * 0.012);
    u.head.rotation.z = Math.sin(t * 0.5) * 0.06;
    u.head.rotation.y = Math.sin(t * 0.33) * 0.13;
    u.tongue.rotation.x = Math.sin(t * (excited ? 9 : 3.2)) * 0.22;
    // 抬爪：平时垂着，被点的时候举起来挥
    u.paw.rotation.x += ((excited ? -1.45 : -0.12) - u.paw.rotation.x) * 0.14;
    u.paw.rotation.z = excited ? Math.sin(t * 13) * 0.3 : 0;
    dog.position.y = u.baseY + (excited ? Math.abs(Math.sin(t * 6.5)) * 0.26 : 0);
    if (u.label) {
      u.label.position.y = u.labelY + Math.sin(t * 1.5) * 0.045;
      u.label.material.opacity = 0.9 + Math.sin(t * 1.5) * 0.08;
    }
  }

  // 电视旁边的几只小动物：音乐一响就一起蹦起来，停了就慢慢停下
  if (layout.dancers) {
    const dancing = player && player.playing ? 1 : 0;
    layout.dancers.forEach((a) => {
      const u = a.userData.hop;
      if (!u) return;
      u.amp += (dancing - u.amp) * (dancing ? 0.06 : 0.05);
      const hop = Math.abs(Math.sin(t * u.speed + u.phase));
      a.position.y = u.baseY + hop * 0.42 * u.amp;
      a.rotation.z = Math.sin(t * u.speed * 0.5 + u.phase) * 0.09 * u.amp;
      a.rotation.y = (a.userData.baseRot ?? a.rotation.y) + Math.sin(t * 1.2 + u.phase) * 0.13 * u.amp;
      if (a.userData.hands) {
        a.userData.hands.forEach((h, i) => {
          h.rotation.z = (i ? -1 : 1) * (Math.sin(t * u.speed * 1.3 + u.phase) * 0.7) * u.amp;
        });
      }
    });
  }

  // 天花上的星星：很慢地亮一下暗一下
  if (layout.ceilStars && layout.ceilStars.material) {
    layout.ceilStars.material.opacity = 0.62 + 0.24 * Math.sin(t * 0.7);
  }

  // 一层的装饰：粉雾球上下浮、花瓣慢悠悠地转
  if (layout.decor) {
    layout.decor.children.forEach((o) => {
      if (o.userData.float) {
        const f = o.userData.float;
        o.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * 0.16;
        o.rotation.y += dt * 0.18;
      }
    });
  }

  // 顶上的千纸鹤：绕圈盘旋 + 扇翅膀 + 轻轻起伏
  if (layout.cranes) {
    layout.cranes.userData.birds.forEach((b) => {
      const u = b.userData;
      u.a += dt * u.speed;
      b.position.set(Math.sin(u.a) * u.r, u.y + Math.sin(t * 0.8 + u.bob) * 0.3, Math.cos(u.a) * u.r);
      b.rotation.y = u.a + Math.PI / 2;   // 头朝前进方向
      const flap = Math.sin(t * 5 + u.flap) * 0.6;
      u.wingL.rotation.z = flap;
      u.wingR.rotation.z = -flap;
    });
  }
  // 顶部的小灯：呼吸式明暗
  if (layout.ceilLights) {
    layout.ceilLights.userData.lamps.forEach((l, i) => {
      const s = 0.75 + Math.sin(t * 1.4 + l.userData.phase) * 0.25;
      l.userData.shade.material.emissiveIntensity = 0.55 + s * 0.55;
    });
  }

  // 章节检测：一座塔，一层一个主题——按镜头高度判断所在楼层即章节；
  // 贴近中庭中心（r<18）仍算「00 逆转时间」。0.5s 稳定判定防抖
  activeCheck += dt;
  if (activeCheck > 0.2 && !focusHold) {
    activeCheck = 0;
    const r = Math.hypot(rig.pos.x, rig.pos.z);
    let found = 'atrium';
    if (r >= 18 && layout.floors) {
      const fi = Math.max(0, Math.min(layout.floors.length - 1, Math.round((rig.pos.y - 1.7) / DIM.LH)));
      found = layout.floors[fi].ids[0];
    }
    if (found !== detectedId) {
      detectedId = found;
      detectedAt = t;
    } else if (found !== ui.state() && t - detectedAt > 0.5) {
      ui.setActiveChapter(found);
    }
  }

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- 尺寸
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
});

boot().catch((err) => {
  console.error(err);
  pct.textContent = '布展失败：' + err.message;
});
