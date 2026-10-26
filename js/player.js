// ---------------------------------------------------------------------------
// 一楼的电视：三首歌，默认选中「Stay With Me」，点一下才开始放
//
// 音频来源：优先找 site/assets/audio/ 下的同名文件（换成真歌只要丢文件进去）；
// 找不到时用 Web Audio 现场合成一段「钢琴八音盒」版的旋律，保证电视永远有声音。
// 播放时会把几缕「声音」以光带的形式飘进中庭——歌一响，光就跟着晃。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three.module.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- 三首曲子（大调五声，164 BPM 的慢摇）------------------------------
// 每条 [音高, 拍数]，音高是 MIDI 编号，0 = 休止
const N = { E4: 64, Fs4: 66, Gs4: 68, A4: 69, B4: 71, Cs5: 73, D5: 74, E5: 76, Fs5: 78, Gs5: 80, A5: 81, B5: 83, Cs6: 85 };

// 1) Stay With Me（鬼怪 OST）—— 主旋律只在一楼放一小段，点到就停
const STAY = [
  [N.B4, 1], [N.Cs5, 1], [N.E5, 1.5], [N.Cs5, 0.5],
  [N.B4, 1], [N.A4, 2], [N.B4, 1],
  [N.Cs5, 1], [N.E5, 1], [N.Fs5, 1.5], [N.E5, 0.5],
  [N.Cs5, 1], [N.B4, 2], [N.A4, 1],
  [N.Fs4, 1], [N.A4, 1], [N.B4, 1.5], [N.A4, 0.5],
  [N.Fs4, 1], [N.E4, 2], [N.Fs4, 1],
  [N.A4, 1], [N.B4, 1], [N.Cs5, 1.5], [N.B4, 0.5],
  [N.A4, 1], [N.Fs4, 2], [0, 1],
];

// 2) 粉雾海（易烊千玺）
const PINK = [
  [N.E5, 1], [N.D5, 1], [N.Cs5, 2],
  [N.D5, 1], [N.E5, 1], [N.B4, 2],
  [N.A4, 1], [N.B4, 1], [N.Cs5, 1.5], [N.B4, 0.5],
  [N.A4, 2], [0, 1],
  [N.Cs5, 1], [N.E5, 1], [N.Fs5, 2],
  [N.E5, 1], [N.Cs5, 1], [N.B4, 2],
  [N.A4, 1], [N.Cs5, 1], [N.B4, 1.5], [N.A4, 0.5],
  [N.Fs4, 3], [0, 1],
];

// 3) Baby, Don't Cry（인어의 눈물）
const BABY = [
  [N.E5, 1.5], [N.E5, 0.5], [N.D5, 1], [N.Cs5, 1],
  [N.B4, 1.5], [N.Cs5, 0.5], [N.D5, 2],
  [N.Cs5, 1.5], [N.B4, 0.5], [N.A4, 1], [N.B4, 1],
  [N.A4, 3], [0, 1],
  [N.B4, 1], [N.Cs5, 1], [N.E5, 1.5], [N.D5, 0.5],
  [N.Cs5, 1], [N.B4, 1], [N.A4, 2],
  [N.B4, 1], [N.Cs5, 1], [N.D5, 1], [N.Cs5, 1],
  [N.B4, 2], [0, 2],
];

const CHORD_ROOTS = { stay: 54, pink: 57, baby: 52 };   // 低音铺底

const MELODY = { stay: STAY, pink: PINK, baby: BABY };

export class MuseumPlayer {
  constructor(songs, layout, opts = {}) {
    this.songs = songs;
    this.layout = layout;
    this.playing = false;
    this.current = songs[0].id;   // 默认选中 Stay With Me，但不会自动响
    this.ctx = null;
    this.analyser = null;
    this.els = null;
    this.resumeFrom = 0;
    this._schedTimer = null;
    this._raf = 0;
    this._onUpdate = opts.onUpdate || null;
  }

  // ---- 电视里的界面 ----
  bindUI({ listEl, screenEl, artCanvas, titleEl, subEl }) {
    this.els = { listEl, screenEl, artCanvas, titleEl, subEl };
    this.renderList();

    this.artCtx = artCanvas.getContext('2d');
    this.fitArt();
    window.addEventListener('resize', () => this.fitArt());
    this.drawIdle();
  }

  fitArt() {
    const c = this.els.artCanvas;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(160, Math.round(r.width * dpr));
    c.height = Math.max(100, Math.round(r.height * dpr));
    this._artReady = true;
  }

