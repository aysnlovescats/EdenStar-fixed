// Senaryo sıralaması, karşılaştırma ve kendi gezegenini tasarla.

// Senaryo sıralaması sayfası: listeyi alır, kartları karşılaştırma kutularıyla çizer.
async function loadRankings() {
  const target = $("rankingResults");
  const scenario = $("rankingScenario").value;
  const coverage = $("rankingCoverage").value;
  const query = $("rankingSearch").value.trim();
  target.innerHTML = '<p class="loading-state">Gezegenler aynı senaryoya göre puanlanıyor…</p>';
  try {
    const [solar, exoplanets] = await Promise.all([
      fetchRankings({ scenario, coverage, query, limit: 100, population: "solar" }),
      fetchRankings({ scenario, coverage, query, limit: 100, population: "exoplanet" }),
    ]);
    const results = [...solar.results, ...exoplanets.results];
    latestRankedRecords = results;
    $("rankingSummary").textContent = `${(solar.result_count + exoplanets.result_count).toLocaleString("tr-TR")} sonuç · her grup kendi içinde sıralanır · senaryo: ${scenarioLabel(scenario)}`;
    target.innerHTML = renderPopulationGroups(results, { selectable: true, emptyText: "Bu filtrede sıralanabilecek yeterli veri bulunamadı." });
  } catch (error) { showError(target, error); }
}

// Karşılaştırma kartları: her cismin puanı, kapsamı, model aralığı ve ölçüt satırları;
// Güneş Sistemi ile ötegezegen karışıksa uyarı gösterir.
function renderComparisonCards(entries, scenarioId) {
  const results = entries.map(({ record, analysis }) => {
    const scenario = analysis.scenarios.find(item => item.id === scenarioId);
    const rows = scenario.indicators.map(item => {
      const value = item.value == null ? "Veri yok" : `${Number(item.value).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${item.unit}`;
      const contribution = item.contribution == null ? "Puan katkısı yok" : `Katkı: ${Number(item.contribution).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} puan`;
      return `<div class="compare-row"><span>${escapeHtml(item.name)} · ağırlık %${item.weight}</span><b>${item.score == null ? "Veri yok" : `${item.score}/100`}</b><small>${escapeHtml(value)} · ${escapeHtml(item.data_status || "Durum bilinmiyor")} · ${escapeHtml(contribution)}</small></div>`;
    }).join("");
    const model = scenario.exploratory_model;
    const assumptions = (model?.assumptions || []).map(item => `<li>${escapeHtml(item.name)} · ${escapeHtml(item.label)}${item.value == null ? "" : ` · ${escapeHtml(item.value)} ${escapeHtml(item.unit)}`}</li>`).join("");
    return `<article class="comparison-card"><header><h3>${escapeHtml(record.planet)}</h3><span class="compare-score">${scenario.score == null ? escapeHtml(scenario.score_status || "Genel puan yok") : scenario.score}<small>${Number(scenario.coverage) === 0 ? '<i class="no-data-badge">VERİ YOK</i> · puan 0 kabul edildi' : "Bilinen ölçüt puanı /100"} · ${escapeHtml(record.host)} · kapsam %${scenario.coverage}</small>${scoreRangeNote(scenario) ? `<small class="score-range-note">${escapeHtml(scoreRangeNote(scenario))}</small>` : ""}<small>Varsayımsal model aralığı: ${modelRangeText(model)} · kapsam %${model?.coverage ?? 0}</small></span></header>${assumptions ? `<details class="model-assumptions"><summary>Model varsayımları</summary><ul>${assumptions}</ul><small>${escapeHtml(model.note)}</small></details>` : ""}${rows}<p class="comparison-guidance-note">${escapeHtml(scenario.status)}</p><a class="text-link" href="${detailUrl(record)}">Ayrıntılı senaryo analizini aç →</a></article>`;
  }).join("");
  const guidance = entries[0]?.analysis.scenarios.find(item => item.id === scenarioId)?.guidance;
  const mixedPopulations = new Set(entries.map(({ record }) => record.population || (record.host === "Güneş Sistemi" ? "solar" : "exoplanet"))).size > 1;
  const interpretation = entries[0]?.analysis.scenarios.find(item => item.id === scenarioId)?.interpretation;
  const comparabilityNote = `${mixedPopulations ? '<div class="ranking-explainer"><span>ⓘ</span><p>Güneş Sistemi yüzey sıcaklıkları ile ötegezegen denge sıcaklıkları aynı ölçüm değildir. Karma gruptaki toplam skorlar doğrudan karşılaştırılmamalı; ölçütleri ayrı inceleyin.</p></div>' : ""}${interpretation ? `<div class="ranking-explainer"><span>ⓘ</span><p>${escapeHtml(interpretation)}</p></div>` : ""}`;
  const guidanceText = guidance ? `<div class="ranking-explainer"><span>✓</span><p><strong>${scenarioLabel(scenarioId)} gereksinimleri:</strong> ${guidance.requirements.map(escapeHtml).join(" · ")}<br>${guidance.watchouts.map(escapeHtml).join(" ")}</p></div>` : "";
  return `${comparabilityNote}${guidanceText}${results}`;
}

