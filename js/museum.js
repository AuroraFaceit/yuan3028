import * as THREE from '../vendor/three.module.js';

// ---------------------------------------------------------------------------
// 尺寸常量：一座四层的圆形展塔，一层一个主题，层与层之间有旋梯
// ---------------------------------------------------------------------------
export const DIM = {
  R: 30,          // 外弧墙半径
  LH: 4.9,        // 层高
  N: 4,           // 层数（一层地面 + 三层环廊）
  MEZZ_IN: 21,    // 环廊内圈半径
  OCULUS: 6.4,    // 天窗半径
};
DIM.CEIL = +(DIM.LH * DIM.N).toFixed(2);            // 19.6 天花高度
DIM.levelY = (i) => +(i * DIM.LH).toFixed(2);       // 第 i 层楼板高度（一层为 0）
DIM.MEZZ = DIM.LH;      // 兼容旧引用：第一个上层楼板
DIM.WALL_H = DIM.CEIL;  // 兼容旧引用：整面通高外墙

const MAT = {
  wall: new THREE.MeshStandardMaterial({ color: 0xfcf2f1, roughness: 0.97, metalness: 0 }),
  floor: new THREE.MeshStandardMaterial({ color: 0xf0dfde, roughness: 0.88, metalness: 0 }),
  slab: new THREE.MeshStandardMaterial({ color: 0xf7eae8, roughness: 0.9, metalness: 0 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xfefafa, roughness: 0.8, metalness: 0 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xd0bfc2, roughness: 0.3, metalness: 0.8 }),
  frame: new THREE.MeshStandardMaterial({ color: 0xf7ebea, roughness: 0.5, metalness: 0 }),
  mat: new THREE.MeshStandardMaterial({ color: 0xfdf5f5, roughness: 0.9, metalness: 0 }),
  frameDark: new THREE.MeshStandardMaterial({ color: 0x8f7a7c, roughness: 0.5, metalness: 0.2 }),
  blossom: new THREE.MeshStandardMaterial({ color: 0xfbe0e2, roughness: 0.95, metalness: 0, flatShading: true }),
  blossom2: new THREE.MeshStandardMaterial({ color: 0xf7cdd2, roughness: 0.95, metalness: 0, flatShading: true }),
  bark: new THREE.MeshStandardMaterial({ color: 0xc3a9a7, roughness: 0.9, metalness: 0 }),
  bench: new THREE.MeshStandardMaterial({ color: 0xf9efee, roughness: 0.7, metalness: 0 }),
  stair: new THREE.MeshStandardMaterial({ color: 0xecd8d8, roughness: 0.85, metalness: 0 }),
};

const tmpObj = new THREE.Object3D();

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------------------
// 建筑：地面 / 弧墙 / 二层环廊 / 楼梯 / 天窗 / 桥
// ---------------------------------------------------------------------------
function ringMesh(inner, outer, y, mat, seg = 128) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, seg, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

function railRing(radius, y, mat = MAT.metal) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.032, 8, 128), mat);
  t.rotation.x = Math.PI / 2;
  t.position.y = y;
  t.castShadow = true;
  return t;
}

function railing(radius, yBase, height, count = 96, opts = {}) {
  const g = new THREE.Group();

  // 玫瑰金主扶手（比原来粗一点，像打磨过的铜管）
  const handMat = new THREE.MeshStandardMaterial({ color: 0xc98f9c, roughness: 0.28, metalness: 0.72 });
  const hand = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.058, 12, 168), handMat);
  hand.rotation.x = Math.PI / 2;
  hand.position.y = yBase + height;
  hand.castShadow = true;
  g.add(hand);
  // 扶手内侧一道细金线，近看有层次
  const trim = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.06, 0.014, 8, 168), handMat);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = yBase + height - 0.075;
  g.add(trim);
  // 中段细横杆
  g.add(railRing(radius, yBase + height * 0.5));

  // 磨砂玻璃挡板：上半段通透，下半段更实，像展馆常见的夹胶玻璃
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfff2f6, roughness: 0.08, metalness: 0.02,
    transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false,
  });
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(radius - 0.03, radius - 0.03, height * 0.8, 128, 1, true),
    glassMat
  );
  glass.position.y = yBase + height * 0.44;
  g.add(glass);

  // 立柱：细杆 + 顶端小金球
  const post = new THREE.CylinderGeometry(0.017, 0.017, height, 8);
  const inst = new THREE.InstancedMesh(post, MAT.metal, count);
  inst.frustumCulled = false;
  inst.castShadow = true;
  const ballGeo = new THREE.SphereGeometry(0.032, 10, 8);
  const ballInst = new THREE.InstancedMesh(ballGeo, handMat, count);
  ballInst.frustumCulled = false;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    tmpObj.position.set(x, yBase + height / 2, z);
    tmpObj.rotation.set(0, 0, 0);
    tmpObj.scale.set(1, 1, 1);
    tmpObj.updateMatrix();
    inst.setMatrixAt(i, tmpObj.matrix);
    tmpObj.position.set(x, yBase + height * 0.5 + 0.05, z);
    tmpObj.updateMatrix();
    ballInst.setMatrixAt(i, tmpObj.matrix);
  }
  g.add(inst, ballInst);

  // 每 6 根立柱亮一颗小灯，夜里像一圈星子
  const beadMat = new THREE.MeshBasicMaterial({ color: 0xffe1ec, toneMapped: false, transparent: true, opacity: 0.9, fog: false });
  const beadGeo = new THREE.SphereGeometry(0.045, 10, 8);
  const beads = new THREE.InstancedMesh(beadGeo, beadMat, Math.floor(count / 6));
  beads.frustumCulled = false;
  let bi = 0;
  for (let i = 0; i < count; i += 6) {
    const a = (i / count) * Math.PI * 2;
    tmpObj.position.set(Math.sin(a) * radius, yBase + 0.18, Math.cos(a) * radius);
    tmpObj.rotation.set(0, 0, 0);
    tmpObj.scale.set(1, 1, 1);
    tmpObj.updateMatrix();
    beads.setMatrixAt(bi++, tmpObj.matrix);
  }
  g.add(beads);

  if (opts.kick) {
    const kick = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.1, 128, 1, true), MAT.trim);
    kick.position.y = yBase + 0.05;
    kick.material.side = THREE.DoubleSide;
    g.add(kick);
  }
  return g;
}

