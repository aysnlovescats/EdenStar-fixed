// Görev / yaşam destek simülatörü, yolculuk ve roket hesabı.

// Kişi başı günlük ihtiyaç (kg): su 29,56 (içme 3,56 + hijyen 26), oksijen 0,83, gıda 0,62.
// Diğer sabitler: ışık hızı (km/s), insanlı yolculuk için 100 yıl sınırı, yerel su kullanılabilecek hedefler,
// Dünya'daki güneş akısı (W/m²).
const lifeSupportBaseline = { water: 29.56, oxygen: 0.83, food: 0.62 };
const speedOfLightKmS = 299792.458;
const maxCrewedTransitYears = 100;
const localWaterTargets = new Set(["ay", "mars", "europa", "enceladus"]);
const solarIrradianceEarthWm2 = 1361;
// Simülatörün durumu: hedef listesi, seçili hedef, yolculuk süresi, ikmal kütlesi.
let lifeDestinations = [];
let lifeDestination = null;
let lifeTravelDays = null;
let lifeAnalysisRequest = 0;
let lifeSupportSupplyKg = 0;
let lifeJourneyInfeasible = false;

// Kütleyi kg veya ton olarak okunaklı yazar.
function formatMass(value) {
  const kg = Number(value) || 0;
  if (kg >= 1e15) return `${kg.toExponential(2)} kg`;
  if (kg >= 10000) return `${(kg / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ton`;
  return `${kg.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} kg`;
}

// Gün sayısını 'gün' veya 'yıl' olarak yazar.
function formatTravelDuration(days) {
  if (days == null || !Number.isFinite(days)) return "Hesaplanamıyor";
  if (days < 45) return `${Math.max(0, Math.round(days))} gün`;
  const years = days / 365.25;
  if (years >= 1) return `${years.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} yıl`;
  return `${(days / 30.4375).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ay`;
}

// Yolculuk süresi: Güneş Sistemi için ideal Hohmann transferi (Ay için 3 gün);
// ötegezegen için sabit hız: süre = uzaklık × c / hız.
function estimateTravel(destination) {
  if (!destination) return { days: null, basis: "Hedef seçilmedi." };
  if (destination.destination_type === "solar-system") {
    const name = destination.planet.toLocaleLowerCase("tr-TR");
    if (name === "dünya") return { days: 0, basis: "Dünya referans noktası." };
    if (name === "ay") return { days: 3, basis: "Yaklaşık Dünya-Ay görev süresi; rota ve görev profili hesaplanmadı." };
    const au = Number(destination.orbit_au);
    if (!Number.isFinite(au) || au <= 0) return { days: null, basis: "Yörünge uzaklığı bulunamadı." };
    // Hohmann: transfer elipsinin yarı periyodu t = 0,5 · ((1 + a) / 2)^1,5 yıl (Kepler'in 3. yasası), gün cinsinden.
    const days = 365.25 * 0.5 * (((1 + au) / 2) ** 1.5);
    const orbitGap = Math.abs(au - 1);
    const gapLy = orbitGap * 149597870.7 / 9.460730472e12;
    return { days, basis: `Dünya yörüngesine göre ortalama yörünge farkı ≈ ${orbitGap.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} AU (${gapLy.toLocaleString("tr-TR", { maximumFractionDigits: 6 })} ışık yılı). Süre ideal Hohmann aktarım tahmini; gerçek rota ve fırlatma penceresi hariç.` };
  }
  const distance = Number(destination.distance_ly);
  const speed = Math.max(1, Number($("lifeCruiseSpeed").value) || 1);
  if (!Number.isFinite(distance) || distance <= 0) return { days: null, basis: "NASA kataloğunda bu sistem için uzaklık değeri bulunamadı." };
  return {
    days: distance * speedOfLightKmS / speed * 365.25,
    basis: `Sistem uzaklığı ${distance.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ışık yılı · ${speed.toLocaleString("tr-TR")} km/s sabit hız varsayımı. Hızlanma, yavaşlama ve itki sistemi hesaba katılmaz.`,
  };
}