// Seçilen 2–3 cismin her biri için /api/analyze'ı çağırıp karşılaştırma kartlarını çizer.
async function loadComparison() {
  const target = $("workspaceComparisonResults");
  const scenarioId = $("comparisonScenario").value;
  const records = [...selectedForComparison.values()].slice(0, 3);
  if (records.length < 2) {
    target.innerHTML = '<div class="empty-state"><span>⇄</span><h3>En az iki gökcismi seç</h3><p>Senaryo sıralamasına gidip karşılaştırmak istediklerini işaretle.</p><a href="#rankings" class="text-link">Sıralamaya git →</a></div>';
    return;
  }
  const requestId = ++compareRequest;
  target.innerHTML = '<p class="loading-state">Seçilen gökcisimleri aynı senaryoda karşılaştırılıyor…</p>';
  try {
    const entries = await Promise.all(records.map(async record => {
      const params = new URLSearchParams({ host: record.host, planet: record.planet });
      const response = await fetch(`/api/analyze?${params}`);
      const analysis = await readApiJson(response);
      if (!response.ok) throw new Error(`${record.planet}: ${analysis.error || "Analiz alınamadı."}`);
      return { record, analysis };
    }));
    if (requestId !== compareRequest) return;
    target.innerHTML = renderComparisonCards(entries, scenarioId);
  } catch (error) {
    if (requestId === compareRequest) showError(target, error);
  }
}

// Formda en az bir değer girilmiş mi?
function customHasValues(payload) {
  return Object.entries(payload).some(([key, value]) => key !== "name" && String(value ?? "").trim() !== "");
}

// Ölçüt değerini kullanıcının girdiği birimde gösterir (ör. sıcaklık K yerine °C).
function formatCustomValue(indicator, payload) {
  if (indicator.value == null) return "Veri girilmedi";
  if (indicator.key === "temperature") return `${(Number(indicator.value) - 273.15).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} °C`;
  if (indicator.key === "atmosphere_suitability") return payload.atmosphere_status === "breathable" ? "Solunabilir kabul edildi" : "Solunamaz / zararlı kabul edildi";
  if (["radiation", "water", "geothermal", "geology"].includes(indicator.key)) return `${Number(indicator.value).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} / 1`;
  return `${Number(indicator.value).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${indicator.unit}`;
}