  renderList() {
    const { listEl } = this.els;
    if (!listEl) return;
    listEl.innerHTML = '';
    this.songs.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = `tv-row${s.id === this.current ? ' sel' : ''}`;
      b.dataset.id = s.id;
      b.innerHTML = `<span class="tv-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="tv-name"><b>${s.cn}</b><i>${s.en || ''}</i></span>
        <span class="tv-play">${s.id === this.current && this.playing ? '❚❚' : '▶'}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (s.id === this.current && this.playing) this.pause();
        else this.play(s.id);
      });
      listEl.appendChild(b);
    });
    const cur = this.songs.find((s) => s.id === this.current);
    if (cur && this.els.titleEl) {
      this.els.titleEl.textContent = cur.cn;
      this.els.subEl.textContent = this.playing ? '正在播放 · 点一下暂停' : '点一下，让这里开始有声音';
    }
  }

  // ---- 音频 ----
  ensureCtx() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    const master = this.ctx.createGain();
    master.gain.value = 0.5;
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;
    master.connect(analyser);
    analyser.connect(this.ctx.destination);
    this.master = master;
    this.analyser = analyser;
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    return this.ctx;
  }

  async play(id) {
    const song = this.songs.find((s) => s.id === id) || this.songs[0];
    this.current = song.id;

    // 音频上下文只用来做频谱，不拿它当播放前提（没声卡 / 被浏览器挂起也能放）
    const ctx = this.ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

    await this.stopSource();

    // 先试真歌；没有文件就走合成器
    let ok = false;
    try {
      const res = await fetch(song.file, { method: 'HEAD' });
      ok = res.ok;
    } catch { ok = false; }

    if (ok) {
      try {
        const el = new Audio(song.file);
        el.crossOrigin = 'anonymous';
        el.loop = true;
        el.volume = 0.6;
        el.preload = 'auto';
        if (ctx && this.master) {
          try {
            const src = ctx.createMediaElementSource(el);
            src.connect(this.master);
          } catch { /* 接不上频谱也不影响出声 */ }
        }
        await el.play();
        this.audioEl = el;
        this.mode = 'file';
      } catch { ok = false; }
    }

    if (!ok) {
      if (!ctx) return;         // 连 AudioContext 都没有，只能作罢
      this.mode = 'synth';
      this.startSynth(song.id);
    }

    this.playing = true;
    this.renderList();
    this._onUpdate && this._onUpdate(this.state());
  }

  pause() {
    this.playing = false;
    if (this.mode === 'file' && this.audioEl) {
      this.audioEl.pause();
    }
    this.stopSynth();
    this.renderList();
    this._onUpdate && this._onUpdate(this.state());
  }

  toggle() {
    this.playing ? this.pause() : this.play(this.current);
  }

  async stopSource() {
    if (this.audioEl) {
      try { this.audioEl.pause(); } catch {}
      try { this.audioEl.src = ''; } catch {}
      this.audioEl = null;
    }
    this.stopSynth();
  }

  state() {
    return { playing: this.playing, current: this.current, mode: this.mode || 'idle' };
  }

  // ---- 合成器：钢琴 + 八音盒 + 低音铺底，循环播放 ----
  startSynth(id) {
    const ctx = this.ctx;
    const beats = MELODY[id] || STAY;
    const spb = 60 / 82;                 // 每拍秒数
    this._i = 0;
    this._next = ctx.currentTime + 0.12;

    const schedule = () => {
      if (!this.playing) return;
      const horizon = ctx.currentTime + 0.8;
      let guard = 0;
      while (this._next < horizon && guard++ < 32) {
        const [midi, len] = beats[this._i % beats.length];
        const dur = len * spb;
        if (midi) this.voice(midi, this._next, dur, id);
        // 每四拍补一个低音
        if (this._i % 4 === 0) this.bass(CHORD_ROOTS[id] || 54, this._next, spb * 3.6);
        this._next += dur;
        this._i++;
      }
      this._schedTimer = setTimeout(schedule, 220);
    };
    this.melody = beats;
    this.spb = spb;
    this.t0 = ctx.currentTime;
    schedule();
  }

  stopSynth() {
    if (this._schedTimer) { clearTimeout(this._schedTimer); this._schedTimer = null; }
    if (this.voices) {
      this.voices.forEach((v) => { try { v.stop(); } catch {} });
      this.voices = [];
    }
  }

  // 一个「钢琴 + 八音盒」的音
  voice(midi, when, dur) {
    const ctx = this.ctx;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    const peak = 0.16;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.42, when + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 1.5);

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(5200, when);
    filt.frequency.exponentialRampToValueAtTime(1500, when + dur * 1.2);

    // 基音 + 两个泛音，像八音盒的齿片
    [[1, 1], [2, 0.28], [3.01, 0.1]].forEach(([mul, amp]) => {
      const o = ctx.createOscillator();
      o.type = mul === 1 ? 'triangle' : 'sine';
      o.frequency.value = f * mul;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og); og.connect(filt);
      o.start(when); o.stop(when + dur * 1.6 + 0.1);
    });

    filt.connect(g); g.connect(this.master);
    this.voices = this.voices || [];
    this.voices.push({ stop: () => { try { g.disconnect(); } catch {} } });
    if (this.voices.length > 60) this.voices.splice(0, 20);
  }

  bass(midi, when, dur) {
    const ctx = this.ctx;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.13, when + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + dur + 0.1);
  }

  // ---- 电视画面：频谱像粉色的浪 ----
  drawIdle() {
    const c = this.els && this.els.artCanvas;
    if (!c || !this.artCtx) return;
    const { width: w, height: h } = c;
    const g = this.artCtx;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#fbe6ee');
    bg.addColorStop(0.55, '#f7d3e2');
    bg.addColorStop(1, '#eab3cd');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // 几团雾
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + 18;
      const y = h * 0.55 + Math.sin(i * 1.7) * h * 0.16;
      const r = h * (0.28 + (i % 3) * 0.1);
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.62)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(74,49,57,0.42)';
    g.font = `${Math.round(h * 0.12)}px Georgia, serif`;
    g.textAlign = 'center';
    g.fillText('▶', w / 2, h * 0.56);
    g.font = `${Math.round(h * 0.075)}px "Songti SC", serif`;
    g.fillStyle = 'rgba(74,49,57,0.5)';
    g.fillText('点一下就好', w / 2, h * 0.74);
  }

  startRaf() {
    if (this._raf) return;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this.drawArt();
      // 音乐的旋转方块特效已按要求取消（不再生成声光彩带）
    };
    loop();
  }

  drawArt() {
    const c = this.els && this.els.artCanvas;
    if (!c || !this.artCtx) return;
    if (!this._artReady) this.fitArt();
    const g = this.artCtx;
    const w = c.width, h = c.height;

    if (!this.playing || !this.analyser) { this.drawIdle(); return; }
    this.analyser.getByteFrequencyData(this.freq);

    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f7dceb');
    bg.addColorStop(0.5, '#eec0d8');
    bg.addColorStop(1, '#d795b6');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // 频谱：一排粉色浪柱
    const n = 42;
    for (let i = 0; i < n; i++) {
      const v = this.freq[Math.floor((i / n) * (this.freq.length * 0.62))] / 255;
      const bh = Math.max(4, v * h * 0.72);
      const x = (i / n) * w;
      const bw = w / n - Math.max(1, w / n * 0.28);
      const lg = g.createLinearGradient(0, h, 0, h - bh);
      lg.addColorStop(0, 'rgba(255,255,255,0.9)');
      lg.addColorStop(0.5, 'rgba(255,214,232,0.85)');
      lg.addColorStop(1, 'rgba(196,110,150,0.75)');
      g.fillStyle = lg;
      const r = Math.min(bw / 2, 6);
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x, h - bh + r);
      g.quadraticCurveTo(x, h - bh, x + r, h - bh);
      g.lineTo(x + bw - r, h - bh);
      g.quadraticCurveTo(x + bw, h - bh, x + bw, h - bh + r);
      g.lineTo(x + bw, h);
      g.closePath();
      g.fill();
    }
    // 水面倒影
    g.save();
    g.globalAlpha = 0.18;
    g.scale(1, -0.35);
    g.translate(0, -h / 0.35 * 1.15);
    g.drawImage(c, 0, 0, w, h * 0.34);
    g.restore();
  }

  // ---- 声音的光带：从电视一路飘到中庭 ----
  setScene(scene) { this.scene = scene; }

  ensureRibbons() {
    if (this.ribbons) return;
    const scene = this.scene;
    if (!scene) return;
    const geo = new THREE.BufferGeometry();
    const n = 46;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffd6e6, size: 0.34, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    scene.add(pts);
    this.ribbons = { pts, geo, mat, n, t: 0 };
  }

  updateRibbons() {
    const rb = this.ribbons;
    if (!rb) return;
    const target = this.playing ? 0.85 : 0;
    rb.mat.opacity += (target - rb.mat.opacity) * 0.06;
    if (rb.mat.opacity < 0.02) { rb.pts.visible = false; return; }
    rb.pts.visible = true;

    const tv = this.layout.tv;
    if (!tv) return;
    const p = rb.geo.attributes.position;
    const t = performance.now() / 1000;
    for (let i = 0; i < rb.n; i++) {
      const u = ((i / rb.n) + t * 0.14) % 1;
      const sway = Math.sin(t * 1.3 + i * 0.8) * (1.4 + u * 3.4);
      const y = tv.y + 1.1 + u * 4.6 + Math.sin(t * 0.9 + i) * 0.5;
      const r = tv.r * (1 - u * 0.35);
      p.setXYZ(
        i,
        tv.x + (0 - tv.x) * u * 0.5 + sway,
        y,
        tv.z + (0 - tv.z) * u * 0.5 + sway * 0.5
      );
    }
    p.needsUpdate = true;
    rb.mat.size = 0.3 + (Math.sin(t * 2) * 0.5 + 0.5) * 0.16;
  }
}