// Hedefin uzaklığını ışık yılı olarak yazar.
function formatDestinationDistance(destination) {
  if (destination.distance_ly == null || !Number.isFinite(Number(destination.distance_ly))) return "";
  const distance = Number(destination.distance_ly);
  if (distance === 0) return " · 0 ışık yılı";
  if (distance < 0.001) return " · <0,001 ışık yılı";
  return ` · ${distance.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ışık yılı`;
}

// Yolculuk süresini hesaplayıp yazar; dönüş dahilse ikiye katlar, 100 yılı aşarsa 'gerçekçi değil' uyarısı verir.
function updateLifeJourney() {
  if (!lifeDestination) return;
  const estimate = estimateTravel(lifeDestination);
  lifeTravelDays = estimate.days;
  $("lifeTravelTime").textContent = formatTravelDuration(estimate.days);
  const totalTransitDays = estimate.days == null ? null : estimate.days * ($("lifeIncludeReturn").checked ? 2 : 1);
  lifeJourneyInfeasible = totalTransitDays != null && totalTransitDays / 365.25 > maxCrewedTransitYears;
  $("lifeTravelBasis").textContent = lifeJourneyInfeasible
    ? `${estimate.basis} · ${maxCrewedTransitYears} yıl eşiği aşılıyor; insanlı görev gerçekçi değil.`
    : estimate.basis;
  $("lifeSpeedWrap").hidden = lifeDestination.destination_type !== "exoplanet";
  const targetName = lifeDestination.planet.toLocaleLowerCase("tr-TR");
  $("localWaterWrap").hidden = lifeDestination.destination_type !== "solar-system" || !localWaterTargets.has(targetName);
  updateLifePower();
  suggestLifeDeltaV();
}

// İdeal güneş paneli alanı: A = (W/kişi × ekip) / (akı × 1361 W/m² × verim).
function updateLifePower() {
  const output = $("lifePowerEstimate");
  if (!output || !lifeDestination) return;
  const flux = Number(lifeDestination.insolation);
  const wattsPerPerson = Number($("lifePowerPerPerson").value);
  const efficiency = Number($("lifePanelEfficiency").value) / 100;
  const crew = Math.max(1, Number($("lifeCrew").value) || 1);
  if (!Number.isFinite(flux) || flux <= 0 || !Number.isFinite(wattsPerPerson) || wattsPerPerson <= 0 || !Number.isFinite(efficiency) || efficiency <= 0) {
    output.textContent = "Panel alanı için hedef akısı ve pozitif güç/verim girdileri gerekli.";
    return;
  }
  const area = wattsPerPerson * crew / (flux * solarIrradianceEarthWm2 * efficiency);
  output.textContent = `${crew} kişilik ekip için örnek ${engineeringFormat(wattsPerPerson, 0)} W/kişi ve %${engineeringFormat(efficiency * 100, 0)} panel verimiyle yaklaşık ${engineeringFormat(area, 1)} m² ideal panel alanı · akı ${engineeringFormat(flux, 3)} Dünya akısı. Gece, toz, açı, mevsim ve depolama kayıpları dahil değil.`;
}

// Verilen su geri kazanım oranında toplam ikmal kütlesi (duyarlılık grafiği için).
function lifeSupplyAtWaterRecovery(waterRecovery, inputs) {
  const water = lifeSupportBaseline.water * (1 - waterRecovery) * (inputs.travelCrewDays + (1 - inputs.localWater) * inputs.habitatCrewDays);
  const oxygen = lifeSupportBaseline.oxygen * (1 - inputs.oxygenRecovery) * inputs.crewDays;
  const food = lifeSupportBaseline.food * (inputs.travelCrewDays + (1 - inputs.foodProduction) * inputs.habitatCrewDays);
  return (water + oxygen + food) * (1 + inputs.reserve);
}

