// Koloni analizi kartı, senaryo sekmeleri ve gezegen karşılaştırması.

// Analiz kartının durumu: son API yanıtı, seçili senaryo/yüzey seçeneği, karşılaştırma seçimi.
// *RequestId sayaçları geç gelen eski yanıtların yenisinin üzerine yazmasını önler.
let currentAnalysisResult = null;
let selectedScenarioId = "surface";
let selectedSurfaceOptionId = null;
let analysisRequestId = 0;
let comparisonRequestId = 0;
let comparisonSelection = new Set();
let comparisonOpen = false;

// Seçili senaryo için ek veri kaynağı kartlarını (NASA veri setleri, görev ölçümleri) HTML olarak üretir.
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

// Senaryonun 'gerekenler' ve 'belirsizlikler' listesini üretir; eksik ölçütleri listenin başına ekler.
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

// Kaynak türünü (archive, derived, estimated…) Türkçe etikete çevirir.
function dataStatusLabel(kind) {
  return ({ archive: "Arşiv", project: "Proje verisi", derived: "Türetilmiş", estimated: "Tahmin", modeled: "Model", user: "Kullanıcı girdisi", unknown: "Bilinmiyor" })[kind] || "Bilinmiyor";
}

// PHL bölümünü üretir: aday durumu, ESI ve yaşanabilir bölge bilgisi.
function renderPhlComparisonDetail() {
  const phl = currentAnalysisResult?.phl_comparison;
  if (!phl) return "";
  if (phl.not_applicable) return `<section class="phl-detail"><span class="eyebrow">PHL İLE KARŞILAŞTIRMA</span><p>${escapeHtml(phl.message)}</p></section>`;
  if (!phl.available) return `<section class="phl-detail"><span class="eyebrow">PHL İLE KARŞILAŞTIRMA</span><p>${escapeHtml(phl.message || "PHL verisi kullanılamıyor.")} PHL aday durumu ve ESI için PHL HWC CSV dosyası projeye <code>data/hwc.csv</code> adıyla eklenmeli.</p><a href="${escapeHtml(phl.source_url || "https://phl.upr.edu/hwc/data")}" target="_blank" rel="noopener noreferrer">PHL veri sayfası ↗</a></section>`;
  const esi = phl.esi == null ? "Veri yok" : Number(phl.esi).toLocaleString("tr-TR", { maximumFractionDigits: 3 });
  const zoneLabel = value => value == null ? "Veri yok" : Number(value) > 0 ? "Evet" : "Hayır";
  return `<section class="phl-detail"><span class="eyebrow">PHL İLE KARŞILAŞTIRMA</span><div class="phl-detail-grid"><div><small>PHL aday durumu</small><strong>${escapeHtml(phl.status || "Etiket yok")}</strong></div><div><small>Dünya Benzerlik İndeksi (ESI)</small><strong>${esi}</strong></div><div><small>Konservatif yaşanabilir bölge</small><strong>${zoneLabel(phl.conservative_zone)}</strong></div><div><small>İyimser yaşanabilir bölge</small><strong>${zoneLabel(phl.optimistic_zone)}</strong></div>${phl.planet_type ? `<div><small>PHL gezegen sınıfı</small><strong>${escapeHtml(phl.planet_type)}</strong></div>` : ""}</div><p>${escapeHtml(phl.caveat || "PHL etiketi yaşam kanıtı değildir.")} ESI, proje koloni senaryosu puanıyla aynı ölçekte değildir.</p><a href="${escapeHtml(phl.source_url || "https://phl.upr.edu/hwc/data")}" target="_blank" rel="noopener noreferrer">PHL veri kaynağı ↗</a></section>`;
}

// API yanıtını JSON olarak okur; sunucu HTML hata sayfası döndürdüyse anlaşılır bir hata verir.
async function readApiJson(response) {
  const body = await response.text();
  try { return JSON.parse(body); }
  catch (_) { throw new Error("Sunucu JSON yerine HTML yanıtı verdi. Python sunucusunu yeniden başlatıp tekrar deneyin."); }
}

