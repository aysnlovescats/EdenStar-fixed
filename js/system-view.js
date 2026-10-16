const canvas = document.getElementById("space");
const labels = document.getElementById("labels");
const systemSelect = document.getElementById("systemSelect");
const systemOptions = document.getElementById("systemOptions");
const planetList = document.getElementById("planetList");
const details = document.getElementById("planetDetails");
const speedInput = document.getElementById("speed");
const speedText = document.getElementById("speedText");
const dateText = document.getElementById("dateText");
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

let currentSystem = null;
let planetObjects = [];
let clickableObjects = [];
let labelObjects = [];
let systemObjects = [];

let simulatedDays = 0;
let lastFrame = performance.now();

let dragging = false;
let pointerStartX = 0;
let pointerStartY = 0;
let lastX = 0;
let lastY = 0;

let cameraAngle = 0.35;
let cameraElevation = 0.8;
let cameraDistance = 20;

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

function addToSystem(object) {
  scene.add(object);
  systemObjects.push(object);
  return object;
}

function clearSystem() {
  // Gezegenlere bağlı görünmez tıklama kürelerini temizle.
  for (const hitArea of clickableObjects) {
    hitArea.geometry.dispose();
    hitArea.material.dispose();
  }

  // Yıldız, gezegenler, parıltılar ve yörüngeleri temizle.
  for (const object of systemObjects) {
    scene.remove(object);

    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(material => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  }

  // Eski isim etiketlerini kaldır.
  for (const item of labelObjects) {
    item.element.remove();
  }

  systemObjects = [];
  labelObjects = [];
  planetObjects = [];
  clickableObjects = [];
}

function makeStarfield() {
  const positions = [];
  const starCount = 10000;

  for (let i = 0; i < starCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const vertical = Math.random() * 2 - 1;
    const spread = Math.sqrt(1 - vertical * vertical);
    const distance = 140 + Math.random() * 180;

    positions.push(
      Math.cos(angle) * spread * distance,
      vertical * distance,
      Math.sin(angle) * spread * distance
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xc7ddf2,
      size: 0.45,
      sizeAttenuation: true
    })
  );

  scene.add(stars);
}

function starColor(temperature) {
  if (!temperature) return 0xffd574;
  if (temperature < 3800) return 0xff885b;
  if (temperature < 5200) return 0xffc078;
  if (temperature < 6500) return 0xffe4b0;
  return 0xb9d8ff;
}

function planetColor(temperature) {
  if (temperature == null) return 0x9ab2c5;
  if (temperature > 300) return 0xff9a62;
  if (temperature > 50) return 0xffd17a;
  if (temperature > -80) return 0x76b9ff;
  return 0xb8d8ef;
}

function orbitColor(index) {
  const colors = [
    0x3b9ee8,
    0x3b9ee8,
    0x4a9f78,
    0xb47b43
  ];

  return colors[index % colors.length];
}

function visualPlanetSize(radiusKm) {
  if (!radiusKm) return 0.2;

  return Math.max(
    0.16,
    Math.min(
      0.45,
      0.16 + Math.log10(radiusKm / 1000 + 1) * 0.14
    )
  );
}

function makeGlowTexture() {
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 128;
  glowCanvas.height = 128;

  const context = glowCanvas.getContext("2d");
  const gradient = context.createRadialGradient(
    64, 64, 0,
    64, 64, 64
  );

  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.48)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  return new THREE.CanvasTexture(glowCanvas);
}

const glowTexture = makeGlowTexture();

function addLabel(text, object, isStar = false, offset = 0) {
  const element = document.createElement("div");
  element.className = "planet-label";
  element.textContent = text;

  if (isStar) {
    element.style.color = "#ffd574";
  }

  labels.appendChild(element);
  labelObjects.push({
    element: element,
    object: object,
    offset: offset
  });
}