// Su geri kazanımı %0'dan %100'e giderken toplam ikmalin nasıl düştüğünü SVG çizgi grafiği olarak çizer.
function renderLifeSensitivity(inputs, currentRecovery, currentMass) {
  const chart = $("lifeSensitivityChart");
  if (!chart) return;
  const samples = Array.from({ length: 21 }, (_, index) => {
    const recovery = index / 20;
    return { recovery, mass: lifeSupplyAtWaterRecovery(recovery, inputs) };
  });
  const minMass = Math.min(...samples.map(item => item.mass));
  const maxMass = Math.max(...samples.map(item => item.mass));
  const scale = maxMass - minMass || Math.max(1, maxMass * 0.05);
  const left = 54, right = 618, top = 18, bottom = 142;
  const xAt = recovery => left + recovery * (right - left);
  const yAt = mass => bottom - ((mass - minMass) / scale) * (bottom - top);
  const points = samples.map(item => `${xAt(item.recovery).toFixed(1)},${yAt(item.mass).toFixed(1)}`).join(" ");
  const currentX = xAt(currentRecovery);
  const currentY = yAt(currentMass);
  chart.innerHTML = `<svg viewBox="0 0 640 184" preserveAspectRatio="none" aria-hidden="true"><line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="#3a4a56"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#3a4a56"/><line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="#243440" stroke-dasharray="3 4"/><polyline points="${points}" fill="none" stroke="#ffc35b" stroke-width="3" stroke-linejoin="round"/><line x1="${currentX}" y1="${top}" x2="${currentX}" y2="${bottom}" stroke="#72b7d9" stroke-dasharray="4 4"/><circle cx="${currentX}" cy="${currentY}" r="5" fill="#72b7d9" stroke="#eaf7fd" stroke-width="2"/><text x="${left - 7}" y="${top + 3}" text-anchor="end">${escapeHtml(formatMass(maxMass))}</text><text x="${left - 7}" y="${bottom + 3}" text-anchor="end">${escapeHtml(formatMass(minMass))}</text><text x="${left}" y="166">%0 geri kazanım</text><text x="${right}" y="166" text-anchor="end">%100</text></svg>`;
  $("lifeSensitivitySummary").textContent = `%${Math.round(currentRecovery * 100)} su geri kazanımında toplam ${formatMass(currentMass)}. Eğri diğer görev varsayımları sabit tutularak hesaplandı.`;
}

// Önerilen Δv (km/s): Güneş Sistemi için vis-viva denklemiyle Hohmann manevraları (ayrılma + varış);
// Ay için 4,07; ötegezegen için alt sınır 2 × seyir hızı. Dönüş dahilse × 2.
function suggestedMissionDeltaV() {
  if (!lifeDestination) return null;
  const returnFactor = $("lifeIncludeReturn").checked ? 2 : 1;
  if (lifeDestination.destination_type === "solar-system") {
    const name = lifeDestination.planet.toLocaleLowerCase("tr-TR");
    if (name === "dünya") return 0;
    const targetAu = Number(lifeDestination.orbit_au);
    if (name === "ay") return 4.07 * returnFactor;
    if (!Number.isFinite(targetAu) || targetAu <= 0) return null;
    const muSun = 1.32712440018e20;
    const auMeters = 149597870700;
    const rEarth = auMeters;
    const rTarget = targetAu * auMeters;
    const transferAxis = (rEarth + rTarget) / 2;
    // vis-viva: v = √(μ(2/r − 1/a)). Δv1 = transfer hızı − Dünya'nın yörünge hızı,
    // Δv2 = hedefin yörünge hızı − varıştaki transfer hızı.
    const departure = Math.abs(Math.sqrt(muSun * (2 / rEarth - 1 / transferAxis)) - Math.sqrt(muSun / rEarth));
    const arrival = Math.abs(Math.sqrt(muSun / rTarget) - Math.sqrt(muSun * (2 / rTarget - 1 / transferAxis)));
    return (departure + arrival) / 1000 * returnFactor;
  }
  const speed = Math.max(1, Number($("lifeCruiseSpeed").value) || 1);
  // A simplified lower bound: accelerate to cruise speed and decelerate at destination.
  if (!Number.isFinite(Number(lifeDestination.distance_ly)) || Number(lifeDestination.distance_ly) <= 0) return null;
  return speed * 2 * returnFactor;
}

