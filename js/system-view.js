const canvas = document.getElementById("space");
const labels = document.getElementById("labels");
const systemSelect = document.getElementById("systemSelect");
const systemOptions = document.getElementById("systemOptions");
const planetList = document.getElementById("planetList");
const details = document.getElementById("planetDetails");
const speedInput = document.getElementById("speed");
const speedText = document.getElementById("speedText");
const dateText = document.getElementById("dateText");

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
      "Güneş ve sekiz gezegen";
  } else {
    const starTemperature = system.teff
      ? Math.round(system.teff) + " K"
      : "veri yok";

    document.getElementById("systemInfo").textContent =
      `Yıldız sıcaklığı: ${starTemperature} · ${system.planets.length} gezegen`;
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

function renderSelectedScenario() {
  if (!currentAnalysisResult) return;
  const checks = document.getElementById("colonyChecks");
  const scenario = currentAnalysisResult.scenarios.find(item => item.id === selectedScenarioId);
  if (!scenario) return;
  const scoreText = scenario.score == null ? "Skor hesaplanamadı" : `${scenario.score}/100`;
  const indicatorRows = scenario.indicators.map(item => `
    <div class="scenario-criterion">
      <span>${escapeHtml(item.name)} <small>(ağırlık %${item.weight})</small></span>
      <b>${item.score == null ? "Veri yok" : item.score + "/100"}</b>
      <small>${item.value == null ? "" : `${Number(item.value).toFixed(2)} ${escapeHtml(item.unit)}`}</small>
    </div>`).join("");
  checks.innerHTML = `
    <section class="scenario-result">
      <div class="scenario-heading"><h3>${escapeHtml(scenario.name)}</h3><strong>${scoreText}</strong></div>
      <p class="scenario-description">${escapeHtml(scenario.description)}</p>
      <div class="scenario-meta">Veri kapsamı %${scenario.coverage} · Veri güveni: ${escapeHtml(scenario.confidence)}</div>
      <p class="scenario-meta">${escapeHtml(scenario.status)}</p>
      <div class="scenario-criteria">${indicatorRows}</div>
    </section>
    <div class="analysis-check"><strong>Veri kaynağı</strong><span>${escapeHtml(currentAnalysisResult.source)}</span></div>
    <div class="analysis-check"><strong>Tahminler</strong><span>${escapeHtml(currentAnalysisResult.estimated.join("; ") || "Tahmini değer kullanılmadı")}</span></div>
    <p class="analysis-note">${escapeHtml(currentAnalysisResult.note)}</p>`;

  document.querySelectorAll("#scenarioTabs button").forEach(button => {
    const active = button.dataset.scenario === selectedScenarioId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

async function showColonyAnalysis(planet) {
  const card = document.getElementById("colonyCard");
  const title = document.getElementById("colonyPlanetName");
  const checks = document.getElementById("colonyChecks");

  card.hidden = false;
  title.textContent = planet.name;
  checks.textContent = "Python analizi yükleniyor…";

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

    currentAnalysisResult = result;
    renderSelectedScenario();

  } catch (error) {
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
