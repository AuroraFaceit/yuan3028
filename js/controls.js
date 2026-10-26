import * as THREE from '../vendor/three.module.js';
import { DIM } from './museum.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * 第一人称漫游镜头：
 *  ↑ ↓ 前进 / 后退    ← → 左右平移    Q E 升降    拖拽鼠标左键看四周    滚轮推近拉远
 */
export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.pos = new THREE.Vector3(0, 3.15, -13.0);
    this.yaw = 0;
    this.pitch = -0.3;
    this.vel = new THREE.Vector3();
    this.keys = new Set();
    this.enabled = true;
    this.tween = null;
    this.onTap = null;
    this.onInteract = null;
    this.onHover = null;

    this._down = null;
    this._moved = 0;
    this._lastHover = 0;

    this._onKeyDown = (e) => {
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
      if (this.keys.has(code)) return;
      this.keys.add(code);
      if (this.onInteract) this.onInteract('key');
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.keys.clear();

    this._onDown = (e) => {
      if (e.button !== 0) return;
      this._down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this._moved = 0;
      dom.setPointerCapture?.(e.pointerId);
      dom.classList.add('grabbing');
    };
    this._onMove = (e) => {
      if (this._down) {
        const dx = e.clientX - this._down.x;
        const dy = e.clientY - this._down.y;
        this._moved += Math.abs(dx) + Math.abs(dy);
        this.yaw -= dx * 0.0026;
        this.pitch = clamp(this.pitch - dy * 0.0024, -1.15, 1.15);
        this._down.x = e.clientX;
        this._down.y = e.clientY;
        this.tween = null;
        if (this.onInteract) this.onInteract('drag');
      } else if (this.onHover) {
        const now = performance.now();
        if (now - this._lastHover > 60) {
          this._lastHover = now;
          const r = dom.getBoundingClientRect();
          this.onHover(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        }
      }
    };
    this._onUp = (e) => {
      if (!this._down) return;
      const dur = performance.now() - this._down.t;
      const wasClick = this._moved < 8 && dur < 420;
      this._down = null;
      dom.classList.remove('grabbing');
      if (wasClick && this.onTap) {
        const r = dom.getBoundingClientRect();
        this.onTap(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      }
    };
    this._onWheel = (e) => {
      e.preventDefault();
      const f = this.forward();
      const step = clamp(-e.deltaY, -140, 140) * 0.011;
      this.pos.addScaledVector(f, step);
      this.clampPos();
      this.tween = null;
      if (this.onInteract) this.onInteract('wheel');
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    dom.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
  }

  forward() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
  }

  horizontalForward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  clampPos() {
    const r = Math.hypot(this.pos.x, this.pos.z);
    const minR = this.pos.y < 5.2 ? 4.6 : 4.2;
    if (r > 27.4) this.pos.multiplyScalar(27.4 / r);
    if (r < minR) {
      const s = minR / (r || 0.001);
      this.pos.x *= s;
      this.pos.z *= s;
    }
    this.pos.y = clamp(this.pos.y, 1.35, DIM.CEIL - 2.1);
  }

  setView(pos, look) {
    this.pos.copy(pos);
    const d = new THREE.Vector3().subVectors(look, pos).normalize();
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.asin(clamp(d.y, -1, 1));
    if (this.locked) {
      this.lockedPos = pos.clone();
      this.lockedLook = look.clone();
    }
  }

  // 自检用：把机位钉住，主循环不再改它
  lockView(pos, look) {
    this.tween = null;
    this.locked = true;
    this.setView(pos.clone(), look.clone());
  }
  unlockView() { this.locked = false; }

  flyTo(pos, look, dur = 1.5) {
    const endYaw = Math.atan2(-(look.x - pos.x), -(look.z - pos.z));
    const endPitch = Math.asin(clamp((look.y - pos.y) / (pos.distanceTo(look) || 1), -1, 1));
    let dy = endYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.tween = {
      t: 0, dur,
      p0: this.pos.clone(), p1: pos.clone(),
      y0: this.yaw, y1: this.yaw + dy,
      a0: this.pitch, a1: endPitch,
    };
    this.vel.set(0, 0, 0);
  }

  update(dt) {
    if (this.locked) {
      // 自检锁定的机位：一动都不动
      this.camera.position.copy(this.pos);
      this.camera.lookAt(this.lockedLook);
      return;
    }
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = easeInOut(tw.t);
      this.pos.lerpVectors(tw.p0, tw.p1, k);
      this.yaw = tw.y0 + (tw.y1 - tw.y0) * k;
      this.pitch = tw.a0 + (tw.a1 - tw.a0) * k;
      if (tw.t >= 1) this.tween = null;
    } else {
      let fwd = 0, side = 0, up = 0;
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) fwd += 1;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) fwd -= 1;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) side -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) side += 1;
      if (this.keys.has('KeyE') || this.keys.has('PageUp') || this.keys.has('Space')) up += 1;
      if (this.keys.has('KeyQ') || this.keys.has('PageDown')) up -= 1;

      const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 9.5 : 4.6;
      const target = new THREE.Vector3()
        .addScaledVector(this.horizontalForward(), fwd)
        .addScaledVector(this.right(), side);
      if (target.lengthSq() > 0) target.normalize().multiplyScalar(speed);
      target.y = up * speed * 0.65;

      this.vel.lerp(target, 1 - Math.exp(-dt * 9));
      this.pos.addScaledVector(this.vel, dt);
      if (this.vel.lengthSq() > 0.0001) this.clampPos();
    }

    this.camera.position.copy(this.pos);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
}

/**
 * 自动导览：在机位之间平滑巡游
 */
export class Tour {
  constructor(rig, stops, opts = {}) {
    this.rig = rig;
    this.stops = stops;
    this.active = false;
    this.i = 0;
    this.t = 0;
    this.leg = opts.leg ?? 8.5;
    this.hold = opts.hold ?? 2.2;
    this.onChange = null;
  }

  start(from = 0) {
    this.active = true;
    this.i = from;
    this.t = 0;
    this._apply(0);
    this.onChange && this.onChange(true);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.onChange && this.onChange(false);
  }

  toggle() {
    this.active ? this.stop() : this.start();
  }

  _apply(alpha) {
    const a = this.stops[this.i];
    const b = this.stops[(this.i + 1) % this.stops.length];
    const pos = new THREE.Vector3().lerpVectors(a.pos, b.pos, alpha);
    const look = new THREE.Vector3().lerpVectors(a.look, b.look, alpha);
    this.rig.setView(pos, look);
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.t <= this.leg) {
      const k = easeInOut(this.t / this.leg);
      this._apply(k);
    } else if (this.t <= this.leg + this.hold) {
      this._apply(1);
    } else {
      this.i = (this.i + 1) % this.stops.length;
      this.t = 0;
      this._apply(0);
    }
  }
}