// Senaryo ayrıntıları: puan, kapsam, olası aralık, varsayımsal model ve her ölçütün satırı
// (değer, puan, kaynak durumu).
function renderScenarioDetails(scenario) {
  const scoreText = scenario.score == null ? (scenario.score_status || "Genel puan yok") : `${scenario.score}/100`;
  const model = scenario.exploratory_model;
  const modelText = modelRangeText(model);
  const modelStar = model?.star_type
    ? `Yıldız: ${model.star_type}${model.star_factor == null ? "" : ` · varsayımsal katkı ${model.star_factor}/100`}`
    : "Yıldız türü bilinmiyor; bu modelde yıldız katkısı yok";
  const modelAssumptions = (model?.assumptions || []).map(item => `<li>${escapeHtml(item.name)} · ${escapeHtml(item.label)}${item.value == null ? "" : ` · ${escapeHtml(item.value)} ${escapeHtml(item.unit)}`}</li>`).join("");
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
      <div class="scenario-heading"><h3>${escapeHtml(scenario.name)}</h3><span class="scenario-score-block"><strong>${scoreText}</strong><small>${Number(scenario.coverage) === 0 ? '<i class="no-data-badge">VERİ YOK</i> · puan 0 kabul edildi; uygunluk bilinmiyor' : "Kaynağı doğrulanmış ölçütlerin kendi ağırlıklarıyla toplam puana katkısı"}</small>${scenario.score_min != null && scenario.score_max > scenario.score_min ? `<small class="score-range-note">Eksik ölçütler tam uygun olsaydı olası üst sınır: ${scenario.score_max}/100</small>` : ""}</span></div>
      <p class="scenario-description">${escapeHtml(scenario.description)}</p>
      <p class="scenario-meta">${escapeHtml(scenario.interpretation || "")}</p>
      <div class="scenario-meta">Puan ölçütlerinin kapsamı %${scenario.coverage} · Güven: ${escapeHtml(scenario.confidence)}${scoreRangeNote(scenario) ? ` · ${escapeHtml(scoreRangeNote(scenario))}` : ""}</div>
      <div class="exploratory-model"><strong>Varsayımsal model aralığı: ${modelText}</strong><span>Kapsam %${model?.coverage ?? 0} · ${escapeHtml(modelStar)}</span><small>${escapeHtml(model?.note || "Tahmin ve varsayımlar ölçüm puanından ayrı hesaplanır.")}</small>${modelAssumptions ? `<details class="model-assumptions"><summary>Model hangi varsayımları kullandı?</summary><ul>${modelAssumptions}</ul></details>` : ""}</div>
      <p class="scenario-meta">${escapeHtml(scenario.status)}</p>
      <p class="scenario-meta">Kaynağı doğrulanmış tek bir ölçüt bile kendi senaryo ağırlığı kadar puana katkı sağlar. Toplam, tüm senaryo ağırlıkları üzerinden hesaplanır; eksik ölçütler katkı yapmaz ve tahmin/model değerleri ayrı varsayımsal modelde gösterilir.</p>
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

// Seçilen yüzey yaklaşımının (açık yüzey, kubbe, regolit, Venüs platformu) ayrıntısını gösterir.
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

// Analiz kartının içeriğini seçili sekmeye göre yeniden çizer: karşılaştırma paneli,
// yüzey yaklaşımı seçimi veya senaryo ayrıntısı.
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

// Aynı sistemdeki gezegenleri karşılaştırma için onay kutuları olarak listeler.
function renderComparisonChoices() {
  const container = document.getElementById("comparisonPlanetChoices");
  container.innerHTML = currentSystem.planets.map(planet => {
    const checked = comparisonSelection.has(planet.name);
    const disable = !checked && comparisonSelection.size >= 3;
    return `<label class="comparison-planet-choice"><input type="checkbox" data-compare-planet value="${escapeHtml(planet.name)}" ${checked ? "checked" : ""} ${disable ? "disabled" : ""}><span>${escapeHtml(planet.name)}</span></label>`;
  }).join("");
  document.getElementById("runComparison").disabled = comparisonSelection.size < 2;
}

// Karşılaştırmada bir gezegenin kartı: seçilen senaryodaki puan, kapsam ve ölçütler.
function renderComparisonCard(planetName, result, scenarioId) {
  const scenario = result.scenarios.find(item => item.id === scenarioId);
  if (!scenario) return `<article class="comparison-card"><h4>${escapeHtml(planetName)}</h4><p>Bu senaryo için analiz yok.</p></article>`;
  const score = scenario.score == null ? (scenario.score_status || "Genel puan yok") : `${scenario.score}/100`;
  const model = scenario.exploratory_model;
  const modelScore = modelRangeText(model);
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
    <header><h4>${escapeHtml(planetName)}</h4><span class="comparison-score">${score}<small>Kaynağı doğrulanmışların toplam puana katkısı · kapsam %${scenario.coverage}</small><small>Varsayımsal model aralığı: ${modelScore} · kapsam %${model?.coverage ?? 0}</small>${scenario.score_min != null && scenario.score_max > scenario.score_min ? `<small class="score-range-note">Eksik ölçütler tam uygun olsaydı üst sınır: ${scenario.score_max}/100</small>` : ""}</span></header>
    ${(model?.assumptions || []).length ? `<details class="model-assumptions"><summary>Model varsayımları</summary><ul>${model.assumptions.map(item => `<li>${escapeHtml(item.name)} · ${escapeHtml(item.label)}${item.value == null ? "" : ` · ${escapeHtml(item.value)} ${escapeHtml(item.unit)}`}</li>`).join("")}</ul><small>${escapeHtml(model.note)}</small></details>` : ""}
    <p class="comparison-guidance-note">${escapeHtml(scenario.interpretation || "")}</p>
    ${rows}
    <p class="comparison-guidance-note">${escapeHtml(scenario.status)}</p>
    ${scenario.scope_note ? `<p class="comparison-guidance-note">${escapeHtml(scenario.scope_note)}</p>` : ""}
  </article>`;
}

// Seçilen gezegenlerin her biri için /api/analyze isteğini aynı anda atar (Promise.all) ve kartları yan yana gösterir.
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
      const result = await readApiJson(response);
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

// Gezegen seçilince analiz kartını açar: görseli hazırlar, /api/analyze'dan sonucu alır ve kartı çizer.
// İstek numarası değiştiyse (kullanıcı başka gezegene geçtiyse) eski yanıt yok sayılır.
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
    const result = await readApiJson(response);

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

// Kart düğmeleri: kapat, senaryo sekmeleri, karşılaştırmayı aç/kapat, gezegen seçimi, yüzey yaklaşımı seçimi.
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
