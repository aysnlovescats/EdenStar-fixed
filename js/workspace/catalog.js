// Genel bakış, gezegen kataloğu ve PHL aday listeleri.

// Genel bakış: seçili senaryoda iki grubun en iyilerini alır, özet kutularını ve ilk sonuçları çizer.
async function loadOverview() {
  const scenario = $("overviewScenario").value;
  const target = $("overviewTopList");
  target.innerHTML = '<p class="loading-state">Senaryo sıralaması hazırlanıyor…</p>';
  try {
    const [solar, exoplanets] = await Promise.all([
      fetchRankings({ scenario, coverage: 0, limit: 3, population: "solar" }),
      fetchRankings({ scenario, coverage: 0, limit: 3, population: "exoplanet" }),
    ]);
    $("overviewEligible").textContent = (solar.result_count + exoplanets.result_count).toLocaleString("tr-TR");
    const solarBest = solar.results[0];
    const exoplanetBest = exoplanets.results[0];
    $("overviewSolarScore").textContent = solarBest ? scoreWithRange(solarBest) : "—";
    $("overviewSolarName").textContent = solarBest ? `${solarBest.planet} · ${solarBest.host}` : "bu filtrede sonuç yok";
    $("overviewExoplanetScore").textContent = exoplanetBest ? scoreWithRange(exoplanetBest) : "—";
    $("overviewExoplanetName").textContent = exoplanetBest ? `${exoplanetBest.planet} · ${exoplanetBest.host}` : "bu filtrede sonuç yok";
    target.innerHTML = renderPopulationGroups([...solar.results, ...exoplanets.results]);
  } catch (error) { showError(target, error); }
}

// Katalog: arama, senaryo ve en az kapsam filtresiyle iki grubu getirip kartları çizer.
async function loadCatalog() {
  const target = $("catalogResults");
  const scenario = $("catalogScenario").value;
  const coverage = $("catalogCoverage").value;
  const query = $("catalogSearch").value.trim();
  target.innerHTML = '<p class="loading-state">Gezegen kataloğu filtreleniyor…</p>';
  try {
    const [solar, exoplanets] = await Promise.all([
      fetchRankings({ scenario, coverage, query, limit: 100, population: "solar" }),
      fetchRankings({ scenario, coverage, query, limit: 100, population: "exoplanet" }),
    ]);
    const results = [...solar.results, ...exoplanets.results];
    latestRankedRecords = results;
    $("catalogSummary").textContent = `${(solar.result_count + exoplanets.result_count).toLocaleString("tr-TR")} sonuç · Güneş Sistemi ve ötegezegenler ayrı gruplarda · ölçüt: ${scenarioLabel(scenario)}`;
    target.innerHTML = renderPopulationGroups(results, { emptyText: "Bu filtrede sonuç yok. Minimum kapsamı düşürmeyi deneyebilirsin." });
  } catch (error) { showError(target, error); }
}

// PHL aday kartları: sıra, ad, ESI, sınıf, yıldız, uzaklık, yarıçap, sıcaklık.
function renderPhlCandidateCards(items, group) {
  if (!items.length) return '<div class="planet-empty">Bu grupta aramayla eşleşen aday yok.</div>';
  return items.map((item, index) => {
    const esi = item.esi == null ? "Veri yok" : Number(item.esi).toLocaleString("tr-TR", { maximumFractionDigits: 3 });
    const distance = item.distance_pc == null ? "Uzaklık verisi yok" : `${(Number(item.distance_pc) * 3.26156).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ışık yılı`;
    const radius = item.radius == null ? "Yarıçap verisi yok" : `${Number(item.radius).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} Dünya yarıçapı`;
    const temperature = item.equilibrium_temperature == null ? "Denge sıcaklığı yok" : `${Number(item.equilibrium_temperature).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} K denge sıcaklığı`;
    const zones = `Konservatif bölge: ${item.conservative_zone == null ? "veri yok" : item.conservative_zone > 0 ? "evet" : "hayır"} · İyimser bölge: ${item.optimistic_zone == null ? "veri yok" : item.optimistic_zone > 0 ? "evet" : "hayır"}`;
    const star = item.star_type ? `Yıldız türü: ${escapeHtml(item.star_type)}` : "Yıldız türü belirtilmemiş";
    return `<article class="phl-candidate-card"><header><span class="phl-rank">${String(index + 1).padStart(2, "0")}</span><div><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.host)}</p></div><span class="phl-candidate-badge ${group}">${group === "conservative" ? "Konservatif" : "İyimser"}</span></header><div class="phl-esi"><small>Dünya Benzerlik İndeksi</small><strong>${esi}</strong><span>ESI</span></div><div class="phl-candidate-facts"><span>${escapeHtml(item.planet_type || "Gezegen sınıfı bilinmiyor")}</span><span>${escapeHtml(star)}</span><span>${escapeHtml(distance)}</span><span>${escapeHtml(radius)}</span><span>${escapeHtml(temperature)}</span></div><p class="phl-candidate-zones">${escapeHtml(zones)}</p></article>`;
  }).join("");
}

