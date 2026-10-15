// NASA verisi data.js dosyasından SYSARR olarak yüklenir.
window.loadPlanetSystems()
  .then(SYSARR => {
    const SYS = SYSARR.map(r => ({
      h: r[0],
      ra: r[1],
      dec: r[2],
      ly: r[3],
      teff: r[4],
      rad: r[5],
      f: r[6],
      lum: r[9],
      p: r[7].map(q => ({
        n: q[0],
        R: q[1],
        g: q[2],
        T: q[3],
        a: q[4],
        periodDays: q[6],
        insolation: q[7],
        k: "Ötegezegen",
        e: {
          R: !!(q[5] & 1),
          T: !!(q[5] & 2),
          g: !!(q[5] & 4)
        }
      }))
    }));

    // main.js dosyasındaki diğer kodlar burada devam edecek.

const SOLAR = {
  h: 'Güneş Sistemi',
  ly: 0,
  teff: 5772,
  rad: 1,
  p: [
    { n: 'Merkür', k: 'Gezegen', T: 167, g: 3.7, R: 2440, a: .387 },
    { n: 'Venüs', k: 'Gezegen', T: 464, g: 8.87, R: 6052, a: .723 },
    { n: 'Dünya', k: 'Gezegen (referans)', T: 15, g: 9.81, R: 6371, a: 1 },
    { n: 'Mars', k: 'Gezegen', T: -63, g: 3.71, R: 3390, a: 1.524 },
    { n: 'Jüpiter', ctx: 1, R: 69911, a: 5.2 },
    { n: 'Satürn', ctx: 1, R: 58232, a: 9.58 },
    { n: 'Ay', k: 'Uydu (Dünya)', par: 'Dünya', T: -23, g: 1.62, R: 1737 },
    { n: 'Europa', k: 'Uydu (Jüpiter)', par: 'Jüpiter', T: -171, g: 1.31, R: 1561 },
    { n: 'Titan', k: 'Uydu (Satürn)', par: 'Satürn', T: -179, g: 1.35, R: 2575 },
    { n: 'Enceladus', k: 'Uydu (Satürn)', par: 'Satürn', T: -198, g: .11, R: 252 }
  ]
};
function calc(b, system = null) {
  const radius = b.R != null && b.R > 0 ? b.R / 6371 : null;
  let flux = b.insolation != null && b.insolation > 0 ? b.insolation : null;
  
  if (flux == null && b.a != null && b.a > 0) {
    const luminosity = system && system.lum != null
      ? Math.pow(10, system.lum)
      : system && system.rad > 0 && system.teff > 0
        ? system.rad ** 2 * (system.teff / 5772) ** 4
        : 1;
    flux = luminosity / (b.a ** 2);
  }
  
  let temperature = b.T == null ? null : b.T + 273.15;
  b.fluxEstimated = b.insolation == null && flux != null;
  b.tempEstimated = temperature == null && flux != null && flux > 0;
  if (b.tempEstimated) temperature = 278.5 * Math.pow(flux, .25);

  // 1. FİZİKSEL VETO: Gaz Devi Kontrolü
  const isGasGiant = radius != null && radius >= 2.5;

  const checks = [
    ['Yarıçap', radius, 30, .5, 1.6, .3, 2.5],
    ['Yıldıza gelen ışınım', flux, 40, .25, 1.5, .1, 2],
    ['Denge sıcaklığı', temperature, 30, 200, 320, 170, 350]
  ];
  
  let points = 0, available = 0;
  b.parts = checks.map(([name, value, weight, lo, hi, broadLo, broadHi]) => {
    let fraction = null;
    if (value != null) {
      available += weight;
      fraction = value >= lo && value <= hi ? 1 : value >= broadLo && value <= broadHi ? .5 : 0;
      points += fraction * weight;
    }
    const shown = value == null ? 'veri yok' : name === 'Yarıçap'
      ? value.toFixed(2) + ' Dünya yarıçapı'
      : name === 'Yıldıza gelen ışınım' ? value.toFixed(2) + ' Dünya ışınımı'
      : value.toFixed(1) + ' K';
    return [name, fraction, shown];
  });

  // 2. CEZA SİSTEMİ: Güvenilirlik Çarpanı (Confidence Damping)
  if (isGasGiant) {
    b.score = null; // Gaz devlerine haritada ön eleme puanı yok
  } else if (available < 60) {
    b.score = null; // En az %60 veri yoksa elenir
  } else {
    // Ham oran (Puan / Bilinen Ağırlık)
    const rawNormalized = points / available; 
    
    // Veri kapsama oranı (Bilinen Ağırlık / 100)
    const confidence = available / 100;
    
    // Güvenilirlik Çarpanı (Eksik verisi olan gezegenin puanını sönümler)
    const confidenceMultiplier = 0.65 + 0.35 * confidence;
    
    // Tahmin Cezası (Eğer sıcaklık kütleden/ışınımdan tahmin edildiyse ufak bir kırpma)
    let estCount = 0;
    if (b.tempEstimated) estCount++;
    const estPenalty = 1.0 - (0.04 * estCount);
    
    // Nihai katı skor
    b.score = Math.round(rawNormalized * confidenceMultiplier * estPenalty * 100);
  }
}

SYS.forEach(s => s.p.forEach(b => {
  b.k = 'Ötegezegen';
  calc(b, s);
}));
SOLAR.p.forEach(b => {
  if (!b.ctx) calc(b);
});

const ALL = [SOLAR, ...SYS];
ALL.forEach(s => {
  const v = s.p.filter(b => b.score != null).map(b => b.score);
  s.best = v.length ? Math.max(...v) : null;
});

const css = s => 'hsl(' + Math.round(s * 1.2) + ',70%,52%)';
const starCol = t => t == null ? 0xd8dcec :
  t < 3500 ? 0xff6a3d :
  t < 4500 ? 0xff9a4d :
  t < 5500 ? 0xffc46b :
  t < 6500 ? 0xfff0c0 : 0xcfe0ff;

const $ = id => document.getElementById(id);
const fmt = (x, d = 1) => x.toLocaleString('tr-TR', { maximumFractionDigits: d });

const cv = document.createElement('canvas');
document.body.prepend(cv);

const ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
ren.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 1, .5, 400000);
scene.add(new THREE.AmbientLight(0xffffff, .14));

const sp = [];
const sc = [];

function addStar(v, k) {
  const t = Math.random();
  const m = k * (.55 + Math.random() * .45);
  sc.push(m * (.88 + .12 * t), m * .93, m * (1 - .14 * t));
  sp.push(v[0] * 400, v[1] * 400, v[2] * 400);
}

for (let i = 0; i < 1800; i++) {
  const a = Math.random() * 6.283;
  const b = Math.acos(2 * Math.random() - 1);
  addStar(
    [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)],
    .35 + Math.random() * .55
  );
}