function openSystem(system) {
  clearSystem();

  currentSystem = system;
  simulatedDays = 0;

  document.getElementById("systemName").textContent = system.name;

  if (system.name === "Güneş Sistemi") {
    document.getElementById("systemInfo").textContent =
      "Güneş ve sekiz gezegen · Dünya'ya uzaklık: 0 ışık yılı";
  } else {
    const starTemperature = system.teff
      ? Math.round(system.teff) + " K"
      : "veri yok";
    const systemDistance = system.distanceLy == null
      ? "veri yok"
      : `${system.distanceLy.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ışık yılı`;

    document.getElementById("systemInfo").textContent =
      `Yıldız sıcaklığı: ${starTemperature} · ${system.planets.length} gezegen · Dünya'ya uzaklık: ${systemDistance}`;
  }

  // Merkez yıldız.
  const star = addToSystem(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 32, 32),
      new THREE.MeshBasicMaterial({
        color: starColor(system.teff)
      })
    )
  );

  addLabel(system.name, star, true);

  // Yıldızın parıltısı.
  const glow = addToSystem(
    new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: starColor(system.teff),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
  );

  glow.scale.set(5, 5, 1);

  const knownAu = system.planets.map(p => p.au).filter(a => a != null && a > 0);
  const maxAu = knownAu.length ? Math.max(...knownAu) : 1;
  system.planets.forEach((planet, index) => {
    const au = planet.au != null && planet.au > 0 ? planet.au : maxAu * (0.4 + 0.12 * index);

    // Geniş yörüngeleri ekrana sığdırmak için görsel ölçekte sıkıştırıyoruz.
    const orbitRadius = 1.5 + 8.5 * Math.sqrt(au / maxAu);

    const orbit = addToSystem(
      new THREE.Mesh(
        new THREE.RingGeometry(
          orbitRadius - 0.012,
          orbitRadius + 0.012,
          160
        ),
        new THREE.MeshBasicMaterial({
          color: orbitColor(index),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4
        })
      )
    );

    orbit.rotation.x = Math.PI / 2;

    const planetSize = visualPlanetSize(planet.radius);

    const mesh = addToSystem(
      new THREE.Mesh(
        new THREE.SphereGeometry(planetSize, 24, 24),
        new THREE.MeshStandardMaterial({
          color: planetColor(planet.temperature),
          roughness: 0.9,
          emissive: planetColor(planet.temperature),
          emissiveIntensity: 0.08
        })
      )
    );

    // Büyük, görünmez tıklama alanı gezegene bağlanır.
    // Böylece gezegen hareket etse de tıklama alanı onunla beraber gider.
    const hitArea = new THREE.Mesh(
      new THREE.SphereGeometry(
        Math.max(planetSize * 3, 0.65),
        12,
        12
      ),
      new THREE.MeshBasicMaterial({
        visible: false
      })
    );

    hitArea.userData.planet = planet;
    mesh.add(hitArea);
    clickableObjects.push(hitArea);

    addLabel(
      planet.name,
      mesh,
      false,
      planetSize + 0.12
    );

    const periodDays = planet.periodDays != null && planet.periodDays > 0 ? planet.periodDays : Math.sqrt(Math.pow(au, 3) / (system.starMass > 0 ? system.starMass : 1)) * 365.25;

    planetObjects.push({
      planet: planet,
      mesh: mesh,
      orbit: orbit,
      orbitRadius: orbitRadius,
      periodDays: periodDays,
      phase: index * 1.4
    });
  });

  buildPlanetList(system);

  cameraDistance = 20;
  target.set(0, 0, 0);
  updateCamera();
}

function buildPlanetList(system) {
  planetList.innerHTML = "";

  system.planets.forEach((planet, index) => {
    const row = document.createElement("button");
    row.className = "planet-row";

    const name = document.createElement("span");
    name.textContent = planet.name;

    const sizeClass = document.createElement("small");
    sizeClass.className = "planet-size-class";
    sizeClass.textContent = classifyPlanetSize(planet.radius);
    name.appendChild(sizeClass);

    const distance = document.createElement("span");

    if (planet.au != null && planet.au > 0) {
      distance.textContent = `${planet.au.toFixed(3)} AU`;
    } else {
      distance.textContent = "yörünge verisi yok";
    }

    row.append(name, distance);

    row.addEventListener("click", () => {
      selectPlanet(index);
    });

    planetList.appendChild(row);
  });

  details.textContent =
    "Bir gezegene tıklayarak bilgilerini görebilirsin.";
}

function classifyPlanetSize(radiusKm) {
  if (radiusKm == null || radiusKm <= 0) return "Sınıflandırılamadı";
  const radius = radiusKm / 6371;
  if (radius < .8) return "Küçük gezegen boyutunda";
  if (radius < 1.25) return "Dünya boyutunda";
  if (radius < 2) return "Süper-Dünya boyutunda";
  if (radius < 4) return "Neptün boyutunda";
  return "Büyük gezegen boyutunda";
}

function selectPlanet(index) {
  const planet = currentSystem.planets[index];
  if (!planet) return;

  document.querySelectorAll(".planet-row").forEach((row, rowIndex) => {
    row.classList.toggle("selected", rowIndex === index);
  });

  const radiusText = planet.radius
    ? `${Math.round(planet.radius).toLocaleString("tr-TR")} km`
    : "veri yok";

  const temperatureText = planet.temperature == null
    ? "veri yok"
    : `${planet.temperature.toFixed(1)} °C`;

  const gravityText = planet.gravity == null
    ? "veri yok"
    : `${planet.gravity.toFixed(2)} m/s²`;

  const distanceText = planet.au != null && planet.au > 0
    ? `${planet.au.toFixed(3)} AU`
    : "veri yok (çizimde temsilî yörünge)";

  details.innerHTML =
    `<b>${escapeHtml(planet.name)}</b><br>` +
    `Yarıçap: ${radiusText}<br>` +
    `Sıcaklık: ${temperatureText}<br>` +
    `Yerçekimi: ${gravityText}<br>` +
    `Yıldıza uzaklık: ${distanceText}`;
  showColonyAnalysis(planet);
}
let currentAnalysisResult = null;
let selectedScenarioId = "surface";
let selectedSurfaceOptionId = null;
let analysisRequestId = 0;
let comparisonRequestId = 0;
let comparisonSelection = new Set();
let comparisonOpen = false;

