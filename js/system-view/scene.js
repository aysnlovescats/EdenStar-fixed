// Three.js sahnesi, DOM referansları ve Güneş Sistemi verisi.

// Varsayımsal model aralığını metne çevirir (ör. '45–89/100').
const modelRangeText = model => model?.score_min == null
  ? "hesaplanamıyor"
  : model.score_max > model.score_min ? `${model.score_min}–${model.score_max}/100` : `${model.score_min}/100`;
// Puan bir aralıksa 'bilinmeyen ölçütlerle olası aralık' notunu üretir.
const scoreRangeNote = item => item?.score_min != null && item.score_max > item.score_min
  ? `Bilinmeyen ölçütlerle olası aralık: ${item.score_min}–${item.score_max}/100`
  : "";
// Sayfadaki HTML elemanlarına erişim.
const canvas = document.getElementById("space");
const labels = document.getElementById("labels");
const systemSelect = document.getElementById("systemSelect");
const systemOptions = document.getElementById("systemOptions");
const planetList = document.getElementById("planetList");
const details = document.getElementById("planetDetails");
const speedInput = document.getElementById("speed");
const speedText = document.getElementById("speedText");
const dateText = document.getElementById("dateText");
// Güneş Sistemi cisimleri için NASA görselleri (analiz kartında gösterilir).
const solarImageSources = {
  mercury: { file: "mercury.jpg", credit: "NASA / MESSENGER", url: "https://science.nasa.gov/photojournal/full-global-mercury-mosaic/" },
  venus: { file: "venus.jpg", credit: "NASA / JPL-Caltech · Mariner 10", url: "https://science.nasa.gov/photojournal/venus-from-mariner-10/" },
  earth: { file: "earth.jpg", credit: "NASA · Suomi NPP", url: "https://science.nasa.gov/photojournal/earth/" },
  mars: { file: "mars.jpg", credit: "NASA / JPL / USGS · Viking Orbiter", url: "https://science.nasa.gov/photojournal/global-color-views-of-mars/" },
  jupiter: { file: "jupiter.jpg", credit: "NASA / JPL · Voyager 1", url: "https://science.nasa.gov/photojournal/jupiter-full-disk-with-great-red-spot/" },
  saturn: { file: "saturn.jpg", credit: "NASA / JPL / USGS · Voyager 1", url: "https://science.nasa.gov/photojournal/full-disk-color-image-of-crescent-saturn-with-rings-and-ring-shadows/" },
  uranus: { file: "uranus.jpg", credit: "NASA / JPL · Voyager 2", url: "https://science.nasa.gov/photojournal/uranus/" },
  neptune: { file: "neptune.jpg", credit: "NASA / JPL · Voyager 2", url: "https://science.nasa.gov/photojournal/neptune-full-disk-view/" },
  moon: { file: "moon.jpg", credit: "NASA / LRO", url: "https://science.nasa.gov/photojournal/nearside-spectacular/" },
  europa: { file: "europa.jpg", credit: "NASA / JPL · Voyager 1", url: "https://science.nasa.gov/photojournal/europa-full-disk/" },
  titan: { file: "titan.jpg", credit: "NASA / JPL · Voyager 2", url: "https://science.nasa.gov/photojournal/titan/" },
  enceladus: { file: "enceladus.jpg", credit: "NASA / JPL / Space Science Institute · Cassini", url: "https://science.nasa.gov/photojournal/enceladus-leading-hemisphere/" }
};

// Three.js sahnesi, kamera, çizici ve ışık kurulumu.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x00040a);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 14, 20);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const target = new THREE.Vector3();

// Açık sistem ve sahnedeki nesnelerin listeleri (temizlemek ve tıklamak için).
let currentSystem = null;
let planetObjects = [];
let clickableObjects = [];
let labelObjects = [];
let systemObjects = [];

// Simülasyon zamanı: kaç gün geçtiği; zaman hızı kaydırıcısıyla ilerler.
let simulatedDays = 0;
let lastFrame = performance.now();

// Fareyle sürükleme durumu.
let dragging = false;
let pointerStartX = 0;
let pointerStartY = 0;
let lastX = 0;
let lastY = 0;

// Kamera açıları ve uzaklığı (küresel koordinatlar).
let cameraAngle = 0.35;
let cameraElevation = 0.8;
let cameraDistance = 20;

// Güneş Sistemi verisi (yarıçap km, sıcaklık °C, yerçekimi m/s², au: Güneş'e uzaklık).
const solarSystem = {
  name: "Güneş Sistemi",
  distanceLy: 0,
  teff: 5772,
  planets: [
    {
      name: "Merkür",
      radius: 2440,
      temperature: 167,
      gravity: 3.7,
      au: 0.387
    },
    {
      name: "Venüs",
      radius: 6052,
      temperature: 464,
      gravity: 8.87,
      au: 0.723
    },
    {
      name: "Dünya",
      radius: 6371,
      temperature: 15,
      gravity: 9.81,
      au: 1
    },
    {
      name: "Mars",
      radius: 3390,
      temperature: -63,
      gravity: 3.71,
      au: 1.524
    },
    {
      name: "Jüpiter",
      radius: 69911,
      temperature: -110,
      gravity: 24.79,
      au: 5.2
    },
    {
      name: "Satürn",
      radius: 58232,
      temperature: -140,
      gravity: 10.44,
      au: 9.58
    },
    {
      name: "Uranüs",
      radius: 25362,
      temperature: -195,
      gravity: 8.69,
      au: 19.2
    },
    {
      name: "Neptün",
      radius: 24622,
      temperature: -200,
      gravity: 11.15,
      au: 30.05
    }
  ]
};