for (let i = 0; i < 5000; i++) {
  const a = Math.random() * 6.283;
  const y = (Math.random() + Math.random() + Math.random() - 1.5) * .18;
  const x = Math.cos(a);
  const z = Math.sin(a);
  const n = Math.hypot(x, y, z);
  const c = Math.cos(.5);
  const q = Math.sin(.5);
  addStar(
    [x / n, (y / n) * c - (z / n) * q, (y / n) * q + (z / n) * c],
    .16 + Math.random() * .24
  );
}

const sg = new THREE.BufferGeometry();
sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));

const stars = new THREE.Points(
  sg,
  new THREE.PointsMaterial({
    vertexColors: true,
    size: 1.3,
    sizeAttenuation: false
  })
);
scene.add(stars);

const mapG = new THREE.Group();
const sysG = new THREE.Group();
scene.add(mapG, sysG);

const hitMat = new THREE.MeshBasicMaterial({ visible: false });

const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.07, 'rgba(255,255,255,.95)');
  g.addColorStop(.18, 'rgba(255,255,255,.3)');
  g.addColorStop(.5, 'rgba(255,255,255,.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

const glow = (c, size) => {
  const p = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    color: c,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  }));
  p.scale.setScalar(size);
  return p;
};

const sel = new THREE.Mesh(
  new THREE.RingGeometry(1, 1.05, 64),
  new THREE.MeshBasicMaterial({
    color: 0xb8c4e0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: .8
  })
);
sel.visible = false;
scene.add(sel);