// Kullanıcı Δv'yi elle değiştirmediyse önerilen değeri alana yazar ve roket hesabını günceller.
function suggestLifeDeltaV(reset = false) {
  const field = $("lifeMissionDeltaV");
  if (reset) field.dataset.userEdited = "false";
  const destinationName = lifeDestination?.planet?.toLocaleLowerCase("tr-TR");
  $("lifeDeltaVBasis").textContent = destinationName === "ay"
    ? "km/s · NASA LEO → Ay yörüngesi tahmini; iniş/kalkış hariç"
    : lifeDestination?.destination_type === "exoplanet"
      ? "km/s · hızlanma + varışta yavaşlama alt sınırı"
      : "km/s · otomatik transfer önerisi, düzenlenebilir";
  if (field.dataset.userEdited !== "true") {
    const suggested = suggestedMissionDeltaV();
    field.value = suggested == null ? "" : suggested.toFixed(3);
  }
  updateRocketEstimate();
}

// Tsiolkovsky roket denklemi: itici madde = son kütle × (e^(Δv / (Isp·g0)) − 1).
// Son kütle = araç + yaşam destek ikmali; itici madde oksitleyici/yakıt oranıyla ikiye bölünür.
function updateRocketEstimate() {
  const deltaVText = $("lifeMissionDeltaV").value.trim();
  const deltaVkmS = deltaVText === "" ? Number.NaN : Number(deltaVText);
  const dryAndFixedLoadKg = Number($("lifeVehicleMass").value) * 1000;
  const isp = Number($("lifeEngineIsp").value);
  const oxidizerFuelRatio = Number($("lifeOxFuelRatio").value);
  const outputs = ["lifePropellantTotal", "lifePropellantFuel", "lifePropellantOxidizer"];
  const note = $("lifePropellantNote");
  if (!Number.isFinite(deltaVkmS) || deltaVkmS < 0) {
    [...outputs, "lifeLaunchMass"].forEach(id => { $(id).textContent = "—"; });
    note.textContent = "Bu hedef için otomatik Δv önerisi yok; roket kütlesi tahmini için Δv değerini gir.";
    return;
  }
  if (!Number.isFinite(dryAndFixedLoadKg) || dryAndFixedLoadKg <= 0 || !Number.isFinite(isp) || isp <= 0 || !Number.isFinite(oxidizerFuelRatio) || oxidizerFuelRatio <= 0) {
    [...outputs, "lifeLaunchMass"].forEach(id => { $(id).textContent = "—"; });
    note.textContent = "Araç kütlesi, Isp ve oksijen/yakıt oranı pozitif değerler olmalı.";
    return;
  }
  const finalMassKg = dryAndFixedLoadKg + lifeSupportSupplyKg;
  const exponent = deltaVkmS * 1000 / (isp * 9.80665);
  if (!Number.isFinite(exponent) || exponent > 700) {
    [...outputs, "lifeLaunchMass"].forEach(id => { $(id).textContent = "Aşırı büyük"; });
    note.textContent = `Δv ${deltaVkmS.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} km/s için bu motor varsayımıyla tek kademeli ideal roket denklemi fiziksel olarak uygulanamaz büyüklükte itici madde veriyor.`;
    return;
  }
  // expm1(x) = e^x − 1; küçük x değerlerinde daha hassas sonuç verir.
  const propellantKg = finalMassKg * Math.expm1(exponent);
  const fuelKg = propellantKg / (1 + oxidizerFuelRatio);
  const oxidizerKg = propellantKg - fuelKg;
  $("lifePropellantTotal").textContent = formatMass(propellantKg);
  $("lifePropellantFuel").textContent = formatMass(fuelKg);
  $("lifePropellantOxidizer").textContent = formatMass(oxidizerKg);
  const massRatio = Math.exp(exponent);
  $("lifeLaunchMass").textContent = formatMass(finalMassKg * massRatio);
  const ratioText = massRatio >= 1e9 ? massRatio.toExponential(2) : massRatio.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  note.textContent = `Δv ${deltaVkmS.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} km/s · son kütle ${formatMass(finalMassKg)} (araç/yük + yaşam desteği) · 1 kg ikmal, bu ideal kütle oranıyla yaklaşık ${ratioText} kg başlangıç kütlesi gerektirir. Kademeler ve kuru yapı kütlesi roket modelinde ayrıca ayrıştırılmıyor.`;
}