// Kendi gezegeninin bir senaryodaki sonuç kartı.
function renderCustomScenario(planetName, scenario, payload) {
  const score = scoreWithRange(scenario) === "—" ? "—" : scoreWithRange(scenario);
  const indicators = scenario.indicators.map(indicator => {
    const points = indicator.contribution == null ? "Katkı yok" : `Katkı ${Number(indicator.contribution).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
    return `<div class="custom-indicator-row"><span>${escapeHtml(indicator.name)} · %${indicator.weight}</span><b>${indicator.score == null ? "Veri yok" : `${indicator.score}/100`}</b><small>${escapeHtml(formatCustomValue(indicator, payload))} · ${escapeHtml(indicator.data_status)} · ${points}</small></div>`;
  }).join("");
  const risks = (scenario.critical_checks || []).filter(check => check.status === "risk").map(check => check.name);
  const riskNote = risks.length ? `<div class="custom-risk-note">Zorlu yüzey ölçütleri: ${risks.map(escapeHtml).join(", ")}. Puan otomatik olarak sıfırlanmaz; bu koşullar ayrıca değerlendirilmelidir.</div>` : "";
  const model = scenario.exploratory_model;
  const assumptions = (model?.assumptions || []).map(item => `<li>${escapeHtml(item.name)} · ${escapeHtml(item.label)}${item.value == null ? "" : ` · ${escapeHtml(item.value)} ${escapeHtml(item.unit)}`}</li>`).join("");
  return `<article class="custom-score-card"><header><div><h3>${escapeHtml(scenario.name)}</h3><small>${escapeHtml(planetName)}</small></div><span class="custom-score-value">${score}<small>Bilinen ölçüt puanı · kapsam %${scenario.coverage}</small>${scoreRangeNote(scenario) ? `<small class="score-range-note">${escapeHtml(scoreRangeNote(scenario))}</small>` : ""}<small>Varsayımsal model aralığı: ${modelRangeText(model)} · kapsam %${model?.coverage ?? 0}</small></span></header><p>Kullanıcı girdileri doğrulanmış ölçüm sayılmaz; varsayımsal model hesabında gösterilir.</p>${assumptions ? `<details class="model-assumptions"><summary>Girilen varsayımlar</summary><ul>${assumptions}</ul><small>${escapeHtml(model.note)}</small></details>` : ""}<p>${escapeHtml(scenario.status)}</p>${scenario.scope_note ? `<p class="missing-note">${escapeHtml(scenario.scope_note)}</p>` : ""}${indicators}${riskNote}</article>`;
}

// Form değerlerini JSON olarak /api/custom-planet/analyze'a gönderir ve üç senaryonun sonucunu çizer;
// formu tarayıcıya (localStorage) kaydeder.
async function loadCustomPlanetScores() {
  const form = $("customPlanetForm");
  const target = $("customPlanetResults");
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.name = String(payload.name || "").trim() || "Özel gezegen";
  try { localStorage.setItem("edenstar-custom-planet-v1", JSON.stringify(payload)); } catch (_) {}
  if (!customHasValues(payload)) {
    target.innerHTML = '<div class="custom-empty"><span>✧</span><h3>Henüz değer girilmedi</h3><p>Bir veya daha fazla alan doldur; senaryo puanları ve veri kapsamı burada görünsün.</p></div>';
    return;
  }
  const requestId = ++customRequest;
  target.innerHTML = '<p class="loading-state">Girilen varsayımlarla senaryo puanları hesaplanıyor…</p>';
  try {
    const response = await fetch("/api/custom-planet/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await readApiJson(response);
    if (!response.ok) throw new Error(result.error || "Özel gezegen puanı hesaplanamadı.");
    if (requestId !== customRequest) return;
    target.innerHTML = result.scenarios.map(scenario => renderCustomScenario(result.planet, scenario, payload)).join("");
  } catch (error) {
    if (requestId === customRequest) showError(target, error);
  }
}

// Her tuşta istek atmamak için kısa bir gecikmeyle (debounce) hesabı başlatır.
function scheduleCustomPlanetScores() {
  clearTimeout(customTimer);
  customTimer = setTimeout(loadCustomPlanetScores, 350);
}

// Daha önce girilen form değerlerini tarayıcı belleğinden (localStorage) geri yükler.
function restoreCustomPlanet() {
  try {
    const saved = JSON.parse(localStorage.getItem("edenstar-custom-planet-v1") || "null");
    if (!saved || typeof saved !== "object") return;
    Object.entries(saved).forEach(([name, value]) => {
      const input = $("customPlanetForm").elements.namedItem(name);
      if (input) input.value = value;
    });
    if (customHasValues(saved)) scheduleCustomPlanetScores();
  } catch (_) {}
}