const L = $('labels');

function mkLab(txt, cls) {
  const e = document.createElement('div');
  e.className = 'lb ' + (cls || '');
  e.textContent = txt;
  L.appendChild(e);
  return e;
}

// Yıldız haritasındaki mesafeler
const maxLy = Math.max(...SYS.map(s => s.ly));
const EXP = .75;
const mr = ly => Math.pow(ly, EXP);
const mapMax = mr(maxLy) * 4;

function dirPos(s) {
  const q = Math.PI / 180;
  const r = mr(s.ly);
  return new THREE.Vector3(
    r * Math.cos(s.dec * q) * Math.cos(s.ra * q),
    r * Math.sin(s.dec * q),
    -r * Math.cos(s.dec * q) * Math.sin(s.ra * q)
  );
}

SOLAR.pos = new THREE.Vector3();
SYS.forEach(s => s.pos = dirPos(s));

const ringTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,220,150,.9)';
  x.lineWidth = 3;
  x.beginPath();
  x.arc(64, 64, 52, 0, 6.2832);
  x.stroke();
  return new THREE.CanvasTexture(c);
})();

const ringSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: ringTex,
    transparent: true,
    depthWrite: false
  })
);
ringSprite.scale.setScalar(20);

const mapLabs = [];
let scope = 200;
let ptsA = null;
let ptsF = null;
let sunHit = null;

{
  const g = new THREE.Group();
  g.add(glow(0xffc864, 14));
  g.add(glow(0xffe9b0, 5));
  g.add(ringSprite);
  sunHit = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), hitMat);
  sunHit.userData.s = SOLAR;
  g.add(sunHit);
  mapG.add(g);
  SOLAR.node = g;

  mapLabs.push({
    el: mkLab('☉ Güneş sistemi (biz buradayız)', 's'),
    pos: SOLAR.pos,
    s: SOLAR,
    vis: () => true
  });
}

SYS.filter(s => s.f).forEach(s => {
  mapLabs.push({ el: mkLab(s.h), pos: s.pos, s, vis: () => s.ly <= scope });
});

const selLab = {
  el: mkLab(''),
  pos: new THREE.Vector3(),
  s: null,
  vis: () => !!selNode && selNode !== SOLAR && !selNode.f
};
mapLabs.push(selLab);