// Yedek yol: hwc.csv metnini tarayıcıda satır ve sütunlara ayırır (tırnak içindeki virgülleri doğru işler).
function parsePhlCsvRows(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    if (quoted) {
      if (character === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += character;
  }
  if (field.length || row.length) { row.push(field); if (row.some(value => value.trim())) rows.push(row); }
  return rows;
}

// API'ye ulaşılamazsa PHL adaylarını doğrudan data/hwc.csv dosyasından okuyup sıralar.
async function readPhlCandidatesFromCsv(query) {
  const response = await fetch("/data/hwc.csv");
  if (!response.ok) throw new Error("PHL CSV dosyasına erişilemiyor; Flask sunucusunu yeniden başlatıp sayfayı yenile.");
  const rows = parsePhlCsvRows(await response.text());
  if (rows.length < 2) throw new Error("PHL CSV boş veya okunamıyor.");
  const headers = rows[0].map(value => value.replace(/^\uFEFF/, "").trim().toLowerCase());
  const column = Object.fromEntries(headers.map((name, index) => [name, index]));
  const value = (row, name) => row[column[name]]?.trim() || "";
  const numeric = (row, name) => {
    const parsed = Number(value(row, name));
    return value(row, name) && Number.isFinite(parsed) ? parsed : null;
  };
  const normalizedQuery = query.toLocaleLowerCase("tr-TR");
  const candidates = [];
  for (const row of rows.slice(1)) {
    const classification = numeric(row, "p_habitable");
    const name = value(row, "p_name");
    if (!name || ![1, 2].includes(classification)) continue;
    const host = value(row, "s_name") || "Yıldız sistemi bilinmiyor";
    if (normalizedQuery && !`${name} ${host}`.toLocaleLowerCase("tr-TR").includes(normalizedQuery)) continue;
    candidates.push({
      name, host, habitability_class: classification,
      esi: numeric(row, "p_esi"),
      conservative_zone: numeric(row, "p_habzone_con"),
      optimistic_zone: numeric(row, "p_habzone_opt"),
      planet_type: value(row, "p_type_temp") || value(row, "p_type") || null,
      star_type: value(row, "s_type") || null,
      distance_pc: numeric(row, "s_distance"),
      radius: numeric(row, "p_radius"),
      equilibrium_temperature: numeric(row, "p_temp_equil"),
    });
  }
  candidates.sort((a, b) => a.habitability_class - b.habitability_class || (a.esi == null) - (b.esi == null) || (b.esi || 0) - (a.esi || 0) || a.name.localeCompare(b.name));
  const conservative = candidates.filter(item => item.habitability_class === 1);
  const optimistic = candidates.filter(item => item.habitability_class === 2);
  return {
    available: true,
    conservative,
    optimistic,
    conservative_count: conservative.length,
    optimistic_count: optimistic.length,
    candidate_count: candidates.length,
    fromCsvFallback: true,
  };
}

// PHL adayları sayfası: önce API'yi dener, olmazsa CSV yedeğini kullanır; konservatif ve iyimser grupları çizer.
async function loadPhlCandidates() {
  const conservativeTarget = $("phlConservativeResults");
  const optimisticTarget = $("phlOptimisticResults");
  const query = $("phlCandidateSearch").value.trim();
  const params = new URLSearchParams({ q: query });
  conservativeTarget.innerHTML = optimisticTarget.innerHTML = '<p class="loading-state">PHL adayları sıralanıyor…</p>';
  try {
    let result;
    try {
      const response = await fetch(`/api/phl-candidates?${params}`);
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/json")) throw new Error("PHL API'si etkin değil.");
      result = await readApiJson(response);
    } catch (error) {
      result = await readPhlCandidatesFromCsv(query);
    }
    if (!result.available) {
      const missing = `<div class="phl-missing"><span class="eyebrow">PHL VERİ DOSYASI GEREKLİ</span><h3>PHL kataloğu yüklenemedi</h3><p>${escapeHtml(result.message)}</p><a class="primary-link" href="${escapeHtml(result.source_url)}" target="_blank" rel="noopener noreferrer">PHL veri sayfasını aç ↗</a><div><strong>Beklenen dosya:</strong> ${escapeHtml(result.expected_file)}</div></div>`;
      conservativeTarget.innerHTML = optimisticTarget.innerHTML = missing;
      $("phlCandidateSummary").textContent = "";
      return;
    }
    $("phlConservativeCount").textContent = result.conservative_count.toLocaleString("tr-TR");
    $("phlOptimisticCount").textContent = result.optimistic_count.toLocaleString("tr-TR");
    $("phlTotalCount").textContent = result.candidate_count.toLocaleString("tr-TR");
    $("phlCandidateSummary").textContent = `${result.candidate_count.toLocaleString("tr-TR")} aday · iki sınıf ayrı gösteriliyor · sınıf içi sıralama ESI’ye göre${result.fromCsvFallback ? " · yerel PHL CSV kullanıldı" : ""}`;
    conservativeTarget.innerHTML = renderPhlCandidateCards(result.conservative, "conservative");
    optimisticTarget.innerHTML = renderPhlCandidateCards(result.optimistic, "optimistic");
  } catch (error) {
    conservativeTarget.innerHTML = optimisticTarget.innerHTML = `<div class="planet-empty">PHL listesi yüklenemedi: ${escapeHtml(error.message || "Beklenmeyen bir hata oluştu.")}</div>`;
  }
}

// Senaryo kimliğini Türkçe ada çevirir.
function scenarioLabel(id) {
  return ({ surface: "Yüzey / kubbe", underground: "Yer altı", orbital: "Yörünge" })[id] || id;
}