function renderDataSources(scenarioId) {
  const sources = currentAnalysisResult?.data_sources?.[scenarioId] || [];
  if (!sources.length) return "";
  const cards = sources.map(source => {
    const type = source.kind === "model" ? "Model" : source.kind === "study" ? "Araştırma / konsept" : "Veri seti";
    const measurement = source.measurement
      ? `<small class="dataset-measurement">${escapeHtml(source.measurement.name)}: ${Number(source.measurement.value).toLocaleString("tr-TR")} ${escapeHtml(source.measurement.unit)} · ${escapeHtml(source.measurement.location)}</small>`
      : "";
    return `<article class="dataset-card">
      <div class="dataset-card-heading"><strong>${escapeHtml(source.label)}</strong><span>${type}</span></div>
      <p>${escapeHtml(source.summary)}</p>
      ${measurement}
      <small>${escapeHtml(source.scope)}</small>
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">NASA veri kaynağını aç ↗</a>
    </article>`;
  }).join("");
  return `<section class="dataset-sources"><h4>Bu senaryo için ek NASA kaynakları</h4><p>Kaynaklar puana otomatik eklenmez; konum ve ölçüm kapsamı ayrıca gösterilir.</p>${cards}</section>`;
}

function renderScenarioGuidance(scenario, surfaceOptionId = null, includeMissing = true) {
  const guidance = scenario.guidance || { requirements: [], watchouts: [], surface_options: {} };
  const requirements = scenario.id === "surface" && surfaceOptionId
    ? guidance.surface_options?.[surfaceOptionId] || guidance.requirements
    : guidance.requirements;
  const missing = includeMissing ? scenario.indicators.filter(item => !item.available).map(item => item.name) : [];
  const watchouts = [...(guidance.watchouts || [])];
  if (missing.length) watchouts.unshift(`Bu senaryoda ölçümü eksik ölçütler: ${missing.join(", ")}.`);
  return `<section class="scenario-guidance">
    <h4>Senaryo ihtiyaçları ve dikkat noktaları</h4>
    <div class="scenario-guidance-grid">
      <div><span class="guidance-title">Gerekenler / doğrulanacaklar</span><ul>${requirements.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div><span class="guidance-title">Bu analizdeki belirsizlikler</span><ul>${watchouts.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
    </div>
    <p class="comparison-guidance-note">Bu liste görev tasarımı kontrol listesidir; hazır teknoloji bulunduğunu veya tüm ihtiyaçların ölçüldüğünü göstermez.</p>
  </section>`;
}

function dataStatusLabel(kind) {
  return ({ archive: "Arşiv", project: "Proje verisi", derived: "Türetilmiş", estimated: "Tahmin", unknown: "Veri yok" })[kind] || "Veri yok";
}

function renderPhlComparisonDetail() {
  const phl = currentAnalysisResult?.phl_comparison;
  if (!phl) return "";
  if (phl.not_applicable) return `<section class="phl-detail"><span class="eyebrow">PHL İLE KARŞILAŞTIRMA</span><p>${escapeHtml(phl.message)}</p></section>`;
  if (!phl.available) return `<section class="phl-detail"><span class="eyebrow">PHL İLE KARŞILAŞTIRMA</span><p>${escapeHtml(phl.message || "PHL verisi kullanılamıyor.")} PHL aday durumu ve ESI için PHL HWC CSV dosyası projeye <code>data/hwc.csv</code> adıyla eklenmeli.</p><a href="${escapeHtml(phl.source_url || "https://phl.upr.edu/hwc/data")}" target="_blank" rel="noopener noreferrer">PHL veri sayfası ↗</a></section>`;
  const esi = phl.esi == null ? "Veri yok" : Number(phl.esi).toLocaleString("tr-TR", { maximumFractionDigits: 3 });
  const zoneLabel = value => value == null ? "Veri yok" : Number(value) > 0 ? "Evet" : "Hayır";
  return `<section class="phl-detail"><span class="eyebrow">PHL İLE KARŞILAŞTIRMA</span><div class="phl-detail-grid"><div><small>PHL aday durumu</small><strong>${escapeHtml(phl.status || "Etiket yok")}</strong></div><div><small>Dünya Benzerlik İndeksi (ESI)</small><strong>${esi}</strong></div><div><small>Konservatif yaşanabilir bölge</small><strong>${zoneLabel(phl.conservative_zone)}</strong></div><div><small>İyimser yaşanabilir bölge</small><strong>${zoneLabel(phl.optimistic_zone)}</strong></div>${phl.planet_type ? `<div><small>PHL gezegen sınıfı</small><strong>${escapeHtml(phl.planet_type)}</strong></div>` : ""}</div><p>${escapeHtml(phl.caveat || "PHL etiketi yaşam kanıtı değildir.")} ESI, proje koloni senaryosu puanıyla aynı ölçekte değildir.</p><a href="${escapeHtml(phl.source_url || "https://phl.upr.edu/hwc/data")}" target="_blank" rel="noopener noreferrer">PHL veri kaynağı ↗</a></section>`;
}