const ptMat = size => new THREE.PointsMaterial({
  map: glowTex,
  vertexColors: true,
  size,
  sizeAttenuation: false,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

function layer(list, size) {
  const pos = [];
  const col = [];

  list.forEach(s => {
    pos.push(s.pos.x, s.pos.y, s.pos.z);
    const c = new THREE.Color(starCol(s.teff));
    col.push(c.r, c.g, c.b);
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

  const p = new THREE.Points(g, ptMat(size));
  p.frustumCulled = false;
  p.userData.list = list;
  mapG.add(p);
  return p;
}

function setScope(R) {
  scope = R;

  if (ptsA) {
    mapG.remove(ptsA);
    mapG.remove(ptsF);
  }

  const vis = SYS.filter(s => s.ly <= R);
  ptsA = layer(vis.filter(s => !s.f), 9);
  ptsF = layer(vis.filter(s => s.f), 16);

  D = Math.min(mapMax, mr(R) * 2.3);

  document.querySelectorAll('.sc').forEach(b => {
    b.setAttribute('aria-pressed', Math.min(+b.dataset.r, maxLy) == R);
  });
}

const selDummy = new THREE.Object3D();

const nodeObj = s => {
  if (s === SOLAR) return s.node;
  selDummy.position.copy(s.pos);
  return selDummy;
};

// Sistem görünümü
let bodies = [];
let sysLabs = [];
let hitsS = [];
let curS = null;

const size = R => R == null
  ? .7
  : Math.min(1.5, .25 + Math.log10(Math.max(R, 200) / 200) * .5);

const pcol = b => new THREE.Color(
  b.n == 'Dünya' ? 0x3b6ea8 :
  b.T == null ? 0x8a8678 :
  b.T > 400 ? 0x6e3f33 :
  b.T > 120 ? 0x9b6b4c :
  b.T > -60 ? 0x8a8678 :
  b.T > -150 ? 0x9fb0bd : 0xc9d3dc
);

function planetLab(b) {
  const e = mkLab(b.n);
  if (!b.ctx && b.score != null) {
    e.innerHTML = b.n + ' <span style="color:' + css(b.score) + '">' + b.score + '</span>';
  }
  return e;
}

function enterSystem(s, pl) {
  const url = new URL("system-view.html", window.location.href);
  url.searchParams.set("host", s.h);

  if (pl) {
    url.searchParams.set("planet", pl.n);
  }

  window.location.href = url.href;
}

function enterMap() {
  view = 'map';
  curS = null;
  mapG.visible = true;
  sysG.visible = false;
  sysLabs.forEach(l => l.el.remove());
  sysLabs = [];
  mapLabs.forEach(l => l.el.style.display = 'block');
  th = .8;
  ph = 1.05;
  setScope(scope);
  tgt.set(0, 0, 0);
  flyTo = null;
  selNode = null;
  selObj = null;
  sel.visible = false;
  $('back').style.display = 'none';
  $('scopes').style.display = 'flex';
  $('ttl').textContent = 'Yıldız haritası';
  $('hint').textContent = 'Haritada ' + (SYS.length + 1) + ' yıldız sistemi (NASA verisi). Yönler gerçek; sistemler birbirinden ayrışsın diye mesafe hafif sıkıştırılmıştır, gerçek uzaklık üzerine gelince yazar. Sürükle: döndür. Sağ tık veya Shift+sürükle: kaydır. Tekerlek: imlece doğru yakınlaş. Tıkla: sistemi seç.';
  $('panel').style.display = 'none';
}

// Paneller
function showNode(s) {
  selNode = s;
  selObj = nodeObj(s);
  sel.visible = true;
  selLab.s = s;
  selLab.el.textContent = s.h;
  selLab.pos.copy(s.pos);
  const p = $('panel');
  p.style.display = 'block';

  $('pc').innerHTML =
    '<h2>' + s.h + '</h2><div class="sub">' +
    (s.ly ? fmt(s.ly) + ' ışık yılı uzakta' : 'Evimiz') +
    ' · yıldız ≈' + s.teff + ' K</div>' +
    (s.best == null ? '' :
      '<div class="sub">En yüksek ön eleme puanı: <b style="color:' +
      css(s.best) + '">' + s.best + '</b></div>') +
    s.p.filter(b => !b.ctx && !b.par).map(b =>
      '<button class="pl" data-p="' + b.n.replace(/"/g, '') + '">' +
      '<span>' + b.n + '</span><b style="color:' +
      (b.score == null ? '#7f8aa6' : css(b.score)) + '">' +
      (b.score == null ? '—' : b.score) + '</b></button>'
    ).join('') +
    '<button class="go" data-go="1">Sistemi aç</button>';
}

function showPlanet(b) {
  const p = $('panel');
  selObj = b ? b.o.m : null;
  sel.visible = !!b;

  if (!b) {
    p.style.display = 'none';
    return;
  }

  p.style.display = 'block';

  $('pc').innerHTML =
    '<h2>' + b.n + '</h2><div class="sub">' + b.k + ' · ' + curS.h + '</div>' +
    (b.score == null
      ? '<div id="score" style="color:#7f8aa6">—<small> yetersiz veri (ölçümlerin en az %60\'ı gerekli)</small></div>'
      : '<div id="score" style="color:' + css(b.score) + '">' + b.score + ' <small>/ 100 ön eleme puanı</small></div>') +
    b.parts.map(x => '<div class="row"><div class="l"><span>' + x[0] + '</span><span>' + (x[1] == null ? 'veri yok' : Math.round(x[1] * 100) + '%') + '</span></div><div class="bar"><i style="width:' + (x[1] == null ? 0 : x[1] * 100) + '%;background:' + css(x[1] == null ? 0 : x[1] * 100) + '"></i></div></div>').join('') +
    '<dl><dt>' + (b.k == 'Ötegezegen' ? 'Denge sıcaklığı' : 'Yüzey sıcaklığı') + '</dt><dd>' + b.parts[2][2] + '</dd>' +
    '<dt>Yarıçap</dt><dd>' + b.parts[0][2] + '</dd><dt>Yıldıza gelen ışınım</dt><dd>' + b.parts[1][2] + '</dd>' +
    (b.a != null ? '<dt>Yıldıza uzaklık</dt><dd>' + fmt(b.a, 3) + ' AU</dd>' : '') +
    '<dt>Yıldız</dt><dd>' + curS.h + '</dd></dl>' +
    '<p class="note">' + (b.fluxEstimated || b.tempEstimated ? 'Bazı ışınım/sıcaklık değerleri yıldız verilerinden tahmin edildi. ' : '') + 'Aynı 30/40/30 ölçütleri Python analiz kartı ve toplu raporda kullanılır. Bu proje tanımlı ön eleme endeksidir, NASA’nın resmî koloni puanı değildir. Ötegezegenlerde denge sıcaklığı, Güneş Sistemi’nde yüzey sıcaklığı kullanıldığı için karşılaştırma sınırlıdır. Atmosfer ve radyasyon değerlendirmesi içermez.</p>';
}

$('pc').addEventListener('click', e => {
  const pb = e.target.closest('[data-p]');
  const go = e.target.closest('[data-go]');

  if (pb && selNode) {
    const s = selNode;
    enterSystem(s, s.p.find(x => x.n == pb.dataset.p));
  } else if (go && selNode) {
    enterSystem(selNode);
  }
});

$('x').onclick = () => {
  if (view == 'map') {
    selNode = null;
    selObj = null;
    sel.visible = false;
    $('panel').style.display = 'none';
  } else {
    showPlanet(null);
  }
};

$('back').onclick = enterMap;
$('home').onclick = () => {
  if (view == 'map') {
    showNode(SOLAR);
    flyTo = SOLAR.pos.clone();
    flyD = 1.2;
  }
};

addEventListener('keydown', e => {
  if (e.key == 'Escape' && view == 'system') enterMap();
});

// Kamera ve seçim
let view = 'map';
let flyTo = null;
let flyD = 1;
let th = .8;
let ph = 1.05;
let D = 64;
let tgt = new THREE.Vector3();
let tg2 = new THREE.Vector3();
let selNode = null;
let selObj = null;
let drag = null;
let moved = 0;
let lastMapClick = { s: null, t: 0 };

const ptrs = new Map();
const rgt = new THREE.Vector3();
const upv = new THREE.Vector3();
let mode = 'rot';

function pan(dx, dy) {
  rgt.setFromMatrixColumn(cam.matrix, 0);
  upv.setFromMatrixColumn(cam.matrix, 1);
  const k = D * .0016;
  tgt.addScaledVector(rgt, -dx * k).addScaledVector(upv, dy * k);
}

function zoomBy(f, cx, cy) {
  if (view == 'map' && cx != null) {
    const r = cv.getBoundingClientRect();
    mv.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    rc.setFromCamera(mv, cam);
    tgt.lerp(rc.ray.origin.clone().addScaledVector(rc.ray.direction, D), 1 - f);
  }
  D = Math.min(view == 'map' ? mapMax : 160, Math.max(view == 'map' ? .25 : 8, D * f));
}

function hover(e) {
  if (e.pointerType != 'mouse') return;
  const h = pick(e);
  const t = $('tip');

  if (h) {
    t.style.display = 'block';
    t.style.left = e.clientX + 14 + 'px';
    t.style.top = e.clientY + 14 + 'px';
    t.textContent = h.s
      ? h.s.h + ' · ' + (h.s.ly ? fmt(h.s.ly) + ' ışık yılı · ' : '') +
        h.s.p.filter(b => !b.ctx && !b.par).length + ' gezegen' +
        (h.s.best == null ? '' : ' · skor ' + h.s.best)
      : h.b.n + (h.b.score == null ? ' · yetersiz veri' : ' · skor ' + h.b.score);
    cv.style.cursor = 'pointer';
  } else {
    t.style.display = 'none';
    cv.style.cursor = 'default';
  }
}

cv.addEventListener('contextmenu', e => e.preventDefault());

cv.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  flyTo = null;
  mode = (e.button == 2 || e.shiftKey) ? 'pan' : 'rot';
  cv.setPointerCapture(e.pointerId);
});

cv.addEventListener('pointermove', e => {
  const o = ptrs.get(e.pointerId);

  if (!o) {
    hover(e);
    return;
  }

  const dx = e.clientX - o.x;
  const dy = e.clientY - o.y;

  if (ptrs.size == 2) {
    const [p, q] = [...ptrs.values()];
    const d0 = Math.hypot(p.x - q.x, p.y - q.y);
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;

    o.x = e.clientX;
    o.y = e.clientY;

    const d1 = Math.hypot(p.x - q.x, p.y - q.y);
    if (d0 > 0 && d1 > 0) zoomBy(d0 / d1, (p.x + q.x) / 2, (p.y + q.y) / 2);

    pan((p.x + q.x) / 2 - mx, (p.y + q.y) / 2 - my);
    moved += 99;
    return;
  }

  moved += Math.abs(dx) + Math.abs(dy);
  o.x = e.clientX;
  o.y = e.clientY;

  if (mode == 'pan') {
    pan(dx, dy);
  } else {
    th -= dx * .005;
    ph = Math.min(2.9, Math.max(.2, ph - dy * .005));
  }
});

const endPtr = e => {
  const single = ptrs.size == 1;
  ptrs.delete(e.pointerId);

  if (single && moved < 6 && e.type == 'pointerup') {
    const h = pick(e);

    if (view == 'map') {
      if (h) {
        const now = performance.now();
        const dbl = lastMapClick.s === h.s && now - lastMapClick.t < 350;

        showNode(h.s);

        if (dbl) {
          flyTo = h.s.pos.clone();
          flyD = Math.min(D, Math.max(1.2, mr(h.s.ly) * .12));
          lastMapClick = { s: null, t: 0 };
        } else {
          flyTo = null;
          lastMapClick = { s: h.s, t: now };
        }
      } else {
        selNode = null;
        selObj = null;
        sel.visible = false;
        $('panel').style.display = 'none';
      }
    } else {
      showPlanet(h ? h.b : null);
    }
  }
};

cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);

cv.addEventListener('wheel', e => {
  e.preventDefault();
  flyTo = null;
  zoomBy(Math.exp(e.deltaY * .0016), e.clientX, e.clientY);
}, { passive: false });

const rc = new THREE.Raycaster();
const mv = new THREE.Vector2();

function pick(e) {
  const r = cv.getBoundingClientRect();
  mv.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  rc.setFromCamera(mv, cam);

  if (view == 'map') {
    rc.params.Points.threshold = Math.max(.4, D * .012);
    const hs = rc.intersectObjects([ptsA, ptsF, sunHit])
      .map(h => ({
        d: h.distanceToRay == null ? 0 : h.distanceToRay / Math.max(1, h.distance),
        h
      }))
      .sort((a, b) => a.d - b.d);

    if (!hs.length) return null;
    const h = hs[0].h;
    return { s: h.object === sunHit ? SOLAR : h.object.userData.list[h.index] };
  }

  const h = rc.intersectObjects(hitsS)[0];
  return h ? h.object.userData : null;
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  ren.setSize(w, h, false);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}

addEventListener('resize', resize);

document.querySelectorAll('.sc').forEach(b => {
  b.onclick = () => setScope(Math.min(+b.dataset.r, maxLy));
});

resize();
enterMap();

const clock = new THREE.Clock();
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tmp = new THREE.Vector3();
const placed = [];

function layout(labs) {
  placed.length = 0;
  labs.forEach(l => {
    if (l.vis && !l.vis()) l.el.style.display = 'none';
  });

  labs.filter(l => !l.vis || l.vis()).map(l => {
    const v = l.get ? l.get() : l.pos;
    tmp.copy(v).project(cam);
    return {
      l,
      x: (tmp.x + 1) / 2 * innerWidth,
      y: (1 - tmp.y) / 2 * innerHeight,
      z: tmp.z,
      d: cam.position.distanceTo(v),
      p: (l.s && l.s === selNode) || l.s === SOLAR
    };
  }).sort((a, b) => (b.p ? 1 : 0) - (a.p ? 1 : 0) || a.d - b.d)
    .forEach(o => {
      const ok = o.z < 1 && !placed.some(q =>
        Math.abs(q.x - o.x) < 72 && Math.abs(q.y - o.y) < 14
      );

      o.l.el.style.display = ok ? 'block' : 'none';

      if (ok) {
        o.l.el.style.left = o.x + 'px';
        o.l.el.style.top = o.y + 'px';
        placed.push(o);
      }
    });
}

(function loop() {
  const t = still ? 0 : clock.getElapsedTime();

  if (view == 'system') {
    bodies.forEach(o => {
      if (o.par) return;
      const a = o.ph + t * o.w;
      o.m.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
    });

    bodies.forEach(o => {
      if (!o.par) return;
      const a = o.ph + t * o.w;
      const r = size(o.pp.b.R) * 2 + .5 + o.k * .7;
      o.m.position.copy(o.pp.m.position).add(
        new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)
      );
    });
  }

  if (flyTo) {
    tgt.lerp(flyTo, .09);
    D += (flyD - D) * .09;

    if (tgt.distanceTo(flyTo) < D * .002 && Math.abs(D - flyD) < flyD * .01) {
      flyTo = null;
    }
  }

  cam.position.set(
    tgt.x + D * Math.sin(ph) * Math.cos(th),
    tgt.y + D * Math.cos(ph),
    tgt.z + D * Math.sin(ph) * Math.sin(th)
  );

  cam.lookAt(tgt);
  stars.position.copy(cam.position);

  if (selObj) {
    selObj.getWorldPosition(sel.position);
    sel.scale.setScalar(
      view == 'map'
        ? cam.position.distanceTo(sel.position) * .022
        : size(curS.p.find(b => b.o && b.o.m == selObj).R) * 1.6
    );
    sel.lookAt(cam.position);
  }

  if (view == 'map') {
    SOLAR.node.scale.setScalar(cam.position.distanceTo(SOLAR.node.position) * .0045);
  }

  layout(view == 'map' ? mapLabs : sysLabs);
  ren.render(scene, cam);
  requestAnimationFrame(loop);
})();

  })
  .catch(error => {
    console.error("NASA verisi yüklenemedi:", error);
    document.getElementById("hint").textContent =
      "NASA verisi yüklenemedi. Dosya adını ve klasör yolunu kontrol et.";
  });