// Sistem çizimi, gezegen listesi ve gezegen seçimi.

// Nesneyi sahneye ekler ve sistem değişince silinebilsin diye listeye kaydeder.
function addToSystem(object) {
  scene.add(object);
  systemObjects.push(object);
  return object;
}

// Önceki sistemin bütün nesnelerini sahneden kaldırır ve belleği (geometri, malzeme) serbest bırakır.
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

// Arka plana 10.000 rastgele yıldız yerleştirir (dekoratif).
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

// Yıldız sıcaklığına (K) göre renk: soğuk → turuncu, sıcak → mavi-beyaz.
function starColor(temperature) {
  if (!temperature) return 0xffd574;
  if (temperature < 3800) return 0xff885b;
  if (temperature < 5200) return 0xffc078;
  if (temperature < 6500) return 0xffe4b0;
  return 0xb9d8ff;
}

// Gezegen sıcaklığına (°C) göre renk.
function planetColor(temperature) {
  if (temperature == null) return 0x9ab2c5;
  if (temperature > 300) return 0xff9a62;
  if (temperature > 50) return 0xffd17a;
  if (temperature > -80) return 0x76b9ff;
  return 0xb8d8ef;
}

// Yörünge çizgisi rengi (sırayla tekrar eden küçük palet).
function orbitColor(index) {
  const colors = [
    0x3b9ee8,
    0x3b9ee8,
    0x4a9f78,
    0xb47b43
  ];

  return colors[index % colors.length];
}

// Gezegen yarıçapından (km) logaritmik görsel boyut; gerçek ölçek değil, hepsi ekranda görünsün diye.
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

// Yıldız parıltısı için dairesel, kenarı saydam doku.
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

// Bir nesneye HTML ad etiketi bağlar; konumu her karede updateLabels() ile güncellenir.
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

// Seçilen yıldız sistemini çizer: yıldız, parıltı, yörüngeler ve gezegenler.
// Yörünge yarıçapı ekrana sığsın diye √(a / a_max) ile sıkıştırılır.
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

    // Periyot NASA'da yoksa Kepler'in 3. yasası: P² = a³ / M (P yıl, a AU, M Güneş kütlesi) → gün için × 365,25.
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

// Yan paneldeki gezegen listesini (ad, boyut sınıfı, yörünge uzaklığı) oluşturur.
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

// Yarıçapa göre yalnızca görsel boyut etiketi verir (Dünya boyutu, süper-Dünya…);
// bilimsel sınıflandırma Python'daki classification.py'dedir.
function classifyPlanetSize(radiusKm) {
  if (radiusKm == null || radiusKm <= 0) return "Sınıflandırılamadı";
  const radius = radiusKm / 6371;
  if (radius < .8) return "Küçük gezegen boyutunda";
  if (radius < 1.25) return "Dünya boyutunda";
  if (radius < 2) return "Süper-Dünya boyutunda";
  if (radius < 4) return "Neptün boyutunda";
  return "Büyük gezegen boyutunda";
}

// Gezegeni seçer: listede işaretler, temel bilgileri yazar ve koloni analizi kartını açar.
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