function renderScenarioDetails(scenario) {
  const scoreText = scenario.score == null ? "Skor hesaplanamıyor" : `${scenario.score}/100`;
  const indicatorRows = scenario.indicators.map(item => `
    <div class="scenario-criterion">
      <span>${escapeHtml(item.name)} <small>(ağırlık %${item.weight})</small><i class="criterion-status ${escapeHtml(item.data_kind || "unknown")}">${dataStatusLabel(item.data_kind)}</i></span>
      <b>${item.score == null ? "Veri yok" : item.score + "/100"}</b>
      <small>${item.value == null ? "" : `${Number(item.value).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${escapeHtml(item.unit)}`}</small>
      <div class="criterion-explanation"><span>${escapeHtml(item.data_status || "Bu ölçüt için veri yok")}</span><span>${item.contribution == null ? "Puana katkısı yok" : `Toplam puana katkısı ${Number(item.contribution).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} puan`} · ${escapeHtml(item.scoring_rule || "")}</span></div>
    </div>`).join("");
  const criticalRows = (scenario.critical_checks || []).map(item => {
    const statusLabel = item.status === "risk" ? "Dome yükünü artırır" : item.status === "unknown" ? "Bilinmiyor" : "Aralık içinde";
    const valueLabel = item.value == null
      ? item.summary
      : item.unit
        ? `${Number(item.value).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${escapeHtml(item.unit)} · ${item.summary}`
        : item.summary;
    return `<div class="critical-check ${item.status}"><strong>${escapeHtml(item.name)}</strong><b>${statusLabel}</b><small>${escapeHtml(valueLabel)}</small></div>`;
  }).join("");
  return `
    <section class="scenario-result">
      <div class="scenario-heading"><h3>${escapeHtml(scenario.name)}</h3><span class="scenario-score-block"><strong>${scoreText}</strong>${scenario.score_max > scenario.score ? `<small>Eksik ölçütler tam puan alsaydı teorik aralık: ${scenario.score}–${scenario.score_max}/100</small>` : ""}</span></div>
      <p class="scenario-description">${escapeHtml(scenario.description)}</p>
      <div class="scenario-meta">Puan ölçütlerinin kapsamı %${scenario.coverage} · Güven: ${escapeHtml(scenario.confidence)}</div>
      <p class="scenario-meta">${escapeHtml(scenario.status)}</p>
      <p class="scenario-meta">Toplam skor, tüm ölçüt ağırlıklarının toplamı üzerinden hesaplanır. Eksik ölçütler puan katkısı sağlamaz ve veri kapsamını düşürür.</p>
      ${scenario.scope_note ? `<p class="scenario-meta">${escapeHtml(scenario.scope_note)}</p>` : ""}
      <div class="scenario-criteria">${indicatorRows}</div>
      ${criticalRows ? `<div class="critical-checks"><strong>Kubbe ve yaşam destek koşulları</strong>${criticalRows}<small class="guardrail-note">Zorlu koşullar puanı otomatik olarak 0 yapmaz; ek sistem ihtiyacı olarak değerlendirilir. Aralıklar proje varsayımlarıdır.</small></div>` : ""}
    </section>
    ${renderScenarioGuidance(scenario)}
    ${renderDataSources(scenario.id)}
    <div class="analysis-check"><strong>Veri kaynağı</strong><span>${escapeHtml(currentAnalysisResult.source)}</span></div>
    <div class="analysis-check"><strong>Tahminler</strong><span>${escapeHtml(currentAnalysisResult.estimated.join("; ") || "Tahmini değer kullanılmadı")}</span></div>
    <p class="analysis-note">${escapeHtml(currentAnalysisResult.note)}</p>`;
}

function renderSurfaceOptionDetail(option, scenario) {
  if (option.id === "dome") return renderScenarioDetails(scenario);
  const checks = (option.checks || []).map(item => {
    const state = item.status === "risk" ? "Uygun değil" : item.status === "unknown" ? "Bilinmiyor" : "Aralık içinde";
    const displayValue = typeof item.value === "number"
      ? `${item.value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${escapeHtml(item.unit)}`
      : item.value == null ? "" : escapeHtml(item.value);
    const value = item.value == null
      ? item.summary
      : `${displayValue}${displayValue ? " · " : ""}${item.summary}`;
    return `<div class="critical-check ${item.status}"><strong>${escapeHtml(item.name)}</strong><b>${state}</b><small>${escapeHtml(value)}</small></div>`;
  }).join("");
  const missing = option.missing_data?.length
    ? `<div class="analysis-check"><strong>Gerekli ek veriler</strong><span>${option.missing_data.map(escapeHtml).join(" · ")}</span></div>`
    : "";
  return `
    <section class="scenario-result">
      <div class="scenario-heading"><h3>${escapeHtml(option.name)}</h3><strong>${escapeHtml(option.status)}</strong></div>
      <p class="scenario-description">${escapeHtml(option.summary)}</p>
      ${checks ? `<div class="critical-checks">${checks}<small class="guardrail-note">Bu aralıklar temel ön eleme varsayımlarıdır; tek başına yaşanabilirlik kanıtı değildir.</small></div>` : ""}
      ${missing}
    </section>
    ${renderScenarioGuidance(scenario, option.id)}
    ${renderDataSources("surface")}
    <p class="analysis-note">${escapeHtml(currentAnalysisResult.note)}</p>`;
}

function renderSelectedScenario() {
  if (!currentAnalysisResult) return;
  const comparisonPanel = document.getElementById("comparisonPanel");
  const checks = document.getElementById("colonyChecks");
  const surfaceModes = document.getElementById("surfaceModes");
  const surfaceModeDetail = document.getElementById("surfaceModeDetail");
  const surfaceModeChoices = document.getElementById("surfaceModeChoices");
  const surfaceModeContent = document.getElementById("surfaceModeContent");
  if (comparisonOpen) {
    comparisonPanel.hidden = false;
    surfaceModes.hidden = true;
    surfaceModeDetail.hidden = true;
    checks.hidden = true;
    return;
  }
  comparisonPanel.hidden = true;
  const isSurface = selectedScenarioId === "surface";
  const scenario = currentAnalysisResult.scenarios.find(item => item.id === selectedScenarioId);

  document.querySelectorAll("#scenarioTabs button").forEach(button => {
    const active = button.dataset.scenario === selectedScenarioId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  surfaceModes.hidden = !isSurface || Boolean(selectedSurfaceOptionId);
  surfaceModeDetail.hidden = !isSurface || !selectedSurfaceOptionId;
  checks.hidden = isSurface;

  if (isSurface) {
    if (!selectedSurfaceOptionId) {
      surfaceModeChoices.innerHTML = (currentAnalysisResult.surface_options || []).map(option => `
        <button class="scenario-choice" type="button" data-surface-option="${escapeHtml(option.id)}">
          <span><strong>${escapeHtml(option.name)}</strong><small>${escapeHtml(option.summary)}</small></span>
          <b>${option.score == null ? escapeHtml(option.status) : `${option.score}/100`}</b>
          <em>Ayrıntıları aç →</em>
        </button>`).join("");
    } else {
      const option = currentAnalysisResult.surface_options?.find(item => item.id === selectedSurfaceOptionId);
      if (option) surfaceModeContent.innerHTML = renderSurfaceOptionDetail(option, scenario);
    }
    return;
  }

  if (scenario) checks.innerHTML = renderScenarioDetails(scenario);
}

function renderComparisonChoices() {
  const container = document.getElementById("comparisonPlanetChoices");
  container.innerHTML = currentSystem.planets.map(planet => {
    const checked = comparisonSelection.has(planet.name);
    const disable = !checked && comparisonSelection.size >= 3;
    return `<label class="comparison-planet-choice"><input type="checkbox" data-compare-planet value="${escapeHtml(planet.name)}" ${checked ? "checked" : ""} ${disable ? "disabled" : ""}><span>${escapeHtml(planet.name)}</span></label>`;
  }).join("");
  document.getElementById("runComparison").disabled = comparisonSelection.size < 2;
}

function renderComparisonCard(planetName, result, scenarioId) {
  const scenario = result.scenarios.find(item => item.id === scenarioId);
  if (!scenario) return `<article class="comparison-card"><h4>${escapeHtml(planetName)}</h4><p>Bu senaryo için analiz yok.</p></article>`;
  const score = scenario.score == null ? "Skor hesaplanamıyor" : `${scenario.score}/100`;
  const rows = scenario.indicators.map(item => {
    const value = item.value == null
      ? "Veri yok"
      : `${Number(item.value).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${item.unit}`;
    const contribution = item.contribution == null
      ? "Puan katkısı yok"
      : `Toplam puana +${Number(item.contribution).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
    return `<div class="comparison-criterion">
      <div class="comparison-criterion-top"><span>${escapeHtml(item.name)} · %${item.weight}</span><b>${item.score == null ? "Veri yok" : `${item.score}/100`}</b></div>
      <small>${escapeHtml(value)} · ${escapeHtml(item.data_status || "Veri durumu belirtilmedi")}</small>
      <small>${escapeHtml(contribution)}</small>
    </div>`;
  }).join("");
  return `<article class="comparison-card">
    <header><h4>${escapeHtml(planetName)}</h4><span class="comparison-score">${score}<small>Kapsam %${scenario.coverage}</small>${scenario.score_max > scenario.score ? `<small class="score-range-note">Eksik ölçütler tam puan alsaydı teorik aralık: ${scenario.score}–${scenario.score_max}/100</small>` : ""}</span></header>
    ${rows}
    <p class="comparison-guidance-note">${escapeHtml(scenario.status)}</p>
    ${scenario.scope_note ? `<p class="comparison-guidance-note">${escapeHtml(scenario.scope_note)}</p>` : ""}
  </article>`;
}

async function runPlanetComparison() {
  const resultsContainer = document.getElementById("comparisonResults");
  const runButton = document.getElementById("runComparison");
  if (comparisonSelection.size < 2 || !currentSystem) return;
  const requestId = ++comparisonRequestId;
  const scenarioId = document.getElementById("comparisonScenario").value;
  const planets = currentSystem.planets.filter(planet => comparisonSelection.has(planet.name));
  runButton.disabled = true;
  resultsContainer.innerHTML = '<p class="analysis-note">Seçilen gezegenler için aynı senaryo hesaplanıyor…</p>';

  try {
    const results = await Promise.all(planets.map(async planet => {
      const params = new URLSearchParams({
        host: currentSystem.name,
        planet: planet.name,
        radius: planet.radius ?? "",
        temperature: planet.temperature ?? "",
        gravity: planet.gravity ?? "",
        au: planet.au ?? ""
      });
      const response = await fetch(`/api/analyze?${params}`);
      const result = await response.json();
      if (!response.ok) throw new Error(`${planet.name}: ${result.error || "Analiz alınamadı."}`);
      return { planet, result };
    }));
    if (requestId !== comparisonRequestId) return;
    const referenceScenario = results[0]?.result.scenarios.find(item => item.id === scenarioId);
    const guidance = referenceScenario ? renderScenarioGuidance(referenceScenario, null, false) : "";
    resultsContainer.innerHTML = `${guidance}<div class="comparison-results">${results.map(item => renderComparisonCard(item.planet.name, item.result, scenarioId)).join("")}</div>`;
  } catch (error) {
    if (requestId !== comparisonRequestId) return;
    resultsContainer.innerHTML = `<p class="analysis-note">Karşılaştırma yapılamadı: ${escapeHtml(error.message)}</p>`;
  } finally {
    if (requestId === comparisonRequestId) {
      runButton.disabled = comparisonSelection.size < 2;
    }
  }
}

async function showColonyAnalysis(planet) {
  const requestId = ++analysisRequestId;
  const card = document.getElementById("colonyCard");
  const title = document.getElementById("colonyPlanetName");
  const checks = document.getElementById("colonyChecks");

  card.hidden = false;
  currentAnalysisResult = null;
  comparisonOpen = false;
  comparisonSelection = new Set([planet.name]);
  document.getElementById("toggleComparison").setAttribute("aria-expanded", "false");
  document.getElementById("comparisonResults").innerHTML = "";
  renderComparisonChoices();
  selectedScenarioId = "surface";
  selectedSurfaceOptionId = null;
  title.textContent = planet.name;
  const visual = document.getElementById("planetVisual");
  const solarBody = {
    "merkür": "mercury", "venüs": "venus", "dünya": "earth", "mars": "mars", "ay": "moon",
    "jüpiter": "jupiter", "satürn": "saturn", "uranüs": "uranus", "neptün": "neptune",
    "europa": "europa", "titan": "titan", "enceladus": "enceladus"
  };
  const normalizedPlanetName = planet.name.toLocaleLowerCase("tr-TR");
  const photo = document.getElementById("planetPhoto");
  const imageCredit = document.getElementById("planetImageCredit");
  const visualLabel = document.getElementById("planetVisualLabel");
  photo.hidden = true;
  photo.removeAttribute("src");
  delete photo.dataset.assetFile;
  imageCredit.hidden = true;
  visual.classList.remove("has-photo");
  if (currentSystem.name === "Güneş Sistemi") {
    visual.style.removeProperty("--exoplanet-hue");
    visual.dataset.body = solarBody[normalizedPlanetName] || "default";
    const imageSource = solarImageSources[visual.dataset.body];
    visualLabel.textContent = imageSource ? "NASA GÖRSELİ" : "ŞEMATİK GÖRSEL";
    if (imageSource) {
      photo.dataset.assetFile = imageSource.file;
      photo.alt = `${planet.name} — ${imageSource.credit}`;
      photo.onload = () => {
        if (photo.dataset.assetFile !== imageSource.file) return;
        photo.hidden = false;
        visual.classList.add("has-photo");
      };
      photo.onerror = () => {
        if (photo.dataset.assetFile !== imageSource.file) return;
        photo.hidden = true;
        visual.classList.remove("has-photo");
        visualLabel.textContent = "ŞEMATİK GÖRSEL";
      };
      photo.src = `../assets/planets/${imageSource.file}`;
      imageCredit.href = imageSource.url;
      imageCredit.textContent = `${imageSource.credit} · kaynak ↗`;
      imageCredit.hidden = false;
    }
  } else {
    delete photo.dataset.assetFile;
    let nameHash = 0;
    for (const character of normalizedPlanetName) nameHash = (nameHash * 31 + character.codePointAt(0)) | 0;
    visual.dataset.body = `exoplanet-${Math.abs(nameHash) % 8}`;
    visual.style.setProperty("--exoplanet-hue", `${Math.abs(nameHash) % 360}deg`);
    visualLabel.textContent = "ŞEMATİK GÖRSEL · FOTOĞRAF YOK";
  }
  checks.textContent = "Python analizi yükleniyor…";
  document.getElementById("planetPhlComparison").innerHTML = '<section class="phl-detail"><span class="eyebrow">PHL İLE KARŞILAŞTIRMA</span><p>PHL bilgisi yükleniyor…</p></section>';
  document.getElementById("surfaceModes").hidden = false;
  document.getElementById("surfaceModeDetail").hidden = true;
  document.getElementById("surfaceModeChoices").innerHTML = '<p class="analysis-note">Yüzey seçenekleri yükleniyor…</p>';
  checks.hidden = true;
  const classInfo = document.getElementById("planetClassInfo");
  const accessInfo = document.getElementById("planetAccessInfo");
  classInfo.textContent = "Boyut sınıfı hesaplanıyor…";
  classInfo.classList.remove("uncertain");
  accessInfo.textContent = "Dünya'ya sistem uzaklığı yükleniyor…";

  const params = new URLSearchParams({
    host: currentSystem.name,
    planet: planet.name,
    radius: planet.radius ?? "",
    temperature: planet.temperature ?? "",
    gravity: planet.gravity ?? "",
    au: planet.au ?? ""
  });

  try {
    const response = await fetch(`/api/analyze?${params}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Analiz alınamadı.");
    }
    if (requestId !== analysisRequestId) return;

    currentAnalysisResult = result;

    const classInfo = document.getElementById("planetClassInfo");
    classInfo.textContent = `${result.planet_class.label} — ${result.planet_class.reason}`;
    classInfo.classList.toggle("uncertain", result.planet_class.kind === "unknown");
    const accessInfo = document.getElementById("planetAccessInfo");
    accessInfo.textContent = result.metrics.access == null
      ? "Dünya'ya sistem uzaklığı: ölçüm yok"
      : `Dünya'ya sistem uzaklığı: ${Number(result.metrics.access).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ışık yılı`;
    document.getElementById("planetPhlComparison").innerHTML = renderPhlComparisonDetail();

    renderSelectedScenario();

  } catch (error) {
    if (requestId !== analysisRequestId) return;
    classInfo.textContent = "Sınıflandırma alınamadı.";
    accessInfo.textContent = "Dünya'ya sistem uzaklığı alınamadı.";
    document.getElementById("surfaceModeChoices").innerHTML = `<p class="analysis-note">Analiz alınamadı: ${escapeHtml(error.message)}</p>`;
    checks.textContent = `Analiz alınamadı: ${error.message}`;
  }
}

document.getElementById("closeColonyCard").addEventListener("click", () => {
  document.getElementById("colonyCard").hidden = true;
});

document.getElementById("scenarioTabs").addEventListener("click", event => {
  const button = event.target.closest("button[data-scenario]");
  if (!button) return;
  selectedScenarioId = button.dataset.scenario;
  selectedSurfaceOptionId = null;
  comparisonOpen = false;
  document.getElementById("toggleComparison").setAttribute("aria-expanded", "false");
  renderSelectedScenario();
});

document.getElementById("toggleComparison").addEventListener("click", () => {
  comparisonOpen = !comparisonOpen;
  document.getElementById("toggleComparison").setAttribute("aria-expanded", String(comparisonOpen));
  if (comparisonOpen) renderComparisonChoices();
  renderSelectedScenario();
});

document.getElementById("comparisonPlanetChoices").addEventListener("change", event => {
  const checkbox = event.target.closest("input[data-compare-planet]");
  if (!checkbox) return;
  if (checkbox.checked && comparisonSelection.size < 3) comparisonSelection.add(checkbox.value);
  else comparisonSelection.delete(checkbox.value);
  document.getElementById("comparisonResults").innerHTML = "";
  renderComparisonChoices();
});

document.getElementById("runComparison").addEventListener("click", runPlanetComparison);
document.getElementById("comparisonScenario").addEventListener("change", () => {
  document.getElementById("comparisonResults").innerHTML = "";
});

document.getElementById("surfaceModeChoices").addEventListener("click", event => {
  const button = event.target.closest("button[data-surface-option]");
  if (!button) return;
  selectedSurfaceOptionId = button.dataset.surfaceOption;
  renderSelectedScenario();
});

document.getElementById("surfaceModesBack").addEventListener("click", () => {
  selectedSurfaceOptionId = null;
  renderSelectedScenario();
});

function updateCamera() {
  camera.position.set(
    target.x + cameraDistance * Math.sin(cameraElevation) * Math.sin(cameraAngle),
    target.y + cameraDistance * Math.cos(cameraElevation),
    target.z + cameraDistance * Math.sin(cameraElevation) * Math.cos(cameraAngle)
  );

  camera.lookAt(target);
}

function updateLabels() {
  for (const item of labelObjects) {
    const position = item.object.position.clone();
    position.y += item.offset;
    position.project(camera);

    const x = (position.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-position.y * 0.5 + 0.5) * window.innerHeight;

    const visible =
      position.z < 1 &&
      x > 0 &&
      x < window.innerWidth &&
      y > 0 &&
      y < window.innerHeight;

    item.element.style.display = visible ? "block" : "none";
    item.element.style.left = `${x}px`;
    item.element.style.top = `${y}px`;
  }
}

function animate(now) {
  requestAnimationFrame(animate);

  const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  const speed = Number(speedInput.value);
  simulatedDays += deltaSeconds * speed;

  for (const object of planetObjects) {
    const currentAngle =
      object.phase +
      (simulatedDays / object.periodDays) * Math.PI * 2;

    object.mesh.position.set(
      Math.cos(currentAngle) * object.orbitRadius,
      0,
      Math.sin(currentAngle) * object.orbitRadius
    );
  }

  const simulatedDate = new Date(
    Date.now() + simulatedDays * 86400000
  );

  dateText.textContent = simulatedDate.toLocaleString("tr-TR");

  updateCamera();
  updateLabels();
  renderer.render(scene, camera);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function loadSystems(SYSARR) {
  const exoplanetSystems = SYSARR.map(row => ({
    name: row[0],
    distanceLy: row[3],
    teff: row[4],
    starMass: row[8],
    planets: row[7].map(planet => ({
      name: planet[0],
      radius: planet[1],
      gravity: planet[2],
      temperature: planet[3],
      au: planet[4],
      periodDays: planet[6],
      insolation: planet[7]
    }))
  }));

  // 50 ile sınırlama yok: CSV'den gelen tüm sistemler eklenir.
  const allSystems = [solarSystem, ...exoplanetSystems];
  const query = new URLSearchParams(window.location.search);

  const requestedHost = query.get("host");
  const requestedPlanet = query.get("planet");

  systemOptions.innerHTML = "";
  allSystems.forEach(system => { const option = document.createElement("option"); option.value = system.name; systemOptions.appendChild(option); });

  let selectedIndex = 0;

  if (requestedHost) {
    const foundIndex = allSystems.findIndex(
      system => system.name === requestedHost
    );

    if (foundIndex >= 0) {
      selectedIndex = foundIndex;
    }
  }

  systemSelect.value = allSystems[selectedIndex].name;
  openSystem(allSystems[selectedIndex]);
  systemSelect.addEventListener("change", () => { const found = allSystems.find(item => item.name === systemSelect.value.trim()); if (found) openSystem(found); });

  if (requestedPlanet) {
    const planetIndex = allSystems[selectedIndex].planets.findIndex(
      planet => planet.name === requestedPlanet
    );

    if (planetIndex >= 0) {
      selectPlanet(planetIndex);
    }
  }
}

function updateSpeedLabel() {
  speedText.textContent = `${speedInput.value}×`;
}

speedInput.addEventListener("input", updateSpeedLabel);
updateSpeedLabel();

canvas.addEventListener("pointerdown", event => {
  dragging = true;

  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  lastX = event.clientX;
  lastY = event.clientY;

  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", event => {
  if (!dragging) return;

  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;

  lastX = event.clientX;
  lastY = event.clientY;

  cameraAngle -= dx * 0.006;

  cameraElevation = Math.max(
    0.18,
    Math.min(1.45, cameraElevation + dy * 0.004)
  );
});

canvas.addEventListener("pointerup", event => {
  dragging = false;

  // Sürükleme hareketiyse gezegen seçme.
  const movement = Math.hypot(
    event.clientX - pointerStartX,
    event.clientY - pointerStartY
  );

  if (movement > 6) return;

  const rect = canvas.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Gezegenin güncel konumunu raycast öncesi güncelle.
  scene.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, camera);

  const hit = raycaster.intersectObjects(clickableObjects, false)[0];
  if (!hit) return;

  const clickedPlanet = hit.object.userData.planet;

  const index = currentSystem.planets.findIndex(
    planet => planet.name === clickedPlanet.name
  );

  if (index >= 0) {
    selectPlanet(index);
  }
});

canvas.addEventListener("pointercancel", () => {
  dragging = false;
});

canvas.addEventListener("wheel", event => {
  event.preventDefault();

  cameraDistance *= event.deltaY > 0 ? 1.08 : 0.92;
  cameraDistance = Math.max(8, Math.min(65, cameraDistance));
}, { passive: false });

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

makeStarfield();

window.loadPlanetSystems()
  .then(loadSystems)
  .then(() => {
    requestAnimationFrame(animate);
  })
  .catch(error => {
    console.error("Sistem verisi yüklenemedi:", error);

    document.getElementById("systemInfo").textContent =
      "NASA verisi yüklenemedi. CSV dosya yolunu kontrol et.";
  });
