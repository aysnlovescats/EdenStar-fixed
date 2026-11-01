// Kamera, animasyon döngüsü, etkileşim ve başlangıç. En son yüklenmelidir.

// Kamerayı hedefin etrafında küresel koordinatlarla (açı, yükseklik, uzaklık) konumlandırır ve hedefe baktırır.
function updateCamera() {
  camera.position.set(
    target.x + cameraDistance * Math.sin(cameraElevation) * Math.sin(cameraAngle),
    target.y + cameraDistance * Math.cos(cameraElevation),
    target.z + cameraDistance * Math.sin(cameraElevation) * Math.cos(cameraAngle)
  );

  camera.lookAt(target);
}

// Her etiketin 3B konumunu ekran koordinatına çevirir (project); ekran dışındaysa gizler.
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

// Animasyon döngüsü: geçen gerçek süreyi zaman hızıyla çarpıp simüle günü ilerletir,
// her gezegenin açısını (gün / periyot) × 2π ile hesaplar, tarihi ve sahneyi günceller.
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

// Metindeki özel HTML karakterlerini kaçışlar (XSS önlemi).
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

// planet_data.js'ten gelen sistemleri nesnelere çevirir, seçim listesini doldurur ve adres çubuğundaki
// ?host=...&planet=... parametresine göre ilgili sistemi ve gezegeni açar.
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

// Zaman hızı kaydırıcısının değerini yazar (ör. 10×).
function updateSpeedLabel() {
  speedText.textContent = `${speedInput.value}×`;
}

speedInput.addEventListener("input", updateSpeedLabel);
updateSpeedLabel();

// Fare: sürükleyince kamera döner; kısa tıklamada Raycaster ile tıklanan gezegen bulunur.
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

// Tekerlek: yakınlaştır/uzaklaştır (8 ile 65 arasında sınırlı).
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

// Başlangıç: arka plan yıldızları, NASA verisini yükle, sistemi aç ve animasyonu başlat.
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