// Seçilen hedefin seçilen senaryodaki puanını /api/analyze'dan alıp gösterir.
async function loadLifeSupportDestinationAnalysis() {
  const destination = lifeDestination;
  if (!destination) return;
  const requestId = ++lifeAnalysisRequest;
  $("lifeScenarioScore").textContent = "Yükleniyor…";
  $("lifeScenarioCoverage").textContent = "Seçilen gökcismi analiz ediliyor";
  $("lifeDestinationNote").textContent = `${destination.planet} · ${destination.host} için senaryo verisi alınıyor…`;
  const params = new URLSearchParams({ host: destination.host, planet: destination.planet });
  try {
    const response = await fetch(`/api/analyze?${params}`);
    const analysis = await readApiJson(response);
    if (!response.ok) throw new Error(analysis.error || "Gezegen analizi alınamadı.");
    if (requestId !== lifeAnalysisRequest) return;
    const scenario = analysis.scenarios.find(item => item.id === $("lifeScenario").value);
    if (!scenario) throw new Error("Seçilen yerleşim senaryosu bulunamadı.");
    let travelInputsUpdated = false;
    if (destination.destination_type === "exoplanet" && destination.distance_ly == null) {
      destination.distance_ly = analysis.metrics?.access ?? null;
      travelInputsUpdated = true;
    }
    if (destination.insolation == null && analysis.metrics?.insolation != null && Number.isFinite(Number(analysis.metrics.insolation))) {
      destination.insolation = Number(analysis.metrics.insolation);
      travelInputsUpdated = true;
    }
    if (destination.orbit_au == null && Number(analysis.metrics?.insolation) > 0) {
      destination.orbit_au = Math.sqrt(1 / Number(analysis.metrics.insolation));
      travelInputsUpdated = true;
    }
    if (travelInputsUpdated) {
      updateLifeJourney();
      updateLifeSupport();
    }
    $("lifeScenarioScore").textContent = scenario.score == null ? "Veri yetersiz" : scoreWithRange(scenario);
    $("lifeScenarioCoverage").textContent = [scoreRangeNote(scenario), `Veri kapsamı %${scenario.coverage} · güven ${scenario.confidence}`].filter(Boolean).join(" · ");
    const unknowns = (scenario.indicators || []).filter(item => !item.available).map(item => item.name);
    const critical = (scenario.critical_checks || []).filter(item => item.status !== "ok").map(item => `${item.name}: ${item.summary}`);
    const details = [scenario.status, critical.join(" "), unknowns.length ? `Eksik ölçütler: ${unknowns.join(", ")}.` : ""]
      .filter(Boolean).join(" ");
    $("lifeDestinationNote").textContent = details || "Seçilen senaryo için ölçülebilen ölçütler listelendi.";
  } catch (error) {
    if (requestId !== lifeAnalysisRequest) return;
    $("lifeScenarioScore").textContent = "Analiz yok";
    $("lifeScenarioCoverage").textContent = "Gezegen analizi yüklenemedi";
    $("lifeDestinationNote").textContent = error.message;
  }
}