function buildArchitecture(scene) {
  const arch = new THREE.Group();

  // 地面（带中心到边缘的柔光渐变）
  const floorTex = canvasTexture(1024, 1024, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#faf1f0');
    g.addColorStop(1, '#e8cdd0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#a08085';
    for (let r = 60; r < 520; r += 46) {
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
    }
  });
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(DIM.R + 0.6, 128),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.04, color: 0xffffff })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  arch.add(floor);

  // 天窗落在地上的光斑
  const patchTex = canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,251,240,0.95)');
    g.addColorStop(0.55, 'rgba(255,249,236,0.45)');
    g.addColorStop(1, 'rgba(255,248,235,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ map: patchTex, transparent: true, depthWrite: false, opacity: 0.75, fog: false })
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(1.5, 0.03, 1.5);
  patch.renderOrder = 1;
  arch.add(patch);

  // 外弧墙
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(DIM.R, DIM.R, DIM.WALL_H, 128, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xfaf0ef, roughness: 0.96, metalness: 0, side: THREE.BackSide })
  );
  wall.position.y = DIM.WALL_H / 2;
  wall.receiveShadow = true;
  arch.add(wall);

  // 墙面竖向壁柱（浅浅地贴在墙上，不遮挡展品）
  const pilCount = 48;
  const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, DIM.WALL_H, 0.16), MAT.trim, pilCount);
  pil.frustumCulled = false;
  for (let i = 0; i < pilCount; i++) {
    const a = (i / pilCount) * Math.PI * 2;
    tmpObj.position.set(Math.sin(a) * (DIM.R - 0.02), DIM.WALL_H / 2, Math.cos(a) * (DIM.R - 0.02));
    tmpObj.rotation.set(0, a, 0);
    tmpObj.scale.set(1, 1, 1);
    tmpObj.updateMatrix();
    pil.setMatrixAt(i, tmpObj.matrix);
  }
  pil.receiveShadow = true;
  arch.add(pil);

  // 各层楼板 + 内圈栏杆（一层是地面，上面每层一圈环廊）
  const unders = [];   // 楼板底面
  const mezzMat = new THREE.MeshStandardMaterial({
    color: 0xfbf0ef, roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
    emissive: 0xfceff0, emissiveIntensity: 0.14,
  });
  for (let lv = 1; lv < DIM.N; lv++) {
    const y = DIM.levelY(lv);
    arch.add(ringMesh(DIM.MEZZ_IN, DIM.R, y, mezzMat));

    // 楼板底面（从下面一层抬头看到的那一面）
    const under = new THREE.Mesh(
      new THREE.RingGeometry(DIM.MEZZ_IN, DIM.R, 128, 1),
      new THREE.MeshBasicMaterial({ color: 0xf6e9e9, toneMapped: false })
    );
    under.rotation.x = Math.PI / 2;
    under.position.y = y - 0.44;
    arch.add(under);
    unders.push(under);

    const mezzEdge = new THREE.Mesh(new THREE.CylinderGeometry(DIM.MEZZ_IN, DIM.MEZZ_IN, 0.42, 128, 1, true), MAT.slab);
    mezzEdge.position.y = y - 0.21;
    mezzEdge.castShadow = true; mezzEdge.receiveShadow = true;
    arch.add(mezzEdge);
    arch.add(railing(DIM.MEZZ_IN + 0.12, y, 1.05, 72, { kick: true }));
  }

  // 天花 = 一片粉雾海：粉调的天空 + 一层层翻涌的雾浪，抬头像站在云海底下
  const ceilTex = canvasTexture(1024, 1024, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.48, h * 0.5, 40, w / 2, h / 2, w * 0.66);
    g.addColorStop(0, '#fdf1f4');
    g.addColorStop(0.34, '#fadfe8');
    g.addColorStop(0.68, '#f3c9da');
    g.addColorStop(0.9, '#e8b3cd');
    g.addColorStop(1, '#dda6c3');     // 最外圈深一点，和墙脚接得柔和
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // 雾团：一堆叠加的柔和粉色光斑，大小不一，像海面上浮着的一层雾
    const blobs = [
      [0.5, 0.5, 0.46, 'rgba(255,255,255,0.92)'],
      [0.26, 0.34, 0.26, 'rgba(255,250,252,0.72)'],
      [0.74, 0.62, 0.3, 'rgba(255,243,249,0.62)'],
      [0.62, 0.24, 0.22, 'rgba(255,255,255,0.6)'],
      [0.34, 0.76, 0.24, 'rgba(252,226,238,0.66)'],
      [0.86, 0.3, 0.2, 'rgba(250,214,231,0.6)'],
      [0.14, 0.6, 0.2, 'rgba(250,216,232,0.55)'],
    ];
    blobs.forEach(([cx, cy, rr, col]) => {
      const rg = ctx.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, rr * w);
      rg.addColorStop(0, col);
      rg.addColorStop(0.5, col.replace(/[\d.]+\)$/, '0.24)'));
      rg.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(cx * w, cy * h, rr * w, 0, Math.PI * 2); ctx.fill();
    });

    // 雾的纹路：几条同心的大圆弧，像海的涟漪，很淡
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#ffffff';
    for (let r = 90; r < 620; r += 66) {
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    // 外圈一点点更深的粉，让天花的边界柔和地沉下去
    const edge = ctx.createRadialGradient(w / 2, h / 2, w * 0.42, w / 2, h / 2, w * 0.72);
    edge.addColorStop(0, 'rgba(214,150,182,0)');
    edge.addColorStop(1, 'rgba(214,150,182,0.3)');
    ctx.fillStyle = edge; ctx.fillRect(0, 0, w, h);
  });
  const ceilRing = new THREE.Mesh(
    new THREE.RingGeometry(DIM.OCULUS, DIM.R + 0.4, 128, 1),
    new THREE.MeshBasicMaterial({ map: ceilTex, side: THREE.FrontSide, fog: false })
  );
  ceilRing.rotation.x = Math.PI / 2;
  ceilRing.position.y = DIM.CEIL;
  arch.add(ceilRing);

  // 每一层抬头看到的楼板底面，也是这片粉雾（淡一些）
  const underTex = canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, '#fffafb');
    g.addColorStop(0.5, '#fce9f0');
    g.addColorStop(1, '#f4d2e2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const cx = Math.random() * w, cy = Math.random() * h;
      const rr = 40 + Math.random() * 120;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, 'rgba(255,255,255,0.5)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }
  });
  unders.forEach((u) => {
    u.material = new THREE.MeshBasicMaterial({ map: underTex, toneMapped: false });
  });

  // 粉雾海上的星星：一层细细的亮点，压在雾下面的天花上
  const ceilStars = (() => {
    const canvas = canvasTexture(1024, 1024, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 220; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = Math.random() * 1.6 + 0.4;
        const a = 0.25 + Math.random() * 0.65;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // 十几颗带十字光芒的亮星
      for (let i = 0; i < 14; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, 12);
        rg.addColorStop(0, 'rgba(255,255,255,0.95)');
        rg.addColorStop(0.3, 'rgba(255,240,248,0.45)');
        rg.addColorStop(1, 'rgba(255,240,248,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y);
        ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke();
      }
    });
    const starRing = new THREE.Mesh(
      new THREE.RingGeometry(DIM.OCULUS + 0.2, DIM.R + 0.3, 128, 1),
      new THREE.MeshBasicMaterial({
        map: canvas, transparent: true, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending, opacity: 0.85,
      })
    );
    starRing.rotation.x = Math.PI / 2;
    starRing.position.y = DIM.CEIL - 0.06;
    arch.add(starRing);
    return starRing;
  })();
  arch.userData.ceilStars = ceilStars;

  // 天窗里也能看见几颗会闪的星（从下往上看，像一扇开向夜空的窗）
  const oculusRim = new THREE.Mesh(new THREE.TorusGeometry(DIM.OCULUS, 0.16, 10, 96), MAT.trim);
  oculusRim.rotation.x = Math.PI / 2;
  oculusRim.position.y = DIM.CEIL - 0.05;
  arch.add(oculusRim);

  // 天窗：从下往上看，和拱窗里面一样——粉雾海的天色 + 一层层柔雾
  const glowTex = canvasTexture(512, 512, (ctx, w, h) => {
    const r = w / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2); ctx.clip();
    // 天色：从浅粉到暖玫瑰，和拱窗里一模一样
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fff5f8');
    g.addColorStop(0.3, '#fde0ea');
    g.addColorStop(0.66, '#f6c3d7');
    g.addColorStop(1, '#e8a8c6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 窗外的雾层：柔和的白粉光斑
    for (let i = 0; i < 24; i++) {
      const cx = Math.random() * w;
      const cy = h * 0.18 + Math.random() * h * 0.8;
      const rr = 30 + Math.random() * 90;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, `rgba(255, 252, 254, ${0.3 + Math.random() * 0.28})`);
      rg.addColorStop(1, 'rgba(255, 246, 250, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }
    // 细微的粉调颗粒
    for (let i = 0; i < 36; i++) {
      const sx = Math.random() * w, sy = Math.random() * h;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.3})`;
      ctx.beginPath(); ctx.arc(sx, sy, Math.random() * 2 + 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
  const oculusGlow = new THREE.Mesh(
    new THREE.CircleGeometry(DIM.OCULUS + 0.06, 64),
    new THREE.MeshBasicMaterial({ map: glowTex, fog: false })
  );
  oculusGlow.rotation.x = Math.PI / 2;
  oculusGlow.position.y = DIM.CEIL + 1.35;
  arch.add(oculusGlow);

  // 天窗井筒
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(DIM.OCULUS, DIM.OCULUS, 2.4, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xfefafa, roughness: 0.9, side: THREE.BackSide })
  );
  shaft.position.y = DIM.CEIL + 1.2;
  arch.add(shaft);

  // 天花环形灯带（粉雾里的一圈柔光）
  const lightRing = new THREE.Mesh(
    new THREE.TorusGeometry(9.4, 0.045, 8, 128),
    new THREE.MeshBasicMaterial({ color: 0xffe6ef, transparent: true, opacity: 0.8, fog: false })
  );
  lightRing.rotation.x = Math.PI / 2;
  lightRing.position.y = DIM.CEIL - 0.3;
  arch.add(lightRing);

  // 旋转楼梯：每层一段旋梯，沿外墙错开角度盘旋而上（1F→2F→…→顶层）
  const steps = 22;
  const stepH = DIM.LH / steps;
  // 三段楼梯错开在「画列」之外（画列在 π 附近），免得挡住作品
  const stairBase = [1.45, 3.1, 4.62];
  for (let s = 0; s < DIM.N - 1; s++) {
    if (s === 2) continue;   // 第三层的梯子按需求撤掉
    const y0 = DIM.levelY(s);
    const a0 = stairBase[s], a1 = a0 + 0.44;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const a = a0 + (a1 - a0) * t;
      const rr = DIM.R - 1.9;
      const hgt = y0 + stepH * (i + 1);
      const st = new THREE.Mesh(new THREE.BoxGeometry(3.2, stepH * (i + 1), (DIM.R * Math.abs(a1 - a0)) / steps * 1.12), MAT.stair);
      st.position.set(Math.sin(a) * rr, y0 + (stepH * (i + 1)) / 2, Math.cos(a) * rr);
      st.rotation.y = a;
      st.castShadow = true; st.receiveShadow = true;
      arch.add(st);
    }
    // 楼梯扶手：立柱 + 顺着坡度上去的连续扶手管
    const railR = DIM.R - 3.45;
    const railPts = [];
    for (let i = 0; i < steps; i += 2) {
      const t = i / (steps - 1);
      const a = a0 + (a1 - a0) * t;
      const hgt = y0 + stepH * (i + 1) + 0.95;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 6), MAT.metal);
      p.position.set(Math.sin(a) * railR, hgt - 0.47, Math.cos(a) * railR);
      arch.add(p);
    }
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const a = a0 + (a1 - a0) * t;
      railPts.push(new THREE.Vector3(Math.sin(a) * railR, y0 + stepH * (i + 1) + 0.98, Math.cos(a) * railR));
    }
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), steps * 2, 0.026, 6, false),
      MAT.metal
    );
    arch.add(rail);
  }

  // 空中曲桥已按需求取消（原先在二层高度横跨中庭，像一截伸出来的阳台）

  // 地面环形拼缝
  for (const r of [12.4, 21.2]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 6, 160), new THREE.MeshStandardMaterial({ color: 0xdcd5c7, roughness: 0.8 }));
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.012;
    arch.add(t);
  }

  // 长凳：一层沿墙几条，上面每层环廊也放两条
  const benchAngles = [0.15, 1.62, 3.05, 4.5, 5.6];
  benchAngles.forEach((a, i) => {
    const r = i % 2 === 0 ? 24.5 : 18.6;
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.34, 1.15), MAT.bench);
    seat.position.y = 0.46; seat.castShadow = true; seat.receiveShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 0.8), MAT.slab);
    base.position.y = 0.15;
    b.add(seat, base);
    b.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    b.rotation.y = a;
    arch.add(b);
  });
  for (let lv = 1; lv < DIM.N; lv++) {
    for (const a of [0.9, 4.05]) {
      const b = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.34, 1.1), MAT.bench);
      seat.position.y = 0.46; seat.castShadow = true; seat.receiveShadow = true;
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.28, 0.75), MAT.slab);
      base.position.y = 0.15;
      b.add(seat, base);
      const rr = 25.2;
      b.position.set(Math.sin(a) * rr, DIM.levelY(lv), Math.cos(a) * rr);
      b.rotation.y = a;
      arch.add(b);
    }
  }

  // 光柱（从天窗一路落到底的柔光）
  for (let i = 0; i < 3; i++) {
    const a = 0.6 + i * 2.1;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.6 + i * 0.35, DIM.CEIL - 6, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2f0, transparent: true, opacity: 0.02,
        side: THREE.DoubleSide, depthWrite: false, fog: false,
      })
    );
    cone.position.set(Math.sin(a) * 6.2, DIM.CEIL - (DIM.CEIL - 6) / 2, Math.cos(a) * 6.2);
    cone.rotation.z = 0.1 * (i % 2 ? 1 : -1);
    cone.renderOrder = 2;
    arch.add(cone);
  }

  // 空气里的浮尘已按需求取消（中庭上空只留气球和千纸鹤）

  scene.add(arch);
  return arch;
}

// ---------------------------------------------------------------------------
// 一层中庭的装饰（原来那棵樱花树删掉了）：一圈小物 + 中央的地灯
//   · 圆形矮台（原树池的位置留着，正好放电视）
//   · 三个粉雾球（会轻轻上下浮）
//   · 两只小兔子灯
//   · 一圈落地纸灯
//   · 几片飘在半空的花瓣
// ---------------------------------------------------------------------------
function buildDecor(scene) {
  const g = new THREE.Group();
  const rnd = mulberry32(41);

  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff3f7, roughness: 0.6, metalness: 0,
    emissive: new THREE.Color(0xffd9e6), emissiveIntensity: 0.85,
  });
  const roseMat = new THREE.MeshStandardMaterial({ color: 0xd98aa2, roughness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xf9d3e2, roughness: 0.2, metalness: 0.1,
    transparent: true, opacity: 0.72,
  });

  // 原树池：改成一圈矮台（电视落在这上面）
  // 台沿那道粉色圆环已去掉：它正好从电视柜前面切过，看着像笑脸下面多了一条线
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.75, 0.16, 64), MAT.bench);
  basin.position.y = 0.08; basin.receiveShadow = true;
  g.add(basin);

  // 三个会浮起来的粉雾球（大中小）
  [[7.6, -3.2, 0.62, 2.5], [9.4, 5.4, 0.44, 3.4], [-8.2, 7.4, 0.5, 1.9]].forEach(([x, z, r, y]) => {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), glassMat);
    ball.position.set(x, y, z);
    ball.castShadow = true;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.42, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe4ee, transparent: true, opacity: 0.85, fog: false })
    );
    ball.add(glow);
    g.add(ball);
    // 里面的一朵小花
    const bud = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.2, 0), MAT.blossom2);
    bud.position.set(r * 0.18, -r * 0.1, r * 0.1);
    ball.add(bud);
    ball.userData.float = { baseY: y, phase: x + z, speed: 0.7 };
  });

  // 两只小兔子灯（站在中庭空地上）
  const bunny = (x, z, ry) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), lampMat);
    body.scale.set(1, 0.92, 1.1); body.position.y = 0.36; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), lampMat);
    head.position.set(0, 0.78, 0.1); head.castShadow = true;
    b.add(body, head);
    [-1, 1].forEach((sx) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 6, 12), lampMat);
      ear.position.set(sx * 0.11, 1.06, 0.06);
      ear.rotation.z = sx * 0.18;
      b.add(ear);
    });
    [-1, 1].forEach((sx) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4a3139, roughness: 0.4 }));
      eye.position.set(sx * 0.1, 0.82, 0.32);
      b.add(eye);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), roseMat);
    nose.position.set(0, 0.74, 0.34);
    b.add(nose);
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    g.add(b);
    return b;
  };
  const b1 = bunny(-6.6, -6.2, 0.5);
  bunny(8.6, 8.2, -2.2);

  // 一圈落地纸灯（围着中庭）
  const lampGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.72, 18);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = 15.6;
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(Math.sin(a) * r, 0.36, Math.cos(a) * r);
    lamp.castShadow = true;
    g.add(lamp);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.05, 18), roseMat);
    cap.position.set(lamp.position.x, 0.75, lamp.position.z);
    g.add(cap);
  }

  // 飘在半空的花瓣已按需求取消（中庭上空只留气球和千纸鹤）

  scene.add(g);
  g.userData.bunny = b1;
  return g;
}

// ---------------------------------------------------------------------------
// 电视旁边的一小群动物：音乐一响就一起蹦，停了就乖乖站着
// （小白单独在左边陪着，这几只排在电视右边）
// ---------------------------------------------------------------------------
function buildPartyAnimals(scene) {
  const g = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff7f9, roughness: 0.72 });
  const pinky = new THREE.MeshStandardMaterial({ color: 0xf8c8d9, roughness: 0.68 });
  const sunny = new THREE.MeshStandardMaterial({ color: 0xffe0a6, roughness: 0.7 });
  const mint = new THREE.MeshStandardMaterial({ color: 0xd6efe3, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a3139, roughness: 0.45 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xd9869f, roughness: 0.55 });

  // 通用小身体：球身 + 头 + 两只眼睛 + 粉腮，脸朝 +Z
  const critter = (bodyMat, opts = {}) => {
    const a = new THREE.Group();
    const r = opts.r || 0.30;
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), bodyMat);
    body.scale.set(1, opts.squash || 0.95, 1);
    body.position.y = r * 0.98;
    body.castShadow = true;
    a.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.74, 20, 16), bodyMat);
    head.position.set(0, r * 1.92, r * 0.06);
    head.castShadow = true;
    a.add(head);

    [-1, 1].forEach((s) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 10, 8), dark);
      eye.position.set(s * r * 0.27, r * 1.98, r * 0.64);
      a.add(eye);
      const cheek = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.17, 12),
        new THREE.MeshBasicMaterial({ color: 0xf7a8be, transparent: true, opacity: 0.55, toneMapped: false })
      );
      cheek.position.set(s * r * 0.46, r * 1.78, r * 0.6);
      cheek.rotation.y = s * 0.35;
      a.add(cheek);
    });

    if (opts.ears === 'bunny') {
      [-1, 1].forEach((s) => {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.13, r * 0.62, 6, 12), bodyMat);
        ear.position.set(s * r * 0.28, r * 2.72, 0);
        ear.rotation.z = s * 0.16;
        a.add(ear);
      });
    } else if (opts.ears === 'round') {
      [-1, 1].forEach((s) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24, 14, 12), bodyMat);
        ear.position.set(s * r * 0.5, r * 2.42, 0);
        a.add(ear);
      });
    } else if (opts.ears === 'chick') {
      const beak = new THREE.Mesh(new THREE.ConeGeometry(r * 0.13, r * 0.3, 10), rose);
      beak.position.set(0, r * 1.84, r * 0.66);
      beak.rotation.x = Math.PI / 2;
      a.add(beak);
      // 头顶一撮毛
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(r * 0.1, r * 0.34, 8), bodyMat);
      tuft.position.set(0, r * 2.7, 0);
      a.add(tuft);
    }

    // 短短的小手，跳的时候会甩
    const hands = [];
    [-1, 1].forEach((s) => {
      const h = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 10, 8), bodyMat);
      h.position.set(s * r * 0.92, r * 1.18, r * 0.24);
      a.add(h);
      hands.push(h);
    });
    a.userData.hands = hands;
    return a;
  };

  const spots = [
    { kind: ['bunny', cream], x: 2.5, z: -3.55, s: 1.0 },
    { kind: ['round', pinky], x: 3.28, z: -3.15, s: 0.86 },
    { kind: ['chick', sunny], x: 3.98, z: -3.6, s: 0.78 },
    { kind: ['bunny', mint], x: 2.62, z: -4.3, s: 0.72 },
  ];

  spots.forEach((sp, i) => {
    const a = critter(sp.kind[1], { ears: sp.kind[0] });
    a.position.set(sp.x, 0, sp.z);
    // 转过来面向观众（开场机位在 -Z 那头），跳起来才看得见脸
    a.rotation.y = Math.PI - 0.16 - i * 0.05;
    a.userData.baseRot = a.rotation.y;
    a.scale.setScalar(sp.s);
    a.userData.hop = {
      phase: i * 1.7,
      amp: 0,          // 0 = 安静，1 = 正在蹦
      baseY: 0,
      speed: 3.1 + i * 0.22,
    };
    g.add(a);
  });

  scene.add(g);
  return g;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 小白：一只白色的萨摩耶。会摇尾巴、吐舌头、歪头看人；
// 点它一下，它会开心地跳起来、抬起前爪冲你招手
// ---------------------------------------------------------------------------
function buildDog(scene) {
  const g = new THREE.Group();

  const fur = new THREE.MeshStandardMaterial({ color: 0xfefcf9, roughness: 0.96, metalness: 0 });
  const fur2 = new THREE.MeshStandardMaterial({ color: 0xf3ede5, roughness: 0.98, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2523, roughness: 0.42 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xe87f95, roughness: 0.5 });

  const sp = (geo, mat, pos, scale, rot) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const ball = (r, mat, pos, scale, rot, seg = 16) =>
    sp(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), mat, pos, scale, rot);

  // ---- 身体（面朝 +Z 建，最后整体转向入口）----
  const body = sp(new THREE.CapsuleGeometry(0.3, 0.34, 8, 20), fur, [0, 0.56, -0.04], null, [Math.PI / 2, 0, 0]);
  g.add(body);
  // 蓬松的胸毛 / 屁股毛（萨摩耶就是一团棉花）
  g.add(ball(0.235, fur, [0, 0.6, 0.2], [1.06, 1.0, 0.86]));
  g.add(ball(0.215, fur, [0, 0.46, 0.16], [1.08, 0.9, 0.9]));
  g.add(ball(0.24, fur, [0, 0.56, -0.28], [1.0, 1.0, 0.92]));
  g.add(ball(0.14, fur2, [0.2, 0.44, 0.02], [0.9, 1.1, 1.2]));
  g.add(ball(0.14, fur2, [-0.2, 0.44, 0.02], [0.9, 1.1, 1.2]));

  // ---- 四条腿（右前爪单独成组，可以抬起来招手）----
  const legGeo = new THREE.CylinderGeometry(0.085, 0.072, 0.38, 12);
  [[0.19, -0.24], [-0.19, -0.24]].forEach(([x, z]) => {
    g.add(sp(legGeo, fur, [x, 0.21, z]));
    g.add(ball(0.098, fur, [x, 0.062, z + 0.03], [1.05, 0.82, 1.18]));
  });
  g.add(sp(legGeo, fur, [-0.19, 0.21, 0.22]));
  g.add(ball(0.098, fur, [-0.19, 0.062, 0.25], [1.05, 0.82, 1.18]));

  const paw = new THREE.Group();
  paw.position.set(0.19, 0.4, 0.2);
  const pawLeg = sp(legGeo, fur, [0, -0.19, 0]);
  const pawFoot = ball(0.1, fur, [0, -0.375, 0.03], [1.05, 0.85, 1.2]);
  paw.add(pawLeg, pawFoot);
  g.add(paw);

  // ---- 头 ----
  const head = new THREE.Group();
  head.position.set(0, 0.94, 0.28);
  head.rotation.x = -0.06;   // 微微抬头看人
  g.add(head);

  head.add(ball(0.28, fur, [0, 0, 0], [1.03, 1.0, 0.98], null, 22));
  // 两颊的蓬毛
  head.add(ball(0.155, fur, [0.19, -0.07, 0.08], [0.95, 1.0, 0.92]));
  head.add(ball(0.155, fur, [-0.19, -0.07, 0.08], [0.95, 1.0, 0.92]));
  // 口鼻
  head.add(ball(0.15, fur, [0, -0.095, 0.235], [1.0, 0.78, 1.08]));
  head.add(ball(0.04, dark, [0, -0.078, 0.362], [1.22, 0.9, 0.82], null, 14));
  // 嘴：两道弯弯的笑
  const smileMat = new THREE.MeshStandardMaterial({ color: 0x3a2f2c, roughness: 0.6 });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0095, 6, 12, Math.PI), smileMat);
  smile.position.set(0, -0.148, 0.335);
  smile.rotation.z = Math.PI;
  head.add(smile);

  // 一只圆眼睛 + 一只正在眨的眼睛
  const eye = ball(0.043, dark, [0.128, 0.05, 0.243], [1, 1.06, 0.9], null, 16);
  head.add(eye);
  head.add(ball(0.014, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }),
    [0.14, 0.064, 0.272], [1, 1, 1], null, 10));
  const wink = new THREE.Mesh(
    new THREE.TorusGeometry(0.058, 0.0125, 6, 18, Math.PI),
    dark
  );
  wink.position.set(-0.128, 0.05, 0.241);
  wink.rotation.z = Math.PI;   // 弧口朝上 = 弯弯的眯眯眼
  head.add(wink);

  // 吐出来的小舌头
  const tongue = new THREE.Group();
  tongue.position.set(0, -0.152, 0.318);
  const tng = sp(new THREE.SphereGeometry(0.055, 14, 10), tongueMat, [0, -0.04, 0.012], [0.85, 0.58, 0.95]);
  tongue.add(tng);
  head.add(tongue);

  // 耳朵：萨摩耶的立耳，三角锥 + 一点内耳粉
  const earGeo = new THREE.ConeGeometry(0.098, 0.22, 14);
  const earInner = new THREE.ConeGeometry(0.058, 0.14, 12);
  const earInnerMat = new THREE.MeshStandardMaterial({ color: 0xf5c3cf, roughness: 0.9 });
  [[-1, 1], [1, -1]].forEach(([sx, srz]) => {
    const x = sx * 0.215;
    head.add(sp(earGeo, fur, [x, 0.215, -0.02], [1, 1, 0.72], [0.1, 0, srz * 0.3]));
    head.add(sp(earInner, earInnerMat, [x * 0.96, 0.2, 0.035], [1, 1, 0.55], [0.1, 0, srz * 0.3]));
  });
  // 头顶的蓬毛，让耳朵之间不那么圆
  head.add(ball(0.145, fur, [0, 0.19, -0.01], [1.28, 0.8, 1.1], null, 16));

  // ---- 卷起来的尾巴 ----
  const tail = new THREE.Group();
  tail.position.set(0, 0.66, -0.34);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.02, 0),
    new THREE.Vector3(0.02, 0.2, -0.13),
    new THREE.Vector3(0.0, 0.36, 0.02),
    new THREE.Vector3(-0.01, 0.3, 0.19),
  ]);
  const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.093, 8, false), fur);
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  tail.add(ball(0.115, fur, [0.0, 0.36, -0.02], [1, 1, 1]));
  tail.add(ball(0.1, fur, [-0.01, 0.31, 0.18], [1, 1, 1]));
  tail.add(ball(0.1, fur2, [0.0, 0.24, -0.16], [1, 1, 1]));
  g.add(tail);

  // ---- 头顶的小名牌（永远面向观众）----
  const labelTex = canvasTexture(320, 150, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const r = 30;
    ctx.beginPath();
    ctx.moveTo(30 + r, 20);
    ctx.arcTo(w - 30, 20, w - 30, 130, r);
    ctx.arcTo(w - 30, 130, 30, 130, r);
    ctx.arcTo(30, 130, 30, 20, r);
    ctx.arcTo(30, 20, w - 30, 20, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c25f7d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 46px "Songti SC", "STSong", serif';
    ctx.fillText('小 白', w / 2, 66);
    ctx.fillStyle = 'rgba(74,49,57,0.42)';
    ctx.font = '400 20px Georgia, serif';
    ctx.fillText('S A M O Y E D', w / 2, 106);
  });
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTex, transparent: true, depthWrite: false, fog: false, toneMapped: false,
  }));
  label.scale.set(0.8, 0.375, 1);
  label.position.set(0, 1.62, 0.1);
  g.add(label);

  // 站在电视右边：和机身留出一小段距离，不动位置，只转头看人
  g.position.set(-3.5, 0, -3.2);
  g.scale.setScalar(1.32);
  g.rotation.y = Math.PI + 0.42; // 面向观众方向，侧着头看电视
  g.userData = { tail, head, paw, tongue, label, labelY: 1.62, baseY: 0, baseScale: 1.32, excitedUntil: 0 };
  scene.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// 一层角落的电视：一台搁在矮柜上的老式显像管电视，屏幕是「CD 表面」
// 点它才亮，亮起来旁边会浮出一排歌名（真正的界面在 HTML 里，这里只是机体）
// ---------------------------------------------------------------------------
var TV_AT_CENTER = true;   // 电视立在展厅正中央的地面上（壁纸不变，只换位置与大小）

function buildTV(scene, loadTexture, wallAngle) {
  const g = new THREE.Group();
  // 放大一点：从环廊那头也看得清屏幕上的那张脸
  const TV_S = 1.22;
  g.scale.setScalar(TV_S);
  const cream = new THREE.MeshStandardMaterial({ color: 0xfdf3f1, roughness: 0.55, metalness: 0.06 });
  const cream2 = new THREE.MeshStandardMaterial({ color: 0xf2dcdd, roughness: 0.62, metalness: 0.04 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xc9758f, roughness: 0.45, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c2226, roughness: 0.35, metalness: 0.2 });

  // 矮柜
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.02, 1.55), cream2);
  base.position.y = 0.51; base.castShadow = true; base.receiveShadow = true;
  g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.66, 0.1, 1.68), cream);
  top.position.y = 1.06; top.castShadow = true;
  g.add(top);
  // 柜门缝（把手已去掉：它们像笑脸两边多出来的两个点）
  [-0.86, 0.86].forEach((x) => {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.72, 0.02), new THREE.MeshStandardMaterial({ color: 0xe2c6c9, roughness: 0.8 }));
    seam.position.set(x, 0.5, 0.78);
    g.add(seam);
  });

  // 柜子正面的一张笑脸：两只眯眼 + 一条弯弯的笑嘴
  {
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x8a4b5e, roughness: 0.6 });
    [-0.34, 0.34].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.1, 5, 10), faceMat);
      eye.position.set(x, 0.68, 0.786);
      eye.rotation.z = Math.PI / 2;
      g.add(eye);
    });
    // 弯弯的笑：半圆环，弧口朝上
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 8, 40, Math.PI), faceMat);
    smile.position.set(0, 0.62, 0.786);
    smile.rotation.z = Math.PI;
    g.add(smile);
  }

  // 电视机体（老式 CRT，屁股后面收一点）
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.62, 1.72, 1.36), cream);
  body.position.set(0, 2.02, 0);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.42), cream2);
  back.position.set(0, 2.0, -0.86);
  back.castShadow = true;
  g.add(back);

  // 屏幕外框（凹进去的深色边）
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(2.14, 1.3, 0.06), darkMat);
  bezel.position.set(-0.16, 2.06, 0.69);
  g.add(bezel);

  // 屏幕本体：一张粉调的照片（还没点歌时就是这张定格画面）
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.98, 1.14),
    new THREE.MeshBasicMaterial({ map: null, color: 0xf7dbe6, toneMapped: false })
  );
  // 壁纸直接用 <img> 加载后画进 canvas：不依赖贴图队列，任何环境下都能出来
  {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const cx = c.getContext('2d');
      // 直接按原图方向绘制（之前翻 180° 是反的，已改回）
      cx.drawImage(im, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      screen.material.map = tex;
      screen.material.color.set(0xffffff);
      screen.material.needsUpdate = true;
    };
    im.onerror = () => {};
    im.src = 'assets/site/tv-photo.jpg';
  }
  screen.position.set(-0.16, 2.06, 0.726);
  screen.name = 'tv-screen';
  g.userData.debugScreen = () => screen.getWorldPosition(new THREE.Vector3()).toArray();
  g.add(screen);

  // 圆角玻璃罩的微光（让屏幕有一点弧面反光）
  const glare = new THREE.Mesh(
    new THREE.PlaneGeometry(1.98, 1.14),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 160, (ctx, w, h) => {
        const gr = ctx.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, 'rgba(255,255,255,0.28)');
        gr.addColorStop(0.4, 'rgba(255,255,255,0.04)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      }),
      transparent: true, depthWrite: false, toneMapped: false,
    })
  );
  glare.position.set(-0.16, 2.06, 0.73);
  g.add(glare);

  // 右侧的旋钮与喇叭孔
  [2.28, 1.84].forEach((y, i) => {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20), i ? cream2 : rose);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(1.06, y, 0.69);
    g.add(knob);
  });
  const grille = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.06, 0.34, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xd8b8bd, roughness: 0.8 }),
    6
  );
  grille.frustumCulled = false;
  for (let i = 0; i < 6; i++) {
    tmpObj.position.set(0.86 + i * 0.075, 1.44, 0.69);
    tmpObj.rotation.set(0, 0, 0);
    tmpObj.scale.set(1, 1, 1);
    tmpObj.updateMatrix();
    grille.setMatrixAt(i, tmpObj.matrix);
  }
  g.add(grille);

  // 两根兔耳天线
  [-1, 1].forEach((s) => {
    const len = 1.5;
    const geo = new THREE.CylinderGeometry(0.012, 0.02, len, 8);
    geo.translate(0, len / 2, 0);
    const rod = new THREE.Mesh(geo, MAT.metal);
    rod.position.set(s * 0.2, 2.86, -0.2);
    rod.rotation.z = -s * 0.62;
    rod.rotation.x = -0.16;
    g.add(rod);
    const ballTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), MAT.metal);
    ballTip.position.set(s * 0.2 + s * Math.sin(0.62) * len, 2.86 + Math.cos(0.62) * len, -0.32);
    g.add(ballTip);
  });

  // 位置：默认立在中庭；给了 wallAngle 就靠在一楼弧墙上、屏幕朝厅内
  // 模型的面板/屏幕都建在 -Z 侧，rotation.y = wallAngle 时正对展厅中央
  let TV_POS, rotY;
  if (TV_AT_CENTER) {
    // 展厅正中央：电视自己站着，屏幕朝入口（+Z）那一侧
    TV_POS = new THREE.Vector3(0, 0, -2.0);
    rotY = Math.atan2(TV_POS.x - 0, TV_POS.z - 26);
  } else if (wallAngle !== undefined) {
    const rr = DIM.R - 0.42;
    TV_POS = new THREE.Vector3(Math.sin(wallAngle) * rr, 0.16, Math.cos(wallAngle) * rr);
    rotY = wallAngle;
  } else {
    TV_POS = new THREE.Vector3(0.4, 0.16, -2.2);
    rotY = Math.atan2(TV_POS.x - 3.0, TV_POS.z - 13.0);
  }
  g.position.copy(TV_POS);
  g.rotation.y = rotY;
  scene.add(g);

  g.userData.screen = screen;
  return {
    group: g,
    screen,
    // 给「声音光带」用的极坐标
    x: TV_POS.x, y: TV_POS.y, z: TV_POS.z,
    r: Math.hypot(TV_POS.x, TV_POS.z),
  };
}

// ---------------------------------------------------------------------------
// 布展：照片怎么摆
// ---------------------------------------------------------------------------

function chapterLabels(span, chapter, angleCenter, scene, pickables, baseY = 0.42) {
  const tex = canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(58,52,42,0.92)';
    ctx.font = '500 96px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'left';
    ctx.fillText(chapter.num, 40, 118);
    ctx.font = '400 104px "Songti SC", "STSong", "Microsoft YaHei", serif';
    ctx.fillText(chapter.cn, 210, 120);
    ctx.fillStyle = 'rgba(58,52,42,0.42)';
    ctx.font = '400 40px Georgia, serif';
    ctx.letterSpacing = '10px';
    ctx.fillText(chapter.en, 214, 190);
    ctx.strokeStyle = 'rgba(58,52,42,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, 226); ctx.lineTo(960, 226); ctx.stroke();
  });
  const w = Math.min(span * DIM.R * 0.46, 2.9);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w / 4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
  );
  // 靠地的展签（美术馆做法：贴在作品下方、墙脚的位置，不压到画）
  const angle = angleCenter;
  mesh.position.set(Math.sin(angle) * (DIM.R - 0.5), baseY, Math.cos(angle) * (DIM.R - 0.5));
  mesh.rotation.y = angle + Math.PI;
  scene.add(mesh);
  return mesh;
}

// 顶上飞的千纸鹤：两片三角翅膀拼一只鹤，一群绕着中庭慢慢盘旋
function buildCranes(scene) {
  const group = new THREE.Group();
  group.name = 'cranes';
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xffd3e2, roughness: 0.62, metalness: 0,
    emissive: 0xff9dbe, emissiveIntensity: 0.5,
    side: THREE.DoubleSide, fog: false,
  });
  const CRANES = 10;
  const birds = [];
  for (let i = 0; i < CRANES; i++) {
    const b = new THREE.Group();
    const s = 0.72 + Math.random() * 0.34;          // 鹤的大小（大一点，抬头就看得见）
    // 身体：细长三角
    const body = new THREE.Mesh(new THREE.ConeGeometry(s * 0.2, s * 1.5, 5), paperMat);
    body.rotation.x = Math.PI / 2;
    b.add(body);
    // 头颈：往前伸一根细锥
    const neck = new THREE.Mesh(new THREE.ConeGeometry(s * 0.09, s * 0.85, 4), paperMat);
    neck.position.set(0, s * 0.12, s * 1.05);
    neck.rotation.x = Math.PI / 2.55;
    b.add(neck);
    // 尾巴：往后一片小三角
    const tailGeo = new THREE.ConeGeometry(s * 0.16, s * 0.75, 3);
    const tail = new THREE.Mesh(tailGeo, paperMat);
    tail.position.set(0, s * 0.05, -s * 0.95);
    tail.rotation.x = -Math.PI / 2.2;
    b.add(tail);
    // 两片翅膀：用两面都有材质的平面，怎么翻都不怕背面剔除
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(s * 1.5, s * 0.5);
    wingShape.lineTo(s * 1.35, -s * 0.1);
    wingShape.lineTo(0, -s * 0.7);
    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wl = new THREE.Mesh(wingGeo, paperMat);
    const wr = new THREE.Mesh(wingGeo, paperMat);
    wr.scale.x = -1;
    // 翅膀平放在 xy 平面，绕 z 轴扇动（从下面看是上下扑）
    wl.rotation.x = -Math.PI / 2;
    wr.rotation.x = -Math.PI / 2;
    const wlPivot = new THREE.Group();
    const wrPivot = new THREE.Group();
    wlPivot.add(wl); wrPivot.add(wr);
    b.add(wlPivot, wrPivot);
    b.userData = {
      wingL: wlPivot, wingR: wrPivot,
      r: 6.5 + Math.random() * 12,                 // 盘旋半径
      y: DIM.CEIL - 2.4 - Math.random() * 2.2,     // 都在顶上飞
      a: Math.random() * Math.PI * 2,
      speed: 0.12 + Math.random() * 0.12,          // rad/s
      flap: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2,
    };
    birds.push(b);
    group.add(b);
  }
  scene.add(group);
  group.userData.birds = birds;
  return group;
}

// 顶部的一串小灯：暖粉光的小圆灯挂着，一闪一闪像萤火
function buildCeilingLights(scene) {
  const group = new THREE.Group();
  group.name = 'ceilLights';
  const lamps = [];

  // ① 天花内圈一道暖粉光圈（贴在天花板上，一圈一圈往外淡）
  [10.5, 15.5, 20.5].forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.22, r + 0.22, 128),
      new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xffd0e0 : 0xffe6ef,
        transparent: true, opacity: 0.42 - i * 0.09,
        side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = DIM.CEIL - 0.06;
    ring.renderOrder = 1;
    group.add(ring);
  });

  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const r = 9 + (i % 3) * 4.5;
    const y = DIM.CEIL - 1.6 - (i % 4) * 0.7;
    const g = new THREE.Group();
    // 吊线
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, DIM.CEIL - y, 5),
      new THREE.MeshBasicMaterial({ color: 0xc9a3b0 }));
    wire.position.y = (DIM.CEIL - y) / 2;
    // 灯罩 + 光珠
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe3ec, emissive: 0xffc9da, emissiveIntensity: 0.9, roughness: 0.4 }));
    g.add(wire, shade);
    g.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    g.userData = { shade, phase: Math.random() * Math.PI * 2 };
    lamps.push(g);
    group.add(g);
  }
  scene.add(group);
  group.userData.lamps = lamps;
  return group;
}

export function buildMuseum({ scene, chapters, flowers, manifest, loadTexture, onProgress }) {
  const arch = buildArchitecture(scene);
  const decor = buildDecor(scene);        // 一层的装饰（原来树的位置周边）

  const pickables = [];
  const layout = { chapters: {}, photos: {}, flowerSpots: [] };
  layout.mist = [];                     // 天花粉雾已按需求取消（保留空数组兼容）
  if (arch.userData.ceilStars) arch.userData.ceilStars.userData.ceilStars = true;
  layout.dog = buildDog(scene);         // 中庭的小狗
  layout.decor = decor;                 // 一层的小装饰
  const party = buildPartyAnimals(scene);   // 电视旁边那一小群会蹦的动物
  layout.dancers = party.children;
  layout.cranes = buildCranes(scene);       // 顶上盘旋的千纸鹤
  layout.ceilLights = buildCeilingLights(scene); // 顶部一串会呼吸的小灯

  const totalPhotos = chapters.reduce((s, c) => s + (manifest[c.cat]?.length || 0), 0)
    + (manifest[flowers.cat]?.length || 0);   // 花与光吊在塔顶，也计入加载进度
  let loaded = 0;

  const attach = (mesh, photo, chapter, caption) => {
    mesh.userData.pick = {
      id: photo.id, cat: photo.cat, file: photo.file,
      cn: chapter.cn, num: chapter.num, en: chapter.en,
      caption, w: photo.w, h: photo.h,
    };
    pickables.push(mesh);
    layout.photos[photo.id] = {
      id: photo.id, cat: photo.cat, mesh,
      position: mesh.getWorldPosition(new THREE.Vector3()),
      normal: new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())),
      photo, chapter,
    };
    loadTexture(photo.file).then((tex) => {
      mesh.material.map = tex;
      mesh.material.color.set(0xffffff);
      mesh.material.needsUpdate = true;
      loaded++;
      onProgress && onProgress(loaded / totalPhotos);
    }).catch(() => {
      loaded++;
      onProgress && onProgress(loaded / totalPhotos);
    });
  };

  // 照片用 fetch + createImageBitmap 解码。ImageBitmap 上传纹理时浏览器会忽略
  // UNPACK_FLIP_Y_WEBGL，所以把 uv 的 v 轴手动翻一次，否则整面墙的照片是倒的。
  const photoGeometry = (w, h) => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    uv.needsUpdate = true;
    return g;
  };

  const makePhotoMesh = (w, h, photo, chapter, caption, doubleSided = false) => {
    // 展品用自发光材质：像被灯打亮的照片，不会被环境光冲白
    const mat = new THREE.MeshBasicMaterial({      color: 0xdcd7cb,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      toneMapped: false, // 照片本身不做色调映射，保留原始颜色
    });
    const m = new THREE.Mesh(photoGeometry(w, h), mat);
    attach(m, photo, chapter, caption);
    return m;
  };

  // ---- 章节弧形展墙 ----
  const GAP = 0.62;
  const TOTAL = Math.PI * 2 - GAP;

  // 章节之间：拱形天光窗 + 竖向灯缝，把弧墙切开
  // 窗外的景也换成粉雾海（天色从浅粉到暖玫瑰，浮着一层层雾），和天花呼应
  const winTex = canvasTexture(512, 768, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = w / 2;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, r);
      ctx.arc(r, r, r, Math.PI, 0);
      ctx.lineTo(w, h);
      ctx.closePath();
    };
    ctx.save();
    path();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fff5f8');
    g.addColorStop(0.3, '#fde0ea');
    g.addColorStop(0.66, '#f6c3d7');
    g.addColorStop(1, '#e8a8c6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 窗外的雾层：一堆柔和的白粉光斑，越靠上越亮
    for (let i = 0; i < 26; i++) {
      const cx = Math.random() * w;
      const cy = h * 0.18 + Math.random() * h * 0.8;
      const rr = 44 + Math.random() * 120;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, `rgba(255, 252, 254, ${0.3 + Math.random() * 0.28})`);
      rg.addColorStop(1, 'rgba(255, 246, 250, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }
    // 细微的粉调颗粒，让窗户有质感
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * w, sy = Math.random() * h;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.3})`;
      ctx.beginPath(); ctx.arc(sx, sy, Math.random() * 2 + 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(246,242,233,0.95)';
    ctx.lineWidth = 20;
    path();
    ctx.stroke();
  });

  // 每层三扇拱形天光窗（各层错开方位）——挂在布展之后，自动避开照片
  const wallSpans = {};   // lv -> [[aStart,aEnd],...]，照片占用的墙面角度
  const markSpan = (lv, a, halfW) => {
    (wallSpans[lv] = wallSpans[lv] || []).push([a - halfW - 0.12 / DIM.R, a + halfW + 0.12 / DIM.R]);
  };
  const placeWindows = () => {
    for (let lv = 0; lv < DIM.N; lv++) {
      const spans = wallSpans[lv] || [];
      for (let k = 0; k < 3; k++) {
        let a = Math.PI + GAP / 2 + ((lv * 1.13 + k) / 3) * TOTAL;
        // 撞到照片就往旁边挪，最多试 40 次，总能找到缝
        for (let t = 0; t < 40; t++) {
          const hit = spans.find(([s0, s1]) => a > s0 - 1.55 / DIM.R && a < s1 + 1.55 / DIM.R);
          if (!hit) break;
          a += 0.09;   // 朝同一方向让路
        }
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 3.75),
          new THREE.MeshBasicMaterial({ map: winTex, transparent: true, toneMapped: false, depthWrite: false })
        );
        win.position.set(Math.sin(a) * (DIM.R - 0.24), DIM.levelY(lv) + 2.35, Math.cos(a) * (DIM.R - 0.24));
        win.rotation.y = a + Math.PI;
        scene.add(win);
      }
    }
  };

  // ---- 塔式布展：一层一个主题，四层各挂一面墙，旋梯串起来 ----
  // 1F 粉雾海 → 2F 天空的自由 → 3F 生活碎片 → 4F 夜幕来临前
  // 每一层的照片「顶边」都对齐同一条高度线，站在中庭抬头看，一圈画框像被一条线牵着
  const LEVELS = ['pink', 'sky', 'daily', 'dusk'];
  const chapterById = Object.fromEntries(chapters.map((c) => [c.id, c]));
  layout.floors = [];

  const BASE_H = 3.4;          // 基准画高（统一高度用）——整体加大一号，看得更清楚
  const TOP_ALIGN = 4.6;       // 每一层：照片顶边离本层地面的高度（全楼层一致）
  const maxArc = TOTAL * DIM.R * 0.56;

  // 每层的机位：站在本层环廊上，侧对着整排画，一眼能收下大部分
  const chapterCam = (center, lvY) => {
    const camA = center - 0.98;
    const camR = 24.4;
    const lookA = center - 0.14;
    const lookR = 29.4;
    return {
      view: new THREE.Vector3(Math.sin(camA) * camR, lvY + 2.35, Math.cos(camA) * camR),
      lookAt: new THREE.Vector3(Math.sin(lookA) * lookR, lvY + 2.9, Math.cos(lookA) * lookR),
      wallPoint: new THREE.Vector3(Math.sin(lookA) * (DIM.R - 1), lvY + 2.9, Math.cos(lookA) * (DIM.R - 1)),
    };
  };

  LEVELS.forEach((id, fi) => {
    const ch = chapterById[id];
    const isFirst = fi === 0;
    const lvY = DIM.levelY(fi);
    const center = Math.PI + GAP / 2 + TOTAL / 2; // 展签与机位都放在正对入口缺口的方向
    layout.floors.push({ level: fi, ids: [id] });

    const photos = (manifest[ch.cat] || []).map((p, i) => ({
      ...p, id: `${ch.cat}-${String(i + 1).padStart(2, '0')}`, cat: ch.cat,
      caption: ch.captions[i % ch.captions.length],
    }));

    // 所有照片一律贴在本层弧墙上，竖排、单排、顶边齐平
    const m = photos.length;
    const solo = m === 1;
    // 一层的画压低一点、摊宽一点：电视矮，挡不到画；
    // 站得远也看得清，一圈画更像一条横向的长卷
    const baseH = isFirst ? 2.5 : BASE_H;
    const topAlign = isFirst ? 3.9 : TOP_ALIGN;
    const capW = isFirst ? 6.4 : 5.0;      // 一层的画允许更宽，横着摊开
    const sizes = photos.map((photo) => {
      const aspect = photo.w / photo.h;
      let ph = solo ? baseH * 1.22 : baseH;
      let pw = ph * aspect;
      if (pw > capW) { pw = capW; ph = pw / aspect; }
      return { pw, ph };
    });
    const widths = sizes.reduce((s, x) => s + x.pw, 0);
    let gap = m > 1 ? Math.min(2.6, Math.max(1.6, (maxArc - widths) / (m - 1))) : 0;
    let total = widths + gap * (m - 1);
    if (total > maxArc) {
      const k = (maxArc - gap * (m - 1)) / (total - gap * (m - 1));
      sizes.forEach((s) => { s.pw *= k; s.ph *= k; });
      total = maxArc;
    }

    // 起点按「最早完工」排：最宽的一幅居中，其余往两边长，缺口处自然留白
    // 一层特殊：正中央那面墙留给电视，前 3 幅排左边、后 3 幅排右边
    let cursor = center - (total / 2) / DIM.R;
    const tvHalf = isFirst ? 3.4 / DIM.R : 0;   // 中央留给电视的那段墙
    if (isFirst) {
      const leftW = sizes.slice(0, 3).reduce((s, x) => s + x.pw, 0) + gap * 2;
      cursor = center - tvHalf - leftW / DIM.R;
    }
    const tops = [];   // 记录每件的顶边高度，供自检

    photos.forEach((photo, i) => {
      const { pw, ph } = sizes[i];
      if (isFirst && i === 3) cursor = center + tvHalf;   // 跳过电视，从右边重新起步
      const a = cursor + (pw / 2) / DIM.R;
      cursor += (pw + gap) / DIM.R;
      const py = lvY + topAlign - ph / 2;   // ← 顶边齐平
      tops.push(+(py + ph / 2).toFixed(2));

      const group = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.3, ph + 0.3, 0.1), MAT.frame);
      frame.castShadow = true;
      // 画框后的一层淡影，让白墙上的作品有厚度
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(pw + 0.52, ph + 0.52),
        new THREE.MeshBasicMaterial({ color: 0x6b5257, transparent: true, opacity: 0.07, depthWrite: false, toneMapped: false })
      );
      shadow.position.z = -0.06;
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.18, ph + 0.18), MAT.mat);
      mat.position.z = 0.052;
      const img = makePhotoMesh(pw, ph, photo, ch, photo.caption);
      img.position.z = 0.062;
      group.add(shadow, frame, mat, img);

      const rr = DIM.R - 0.16;
      group.position.set(Math.sin(a) * rr, py, Math.cos(a) * rr);
      group.rotation.y = a + Math.PI;
      scene.add(group);
      markSpan(fi, a, (pw / 2) / DIM.R);   // 记下这面墙被占了，拱窗要让开

      // 让 layout 里记录真实世界坐标
      group.updateMatrixWorld(true);
      const rec = layout.photos[photo.id];
      if (rec) {
        rec.position.copy(img.getWorldPosition(new THREE.Vector3()));
        rec.normal.set(-Math.sin(a), 0, -Math.cos(a));
        rec.floor = fi;
        rec.angle = a;
        rec.size = { pw, ph };
      }
    });

    // 章节标签贴在本层墙脚（一层挪到左边，别藏在电视后面）
    chapterLabels(TOTAL, ch, isFirst ? center - 6.4 / DIM.R : center, scene, pickables, lvY + 0.42);

    let cam = chapterCam(center, lvY);
    if (isFirst) {
      // 一层：站到正对面、稍微高一点，电视居中，左右各三幅画一起收进画面
      cam = {
        view: new THREE.Vector3(0, 3.15, -13.0),
        lookAt: new THREE.Vector3(Math.sin(center) * 29, 2.55, Math.cos(center) * 29),
        wallPoint: new THREE.Vector3(Math.sin(center) * (DIM.R - 1), 2.4, Math.cos(center) * (DIM.R - 1)),
      };
    }
    layout.chapters[ch.id] = {
      ...ch,
      count: photos.length,
      centerAngle: center,
      span: TOTAL,
      floor: fi,
      alignTop: +(lvY + (isFirst ? 3.9 : TOP_ALIGN)).toFixed(2),
      view: cam.view,
      lookAt: cam.lookAt,
      wallPoint: cam.wallPoint,
    };
  });

  // 布展完了再挂拱窗，保证每一扇都落在照片之间的空墙上
  placeWindows();

  // 电视立在一楼展厅正中央的墙前：左边三幅、右边三幅，围着它
  const CENTER1 = Math.PI + GAP / 2 + TOTAL / 2;
  layout.tv = buildTV(scene, loadTexture, CENTER1);   // 点它才唱歌
  markSpan(0, CENTER1, 1.9 / DIM.R);                  // 电视占的墙面也让拱窗让开

  // 全馆「陪你一起看」顺序：一层 → 顶层，同层按墙面角度顺时针走
  const allRecs = Object.values(layout.photos).filter((p) => p.floor !== undefined && p.chapter.id !== 'flower');
  let ang0 = Infinity;
  allRecs.forEach((p) => { if (p.floor === 0) ang0 = Math.min(ang0, p.angle); });
  const wrap = (a) => ((a - (ang0 - 0.001)) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  allRecs.forEach((p) => { p.angleRel = wrap(p.angle); });
  layout.order = allRecs
    .sort((a, b) => (a.floor - b.floor) || (a.angleRel - b.angleRel))
    .map((p) => p.id);

  // 「陪你一起看」时每一件的机位：正对作品、退到能看全的距离，
  // 竖直方向也顺着画心抬一点（高层的画要抬头看）
  layout.order.forEach((id) => {
    const rec = layout.photos[id];
    if (!rec) return;
    const n = rec.normal.clone().normalize();
    const pw = rec.size ? rec.size.pw : 3;
    const ph = rec.size ? rec.size.ph : 3;
    const dist = Math.max(3.4, Math.min(7.2, pw * 1.28 + ph * 0.35));
    const view = rec.position.clone().addScaledVector(n, dist);
    // 站在环廊里（别穿到中庭外面去），高度贴着画心略低一点
    const r = Math.hypot(view.x, view.z);
    const rr = Math.min(r, DIM.R - 2.6);
    if (r > rr) { view.x *= rr / r; view.z *= rr / r; }
    view.y = rec.position.y - ph * 0.1;
    rec.view = view;
    rec.look = rec.position.clone();
  });

  // ---- 花：重新吊回塔顶，像两圈悬在空中的风铃 ----
  // 外圈 5 张（低一点）、内圈 4 张（高一点），顶边各自齐平，全部面向中庭中心
  {
    const flowerPhotos = (manifest[flowers.cat] || []).map((p, i) => ({
      ...p, id: `flower-${String(i + 1).padStart(2, '0')}`, cat: 'flower',
      caption: flowers.captions[i % flowers.captions.length],
    }));

    const RINGS = [
      { n: 5, r: 13.2, top: DIM.CEIL - 2.9, phase: 0.55 },   // 外圈（低一层）
      { n: 4, r: 8.4, top: DIM.CEIL - 1.5, phase: 1.35 },    // 内圈（高一层）
    ];
    const HANG_H = 2.15;   // 每张花的高度都一样

    let fi = 0;
    RINGS.forEach((ring) => {
      const list = flowerPhotos.slice(fi, fi + ring.n);
      fi += ring.n;
      list.forEach((photo, k) => {
        const aspect = photo.w / photo.h;
        let pw = Math.min(HANG_H * aspect, 2.9);
        const ph = Math.min(HANG_H, pw / aspect);
        pw = ph * aspect;
        const img = makePhotoMesh(pw, ph, photo, flowers, photo.caption, true);
        const h = img.geometry.parameters.height;

        const g = new THREE.Group();
        g.add(img);
        // 吊杆 + 两根细钢索，一路吊到天花
        const bar = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.1, 0.05, 0.04), MAT.frameDark);
        bar.position.y = h / 2 + 0.07;
        g.add(bar);
        const drop = DIM.CEIL - (ring.top - h / 2) - 0.12;
        [-1, 1].forEach((s) => {
          const wire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, drop, 4),
            MAT.frameDark
          );
          wire.position.set(s * pw * 0.36, h / 2 + 0.1 + drop / 2, 0);
          g.add(wire);
        });

        const a = ring.phase + (k / ring.n) * Math.PI * 2;
        const y = ring.top - h / 2;    // ← 顶边齐平
        g.position.set(Math.sin(a) * ring.r, y, Math.cos(a) * ring.r);
        g.rotation.y = a + Math.PI;    // 面向中庭中心
        g.userData.float = { baseY: y, phase: k * 1.1 + ring.r, speed: 0.42 };
        scene.add(g);
        g.updateMatrixWorld(true);

        const rec = layout.photos[photo.id];
        if (rec) {
          rec.position.copy(img.getWorldPosition(new THREE.Vector3()));
          rec.normal.set(-Math.sin(a), 0, -Math.cos(a));
          rec.hanging = g;
          rec.size = { pw, ph: h };
          rec.floor = DIM.N;             // 花在天上，排序放最后
          rec.angle = a;
          rec.view = new THREE.Vector3(Math.sin(a) * Math.max(ring.r - 5.2, 3.2), y - 0.35, Math.cos(a) * Math.max(ring.r - 5.2, 3.2));
          rec.look = rec.position.clone();
        }
        layout.flowerSpots.push({ pos: g.position.clone(), id: photo.id });
      });
    });

    // 花也排进「陪你一起看」：看完四层，最后一抬头看花
    const flowerOrder = flowerPhotos
      .map((p) => layout.photos[p.id])
      .filter(Boolean)
      .sort((x, y) => (Math.hypot(x.position.x, x.position.z) - Math.hypot(y.position.x, y.position.z)));
    flowerOrder.forEach((rec) => layout.order.push(rec.id));
  }

  // 中庭机位（站在一层，正对一楼展厅中央的电视与两排照片）
  layout.atrium = {
    view: new THREE.Vector3(0, 3.15, -13.0),
    lookAt: new THREE.Vector3(0, 2.55, 28.0),
  };

  return { pickables, layout };
}