// Hedef listesini /api/destinations'tan alır; adres çubuğundaki ?host=&planet= varsa o hedefi seçer.
async function loadLifeSupportDestinations() {
  const select = $("lifeDestination");
  select.innerHTML = '<option value="">Hedefler yükleniyor…</option>';
  try {
    const requested = new URLSearchParams(window.location.search);
    const requestedPlanet = requested.get("planet");
    const requestedHost = requested.get("host");
    const destinationParams = new URLSearchParams({ limit: "300" });
    if (requestedPlanet && requestedHost) {
      destinationParams.set("selected_planet", requestedPlanet);
      destinationParams.set("selected_host", requestedHost);
    }
    let response = await fetch(`/api/destinations?${destinationParams}`);
    let data = await readApiJson(response).catch(() => ({}));
    if (!response.ok || !Array.isArray(data.results)) {
      response = await fetch("/api/rankings?scenario=surface&min_coverage=0&limit=200");
      data = await readApiJson(response).catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Hedef listesi alınamadı.");
      lifeDestinations = (data.results || []).map(item => ({
        host: item.host,
        planet: item.planet,
        distance_ly: null,
        orbit_au: null,
        insolation: null,
        destination_type: item.host === "Güneş Sistemi" ? "solar-system" : "exoplanet",
      }));
    } else {
      lifeDestinations = data.results || [];
    }
    if (!lifeDestinations.length) throw new Error("Listelenecek hedef bulunamadı.");
    lifeDestinations.sort((left, right) => {
      const leftDistance = left.distance_ly == null || !Number.isFinite(Number(left.distance_ly)) ? Infinity : Number(left.distance_ly);
      const rightDistance = right.distance_ly == null || !Number.isFinite(Number(right.distance_ly)) ? Infinity : Number(right.distance_ly);
      return leftDistance - rightDistance || left.planet.localeCompare(right.planet, "tr") || left.host.localeCompare(right.host, "tr");
    });
    select.innerHTML = lifeDestinations.map((item, index) =>
      `<option value="${index}">${escapeHtml(item.planet)} · ${escapeHtml(item.host)}${formatDestinationDistance(item)}</option>`
    ).join("");
    const marsIndex = lifeDestinations.findIndex(item => item.host === "Güneş Sistemi" && item.planet.toLocaleLowerCase("tr-TR") === "mars");
    const requestedIndex = requestedPlanet ? lifeDestinations.findIndex(item =>
      item.planet.toLocaleLowerCase("tr-TR") === requestedPlanet.toLocaleLowerCase("tr-TR") &&
      (!requestedHost || item.host.toLocaleLowerCase("tr-TR") === requestedHost.toLocaleLowerCase("tr-TR"))
    ) : -1;
    select.value = String(requestedIndex >= 0 ? requestedIndex : Math.max(0, marsIndex));
    lifeDestination = lifeDestinations[Number(select.value)] || null;
    updateLifeJourney();
    updateLifeSupport();
    loadLifeSupportDestinationAnalysis();
  } catch (error) {
    select.innerHTML = '<option value="">Hedef listesi yüklenemedi</option>';
    $("lifeDestinationNote").textContent = error.message;
  }
}

// Su, oksijen ve gıda ikmalini hesaplar: günlük ihtiyaç × (1 − geri kazanım) × kişi-gün × (1 + yedek payı).
// Gıda yolculukta tam, hedefte yerel üretim kadar azalır; yerel su yalnızca hedefteki kalışa uygulanır.
function updateLifeSupport() {
  if (!$("lifeCrew")) return;
  const crew = Math.max(1, Number($("lifeCrew").value) || 1);
  const stayDays = Math.max(1, Number($("lifeDays").value) || 1);
  const waterRecovery = Number($("waterRecovery").value) / 100;
  const oxygenRecovery = Number($("oxygenRecovery").value) / 100;
  const foodProduction = Number($("foodProduction").value) / 100;
  const reserve = Number($("supplyReserve").value) / 100;
  const localWater = $("localWaterWrap").hidden ? 0 : Number($("localWaterUse").value) / 100;
  const returnLegs = $("lifeIncludeReturn").checked ? 2 : 1;
  const transitDays = lifeTravelDays == null ? 0 : lifeTravelDays * returnLegs;
  const totalCrewDays = crew * (transitDays + stayDays);
  const travelCrewDays = crew * transitDays;
  const habitatCrewDays = crew * stayDays;
  $("waterRecoveryLabel").value = `${Math.round(waterRecovery * 100)}%`;
  $("oxygenRecoveryLabel").value = `${Math.round(oxygenRecovery * 100)}%`;
  $("foodProductionLabel").value = `${Math.round(foodProduction * 100)}%`;
  $("supplyReserveLabel").value = `${Math.round(reserve * 100)}%`;
  $("localWaterLabel").value = `${Math.round(localWater * 100)}%`;
  updateLifePower();

  const items = [
    { id: "Water", label: "Su", daily: lifeSupportBaseline.water * (1 - waterRecovery), travel: lifeSupportBaseline.water * (1 - waterRecovery) * travelCrewDays, habitat: lifeSupportBaseline.water * (1 - waterRecovery) * (1 - localWater) * habitatCrewDays },
    { id: "Oxygen", label: "Oksijen", daily: lifeSupportBaseline.oxygen * (1 - oxygenRecovery), travel: lifeSupportBaseline.oxygen * (1 - oxygenRecovery) * travelCrewDays, habitat: lifeSupportBaseline.oxygen * (1 - oxygenRecovery) * habitatCrewDays },
    { id: "Food", label: "Gıda", daily: lifeSupportBaseline.food * (1 - foodProduction), travel: lifeSupportBaseline.food * travelCrewDays, habitat: lifeSupportBaseline.food * (1 - foodProduction) * habitatCrewDays },
  ].map(item => {
    const reserveFactor = 1 + reserve;
    const travel = item.travel * reserveFactor;
    const habitat = item.habitat * reserveFactor;
    return { ...item, travel, habitat, mission: travel + habitat, fraction: totalCrewDays ? (travel + habitat) / (lifeSupportBaseline[item.id.toLowerCase()] * totalCrewDays) : 0 };
  });
  const total = items.reduce((sum, item) => sum + item.mission, 0);
  renderLifeSensitivity({
    travelCrewDays, habitatCrewDays, crewDays: totalCrewDays,
    localWater, oxygenRecovery, foodProduction, reserve,
  }, waterRecovery, total);
  $("lifeTotalResupply").textContent = formatMass(total);
  const travelLabel = lifeTravelDays == null ? "yolculuk süresi bilinmiyor" : `${formatTravelDuration(transitDays)} yolculuk`;
  $("lifeMissionSummary").textContent = `${crew.toLocaleString("tr-TR")} kişi · ${travelLabel} · ${stayDays.toLocaleString("tr-TR")} gün kalış${lifeTravelDays == null ? " · ikmal hesabına yolculuk dahil değil" : ""}${lifeJourneyInfeasible ? ` · ${maxCrewedTransitYears} yıl eşiği aşılıyor; bu hızla insanlı görev gerçekçi değil` : ""}`;
  for (const item of items) {
    $(`life${item.id}Resupply`).textContent = formatMass(item.mission);
    $(`life${item.id}Daily`).textContent = `Yolculuk ${formatMass(item.travel)} · Hedefte ${formatMass(item.habitat)}`;
    $(`life${item.id}Track`).style.width = `${Math.max(0, Math.min(100, item.fraction * 100))}%`;
  }
  const bottleneck = [...items].sort((a, b) => b.mission - a.mission)[0];
  $("lifeBottleneck").textContent = total > 0
    ? `Bu varsayımlarla en büyük ikmal kalemi ${bottleneck.label.toLocaleLowerCase("tr-TR")} (${formatMass(bottleneck.mission)}). ${lifeJourneyInfeasible ? "Seyahat süresi 100 yılı aştığı için bu insanlı görev gerçekçi değil; büyük değer yalnızca model varsayımlarının sonucudur. " : ""}Bu yalnızca kütle karşılaştırmasıdır; depolama hacmi, enerji ve sistem donanımını hesaba katmaz.`
    : `Seçtiğin varsayımlarda dış ikmal gerekmiyor görünüyor. %${Math.round(reserve * 100)} yedek payı uygulandı; yerel su varsayımı saha erişimini veya çıkarma kayıplarını modellemez.`;
  lifeSupportSupplyKg = total;
  updateRocketEstimate();
}