// ---------------------------------------------------------------------------
// 光照
// ---------------------------------------------------------------------------
export function setupLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff7f6, 0xefd8d8, 0.54));
  scene.add(new THREE.AmbientLight(0xffefed, 0.15));

  const sun = new THREE.DirectionalLight(0xffe9e4, 1.9);
  sun.position.set(7, 46, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 36;
  sun.shadow.camera.bottom = -36;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun);

  // 补光：让背光的弧墙不至于死黑
  const fillA = new THREE.PointLight(0xffece4, 26, 44, 2);
  fillA.position.set(0, 7, 20);
  const fillB = new THREE.PointLight(0xf2ecff, 20, 44, 2);
  fillB.position.set(-18, 12, -14);
  const fillC = new THREE.PointLight(0xfff0ea, 18, 44, 2);
  fillC.position.set(16, 17, -12);
  scene.add(fillA, fillB, fillC);

  // 每一层沿展墙一圈的补光，让五层墙都均匀发亮
  for (let lv = 0; lv < DIM.N; lv++) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4 + lv * 0.7;
      const p = new THREE.PointLight(0xfff0ed, 13, 30, 2);
      p.position.set(Math.sin(a) * 24.5, DIM.levelY(lv) + 2.8, Math.cos(a) * 24.5);
      scene.add(p);
    }
  }

  return { sun };
}
