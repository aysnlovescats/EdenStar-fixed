const $ = id => document.getElementById(id);
const scoreWithRange = item => item.score == null ? "—" : `${item.score}/100`;
const scoreRangeNote = item => item?.score != null && item.score_max > item.score
  ? `Eksik ölçütler tam puan alsaydı teorik aralık: ${item.score}–${item.score_max}/100`
  : "";
const pageTitles = { overview: "Genel bakış", catalog: "Gezegen kataloğu", "phl-ranking": "PHL yaşanabilir adayları", rankings: "Senaryo sıralaması", scenarios: "Senaryo rehberi", "custom-planet": "Kendi gezegenim", comparison: "Karşılaştırma", "life-support": "Yaşam destek laboratuvarı", engineering: "Kolonizasyon mühendisliği", method: "Veri ve yöntem" };
const selectedForComparison = new Map();
let latestRankedRecords = [];
let activePage = "overview";
let catalogTimer = null;
let phlCandidateTimer = null;
let rankingTimer = null;
let customTimer = null;
let customRequest = 0;
let compareRequest = 0;
let engineeringDestinations = [];
let engineeringDestination = null;
let engineeringAnalysis = null;
let engineeringRequest = 0;
let engineeringListRequest = 0;
let engineeringTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function recordKey(record) {
  return `${record.host}|||${record.planet}`;
}

function updateCompareCount() {
  const count = selectedForComparison.size;
  $("compareCount").textContent = count;
  $("compareSelectedCount").textContent = count;
  $("compareSelectedButton").disabled = count < 2;
}

function detailUrl(record) {
  const params = new URLSearchParams({ host: record.host, planet: record.planet });
  return `system-view.html?${params}`;
}

function lifeSupportUrl(record) {
  const params = new URLSearchParams({ host: record.host, planet: record.planet });
  return `workspace.html?${params}#life-support`;
}

function renderPlanetPhl(phl = {}) {
  if (!phl || phl.not_applicable) return "";
  if (!phl.available) return `<div class="planet-phl"><strong>PHL</strong><span>Karşılaştırma için HWC CSV dosyası gerekli</span><a href="${escapeHtml(phl.source_url || "https://phl.upr.edu/hwc/data")}" target="_blank" rel="noopener noreferrer">Veri kaynağı ↗</a></div>`;
  if (!phl.matched) return `<div class="planet-phl"><strong>PHL</strong><span>${escapeHtml(phl.status || "Katalogda eşleşme yok")}</span><small>${escapeHtml(phl.caveat || "Eşleşme olmaması yaşanamazlık göstermez.")}</small></div>`;
  const esi = phl.esi == null ? "ESI verisi yok" : `ESI ${Number(phl.esi).toLocaleString("tr-TR", { maximumFractionDigits: 3 })}`;
  const zone = phl.conservative_zone == null && phl.optimistic_zone == null
    ? "Yaşanabilir bölge verisi yok"
    : `Bölge: konservatif ${phl.conservative_zone > 0 ? "evet" : "hayır"} · iyimser ${phl.optimistic_zone > 0 ? "evet" : "hayır"}`;
  return `<div class="planet-phl"><strong>PHL</strong><span>${escapeHtml(phl.status || "Aday durumu bilinmiyor")} · ${escapeHtml(esi)}</span><small>${escapeHtml(zone)}. ESI proje skoruyla aynı ölçekte değildir; aday etiketi yaşam kanıtı sayılmaz.</small></div>`;
}

function renderPlanetCard(record, { selectable = false } = {}) {
  const key = recordKey(record);
  const strengths = (record.strengths || []).map(item => `${escapeHtml(item.name)} <strong>${item.score}</strong>`).join(" · ") || "Yeterli ölçüt verisi yok";
  const missing = (record.missing || []).slice(0, 2);
  const missingText = missing.length ? `Eksik: ${missing.map(escapeHtml).join(", ")}${record.missing.length > 2 ? ` +${record.missing.length - 2}` : ""}` : "Senaryo ölçütlerinde veri mevcut";
  const checked = selectedForComparison.has(key) ? "checked" : "";
  const unavailable = !selectedForComparison.has(key) && selectedForComparison.size >= 3 ? "disabled" : "";
  return `<article class="planet-card">
    <header><span class="planet-glyph">${escapeHtml((record.planet || "?").slice(0, 1).toUpperCase())}</span><div class="planet-name"><h3 title="${escapeHtml(record.planet)}">${escapeHtml(record.planet)}${record.contested ? ' <small class="contested-mark" title="NASA arşivinde doğrulaması sorgulanmış">†</small>' : ""}</h3><p title="${escapeHtml(`${record.host} · ${record.planet_class}`)}">${escapeHtml(record.host)} · ${escapeHtml(record.planet_class)}</p></div><span class="score-pill">${record.score == null ? "—" : record.score}<small>/100 · kapsam %${record.coverage}</small>${scoreRangeNote(record) ? `<small class="score-range-note">${escapeHtml(scoreRangeNote(record))}</small>` : ""}</span></header>
    <div class="coverage-track" aria-label="Veri kapsamı yüzde ${record.coverage}"><i style="width:${Math.max(0, Math.min(100, Number(record.coverage) || 0))}%"></i></div>
    <div class="planet-card-detail"><div>Öne çıkan ölçütler: ${strengths}</div><div class="missing-note">${missingText}</div>${record.scope_note ? `<div class="missing-note">${escapeHtml(record.scope_note)}</div>` : ""}<div>Güven: <strong>${escapeHtml(record.confidence)}</strong></div>${record.contested ? '<div class="missing-note">† NASA kaydında doğrulama tartışmalı olarak işaretli.</div>' : ""}${renderPlanetPhl(record.phl)}</div>
    <div class="planet-card-actions"><a href="${detailUrl(record)}">Senaryo ayrıntısı ↗</a><a class="planet-mission-link" href="${lifeSupportUrl(record)}" title="Bu gezegenle yaşam destek simülasyonunu aç" aria-label="${escapeHtml(record.planet)} için yaşam destek simülasyonunu aç">↗</a>${selectable ? `<label><input type="checkbox" data-compare-key="${escapeHtml(key)}" ${checked} ${unavailable}> Karşılaştır</label>` : ""}</div>
  </article>`;
}

async function fetchRankings({ scenario = "surface", coverage = 30, query = "", limit = 100, population = "all" } = {}) {
  const params = new URLSearchParams({ scenario, min_coverage: String(coverage), q: query, limit: String(limit), population });
  const response = await fetch(`/api/rankings?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Sıralama alınamadı.");
  return data;
}

function renderPopulationGroups(results, { selectable = false, emptyText = "Bu grupta yeterli kapsamda sonuç yok." } = {}) {
  return `<div class="population-groups">${[
    ["solar", "Güneş Sistemi"], ["exoplanet", "Ötegezegenler"],
  ].map(([population, title]) => {
    const items = results.filter(item => item.population === population);
    return `<section class="population-section"><h3>${title}<small>${items.length} gösterilen</small></h3><div class="planet-grid">${items.length
      ? items.map(item => renderPlanetCard(item, { selectable })).join("")
      : `<div class="planet-empty">${emptyText}</div>`}</div></section>`;
  }).join("")}</div>`;
}

function showError(target, error) {
  target.innerHTML = `<div class="planet-empty">Veri yüklenemedi: ${escapeHtml(error.message)}<br><small>Uygulamanın Python sunucusunda çalıştığından emin ol.</small></div>`;
}

async function loadOverview() {
  const scenario = $("overviewScenario").value;
  const target = $("overviewTopList");
  target.innerHTML = '<p class="loading-state">Senaryo sıralaması hazırlanıyor…</p>';
  try {
    const [solar, exoplanets] = await Promise.all([
      fetchRankings({ scenario, coverage: 30, limit: 3, population: "solar" }),
      fetchRankings({ scenario, coverage: 30, limit: 3, population: "exoplanet" }),
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
      result = await response.json();
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

function scenarioLabel(id) {
  return ({ surface: "Yüzey / kubbe", underground: "Yer altı", orbital: "Yörünge" })[id] || id;
}

const ENGINEERING_PLANS = {
  surface: [
    { area: "Saha ölçümü", title: "Yüzey sıcaklığı, basınç ve atmosfer", requirement: "Gerçek yüzey koşullarını; gün/gece ve mevsim değişimleriyle ölç. Ötegezegen denge sıcaklığı yüzey sıcaklığının yerine geçmez.", maturity: "Hedefte doğrulanmalı", evidence: ["temperature", "surface_pressure_bar", "atmosphere_suitability"] },
    { area: "Yıldız ve jeoloji", title: "Uzun dönem çevresel kararlılık", requirement: "Yıldızın etkinliği ve gezegenin jeolojik döngüleri ayrıca incelenmeli. K tipi yıldız veya varsayılan tektonik aktivite tek başına yaşanabilirlik kanıtı değildir.", maturity: "Bu analizde değerlendirilmiyor", evidence: ["stellar_environment", "geology"] },
    { area: "Habitat", title: "Basınçlı kabuk ve ısı kontrolü", requirement: "İç basıncı ve yaşanabilir sıcaklığı koruyan, dış basınç ve sıcaklık döngülerine göre tasarlanmış kapalı habitat gerekir.", maturity: "Mühendislik tasarımı gerekir", evidence: ["surface_pressure_bar", "temperature"] },
    { area: "Radyasyon", title: "Habitat kalkanı", requirement: "Yerel radyasyon ölçümü, görev süresi ve kalkan malzemesi birlikte değerlendirilir. Regolit veya su kalkanı seçenek olabilir; tek bir kalınlık her hedef için geçerli değildir.", maturity: "Tasarım ve doz modellemesi gerekir", evidence: ["radiation", "local_site"] },
    { area: "Enerji", title: "Güç ve ısı atımı", requirement: "Yıldız enerjisi yalnızca ilk vekil bilgidir; iniş alanındaki toz, gölge, depolama ve sürekli güç ihtiyacı ayrıca modellenmelidir.", maturity: "Görev tasarımı gerekir", evidence: ["insolation", "local_site"] },
    { area: "Yerel kaynak", title: "ISRU: su ve yapı malzemesi", requirement: "Kaynağın varlığı kadar miktarı, erişilebilirliği, saflığı ve çıkarma enerjisi de ölçülmelidir. Katalogdaki gezegen verisi saha rezervini kanıtlamaz.", maturity: "Saha keşfi ve teknoloji doğrulaması", evidence: ["water", "local_site"] },
    { area: "Yaşam desteği", title: "Kapalı döngü hava, su ve gıda", requirement: "Atık, CO₂, su ve bitki üretimini döngüye bağla; yedek parça ve arıza durumlarını da hesaba kat.", maturity: "Araştırma / pilot sistemler", evidence: ["water"] },
  ],
  underground: [
    { area: "Saha keşfi", title: "Mağara veya kazılabilir bölge", requirement: "Boşluğun varlığı, konumu, boyutu, derinliği ve erişim rotası doğrudan haritalanmalı.", maturity: "Yerel keşif verisi gerekir", evidence: ["local_site"] },
    { area: "Jeoteknik", title: "Kaya dayanımı ve kararlılık", requirement: "Çökme, çatlak, sismik hareket, toz ve kazı/yapı yükleri saha ölçeğinde analiz edilmeli.", maturity: "Yerel keşif ve mühendislik analizi", evidence: ["geology", "local_site"] },
    { area: "Kaynaklar", title: "Yer altı sıcaklığı ve su", requirement: "Sıcaklık profili, buz/su miktarı ve çıkarma enerjisi bölgesel ölçümle belirlenmeli.", maturity: "Yerel ölçüm gerekir", evidence: ["geothermal", "water", "local_site"] },
    { area: "Radyasyon", title: "Derinliğe göre doğal kalkan", requirement: "Kaya/regolit örtüsü koruma sağlayabilir; gerçek doz örtü kalınlığı ve yerel radyasyon ölçümüyle hesaplanmalı.", maturity: "Doz modellemesi ve saha ölçümü", evidence: ["radiation", "local_site"] },
    { area: "Altyapı", title: "Basınç, hava dolaşımı ve kaçış", requirement: "Giriş/çıkış, yangın güvenliği, yedek güç, havalandırma ve acil kaçış yolları tasarlanmalı.", maturity: "Mühendislik tasarımı gerekir", evidence: ["local_site"] },
    { area: "Yaşam desteği", title: "Kapalı döngü hava, su ve gıda", requirement: "Uzun süreli yaşam için geri dönüşüm, üretim ve arıza toleransı birlikte planlanmalı.", maturity: "Araştırma / pilot sistemler", evidence: ["water"] },
  ],
  orbital: [
    { area: "Radyasyon", title: "Yörüngeye özgü doz ve kalkan", requirement: "Gezegenin ortalama değeri yörüngedeki doz değildir; yıldız etkinliği, yörünge, görev süresi ve kalkan modeli gerekir.", maturity: "Görev-özel modelleme gerekir", evidence: ["radiation", "orbit"] },
    { area: "Habitat", title: "Basınçlı modül ve yaşam desteği", requirement: "Basınç, hava yenileme, su geri kazanımı, yangın güvenliği ve yedekli sistemler gerekir.", maturity: "Uzay habitatı teknolojileri mevcut; görev tasarımı gerekir", evidence: ["local_site"] },
    { area: "Yörünge", title: "Mikro yerçekimi ve çarpışma riski", requirement: "Seçilecek yörünge, enkaz ve mikrometeorit ortamı, insan sağlığı ve bakım imkânıyla birlikte incelenmeli.", maturity: "Yörünge ve görev analizi gerekir", evidence: ["orbit"] },
    { area: "Enerji", title: "Güç ve ısı yönetimi", requirement: "Güneş enerjisi yörüngede gölgelenme ve yönelime bağlıdır; ısıyı uzaya atacak sistem de tasarlanmalı.", maturity: "Görev tasarımı gerekir", evidence: ["insolation", "orbit"] },
    { area: "Lojistik", title: "Ulaşım, ikmal ve onarım", requirement: "Dünya uzaklığı tek başına uçuş süresi, yakıt veya Δv değildir. Taşıma mimarisi ve ikmal planı ayrıca hesaplanmalı.", maturity: "Misyon mimarisi gerekir", evidence: ["access"] },
    { area: "Yaşam desteği", title: "Kapalı döngü kaynak kullanımı", requirement: "Su, oksijen ve gıda döngüsü; yedek parça, bakım ve acil durum kapasitesiyle boyutlandırılmalı.", maturity: "Araştırma / pilot sistemler", evidence: ["water"] },
  ],
  terraforming: [
    { area: "Gezegen envanteri", title: "Atmosfer ve uçucu madde bütçesi", requirement: "Atmosferin bileşimi/kütlesi, yüzey-altı su ve karbon kaynakları belirlenmeden dönüşüm kapasitesi hesaplanamaz.", maturity: "Gezegen-özel veri ve iklim modeli gerekir", evidence: ["surface_pressure_bar", "atmosphere_suitability", "water"] },
    { area: "İklim", title: "Isıtma ve sıvı su döngüsü", requirement: "Enerji ihtiyacı, iklim kararlılığı, suyun nerede ve ne kadar süre sıvı kalacağı modellenmeli.", maturity: "Araştırma / modelleme", evidence: ["temperature", "insolation", "water"] },
    { area: "Atmosfer kaybı", title: "Atmosferin uzun vadeli korunması", requirement: "Atmosfer kaybı, güneş rüzgârı, yerçekimi ve jeolojik kaynak yenilenmesi birlikte incelenmeli.", maturity: "Gezegen bilimi araştırması", evidence: ["gravity", "surface_pressure_bar"] },
    { area: "Yıldız ve jeoloji", title: "Yıldız etkinliği ve jeolojik döngüler", requirement: "Yıldız patlamaları, manyetik alan/atmosfer etkileşimi ve jeolojik gaz yenilenmesi için hedefe özgü uzun dönem verisi gerekir.", maturity: "Bu analizde değerlendirilmiyor", evidence: ["stellar_environment", "geology"] },
    { area: "Kavramsal çözüm", title: "Yapay manyetik kalkan önerisi", requirement: "Mars–L1 yapay dipolü erken aşama bir konsepttir; kurulabilirliği veya gezegeni yaşanabilir kılacağı kanıtlanmış değildir.", maturity: "Spekülatif konsept · hazır teknoloji değil", evidence: ["magnetosphere"] },
    { area: "Biyogüvenlik", title: "Ekosistem ve gezegen koruma", requirement: "Mikroorganizma/bitki ekleme fikri; ekolojik etkiler, geri döndürülebilirlik ve gezegen koruma kuralları değerlendirilmeden uygulanabilir sayılmaz.", maturity: "Araştırma ve yönetişim gerekir", evidence: ["biosafety"] },
  ],
};

function engineeringIndicator(analysis, key) {
  for (const scenario of analysis?.scenarios || []) {
    const match = (scenario.indicators || []).find(item => item.key === key);
    if (match) return match;
  }
  return null;
}

function engineeringEvidence(analysis, key) {
  const metrics = analysis?.metrics || {};
  if (key === "local_site") return "Yerel saha haritası bu gezegen-geneli veri kümesinde yok.";
  if (key === "stellar_environment") return "Yıldız etkinliği ve uzun dönem iklim kararlılığı bu analizde ölçülmüyor.";
  if (key === "orbit") return "Görev yörüngesi ve enkaz/radyasyon profili bu analizde yok.";
  if (key === "magnetosphere") return "Manyetik alan ve atmosfer kayıp hızı bu analizde yok.";
  if (key === "biosafety") return "Gezegen-geneli ölçümle belirlenemez; ayrı biyogüvenlik değerlendirmesi gerekir.";
  if (key === "temperature" && metrics.temperature_kind === "modeled_surface") {
    return `PHL modeli: Dünya benzeri atmosfer varsayımıyla tahmini yüzey sıcaklığı ${Number(metrics.temperature).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} K; ölçüm değil; puana katılmaz.`;
  }
  if (key === "temperature" && metrics.temperature_kind !== "surface") {
    return metrics.temperature == null
      ? "Gerçek yüzey sıcaklığı bilinmiyor."
      : `Denge sıcaklığı ${Number(metrics.temperature).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} K; gerçek yüzey sıcaklığı değil.`;
  }
  const indicator = engineeringIndicator(analysis, key);
  if (!indicator || indicator.value == null) return "Bu analizde ölçüm/veri yok.";
  const value = typeof indicator.value === "number"
    ? `${Number(indicator.value).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${indicator.unit || ""}`.trim()
    : String(indicator.value);
  const status = indicator.available ? "Analizde mevcut" : indicator.data_status || "Puanlamaya uygun ölçüm yok";
  return `${status} · ${value}`;
}

function engineeringFormat(value, digits = 2) {
  return value == null || !Number.isFinite(Number(value))
    ? "Bilinmiyor"
    : Number(value).toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

function renderEngineeringFacts(analysis, destination, approach) {
  const metrics = analysis.metrics || {};
  const isSolar = destination.host === "Güneş Sistemi";
  const noSolidSurface = isSolar && ["jüpiter", "satürn"].includes(destination.planet.toLocaleLowerCase("tr-TR"));
  const temperatureLabel = metrics.temperature == null ? "Sıcaklık"
    : metrics.temperature_kind === "surface" ? "Yaklaşık yüzey sıcaklığı"
    : metrics.temperature_kind === "modeled_surface" ? "PHL model sıcaklığı · ölçüm değil, puana katılmaz"
    : "Denge sıcaklığı · yüzey değil";
  const temperatureValue = metrics.temperature == null ? "Veri yok"
    : `${engineeringFormat(metrics.temperature, 1)} K · ${engineeringFormat(Number(metrics.temperature) - 273.15, 1)} °C`;
  const radiusKm = metrics.radius == null ? null : Number(metrics.radius) * 6371;
  const sphericalAreaKm2 = radiusKm == null ? null : 4 * Math.PI * radiusKm ** 2;
  const pressureValue = metrics.surface_pressure_bar != null
    ? `${engineeringFormat(metrics.surface_pressure_bar, 3)} bar`
    : isSolar && destination.planet.toLocaleLowerCase("tr-TR") === "ay"
      ? "Yakın vakum · NASA bağlamı, puan verisi değil"
      : "Veri yok";
  const facts = [
    ["Yarıçap", metrics.radius == null ? "Veri yok" : `${engineeringFormat(metrics.radius, 3)} Dünya yarıçapı · yaklaşık ${engineeringFormat(metrics.radius * 6371, 0)} km`],
    [noSolidSurface ? "Referans yarıçapı alanı" : "Küresel yüzey alanı", sphericalAreaKm2 == null ? "Veri yok" : `Yaklaşık ${engineeringFormat(sphericalAreaKm2, 0)} km² · yarıçaptan geometrik hesap`],
    ["Yerçekimi", metrics.gravity == null ? "Veri yok" : `${engineeringFormat(metrics.gravity, 3)} Dünya g · ${engineeringFormat(metrics.gravity * 9.81, 2)} m/s²`],
    [temperatureLabel, temperatureValue],
    ["Yüzey basıncı", pressureValue],
    ["Yıldız enerjisi", metrics.insolation == null ? "Veri yok" : `${engineeringFormat(metrics.insolation, 3)} Dünya akısı`],
    ["Atmosfer", metrics.atmosphere_summary || "Bileşim/solunabilirlik verisi yok"],
  ];
  const notes = [];
  if (noSolidSurface) {
    notes.push(`${destination.planet} için katı bir yüzey yerleşimi varsayılmamalı. Yüzey/kubbe puanı, gaz devinde kurulabilir yüzey habitatı anlamına gelmez; yörünge veya atmosferde yüzen platformlar ayrı görev konseptleridir.`);
  } else if (!isSolar && metrics.radius != null && metrics.radius >= 4) {
    notes.push(`Yarıçap ${engineeringFormat(metrics.radius, 2)} Dünya yarıçapı. Bu boyut sınıfı bileşimi tek başına belirlemez; kayalık yüzey ve yüzey koşulları doğrulanmadan yüzey kolonisi varsayma.`);
  }
  if (!noSolidSurface && metrics.surface_pressure_bar != null) {
    const deltaBar = Math.abs(1 - metrics.surface_pressure_bar);
    const direction = metrics.surface_pressure_bar > 1 ? "içe doğru sıkıştırma" : "dışa doğru basınç farkı";
    notes.push(`1 bar iç basınçlı habitat varsayımında dış basınç farkı yaklaşık ${engineeringFormat(deltaBar, 2)} bar (${engineeringFormat(deltaBar * 100, 0)} kPa), ${direction}. Bu basınç kabuğu için fiziksel yük göstergesidir; malzeme/şekil hesabı değildir.`);
  }
  if (metrics.gravity != null && metrics.gravity < 0.5) {
    notes.push(`Yerçekimi Dünya'nın yaklaşık %${engineeringFormat(metrics.gravity * 100, 0)}’i. İnsanlarda uzun süreli düşük yerçekimi etkileri ve yapıların yerel yükleri ayrıca ele alınmalı; bu veri tek başına güvenli eşik belirlemez.`);
  }
  if (isSolar && destination.planet.toLocaleLowerCase("tr-TR") === "mars") {
    notes.push("Mars'ta bazı bölgelerde yer altı su buzu biliniyor; bu katalog değeri seçilen iniş alanında erişilebilir su miktarını göstermez. Sondaj, buz saflığı ve çıkarma enerjisi için saha keşfi gerekir.");
  }
  if (isSolar && destination.planet.toLocaleLowerCase("tr-TR") === "venüs") {
    notes.push("Yüzey yerine yaklaşık 50 km irtifadaki bulut katmanında hava platformu NASA tarafından konsept olarak incelendi. Bu, doğrulanmış koloni çözümü değildir; asitli bulut, rüzgâr ve irtifa kontrolü ayrıca çözülmeli.");
  }
  if (isSolar && destination.planet.toLocaleLowerCase("tr-TR") === "titan") {
    notes.push("Titan'ın azot/metan ağırlıklı atmosferi ve yüksek basıncı solunabilir ortam anlamına gelmez. Çok düşük sıcaklık nedeniyle ısıtma ve su buzunu işleme gerekir; hidrokarbon gölleri su kaynağı değildir.");
  }
  if (isSolar && destination.planet.toLocaleLowerCase("tr-TR") === "ay") {
    notes.push("Ay için yakın vakum ve bölgeye göre aşırı gündüz/gece sıcaklıkları varsayılmalı; kutup gölgeli alanları ile aydınlık alanlar aynı saha koşuluna sahip değildir. Yerel harita ve sıcaklık döngüsü seçilmeden habitat yeri belirlenemez.");
  }
  if (metrics.temperature_kind === "modeled_surface" && metrics.temperature != null) {
    notes.push("Sıcaklık, Dünya benzeri atmosfer varsayan PHL modelinden geliyor; gerçek atmosfer ve sera etkisi bilinmiyor. Isıtma/soğutma boyutlandırması için ölçülmüş yüzey verisi gerekir. Bu değer skora katılmıyor.");
  } else if (metrics.temperature_kind !== "surface" && metrics.temperature != null) {
    notes.push("Katalogdaki sıcaklık denge sıcaklığıdır; yüzeydeki gerçek sıcaklık, atmosfer ve sera etkisi bilinmiyor. Isıtma/soğutma boyutlandırması için yeterli değil.");
  } else if (metrics.temperature != null && (metrics.temperature < 200 || metrics.temperature > 373.15)) {
    notes.push(`Yaklaşık yüzey sıcaklığı ${engineeringFormat(metrics.temperature, 1)} K. İnsan yaşamı için etkin ısıtma/soğutma ve yalıtım gerekir; ekipman yükü yerel gece-gündüz/mevsim ölçümüyle belirlenmeli.`);
  }
  if (metrics.insolation != null && metrics.insolation < 0.1) {
    notes.push(`Yıldız enerjisi Dünya'nın yaklaşık %${engineeringFormat(metrics.insolation * 100, 1)}’i. Güneş panelleri için konum, toz/gölge, depolama ve alternatif sürekli güç (ör. nükleer) ayrıca incelenmeli.`);
  } else if (metrics.insolation != null && metrics.insolation > 1.5) {
    notes.push(`Yıldız enerjisi Dünya'nın yaklaşık ${engineeringFormat(metrics.insolation, 1)} katı. Panel/ısı girdisi artabilir; atmosfer, gölge ve habitat ısı atımı yine ayrıca modellenmeli.`);
  }
  if (!notes.length) notes.push("Bu genel analiz hedefe özgü saha güvenliğini, malzeme rezervini veya habitat boyutunu doğrulamıyor; aşağıdaki gereksinimleri yerel ölçümle netleştir.");
  if (sphericalAreaKm2 != null) notes.push(`${noSolidSurface ? "Referans yarıçapından hesaplanan alan katı bir yüzey olduğunu göstermez. " : "Küresel alan yarıçaptan 4πr² ile türetilmiştir. "}Bu alan yerleşimin kaplayacağı alan değildir; koruyucu örtü miktarı hesabı aşağıdaki alana senin girdiğin habitat alanını kullanır.`);
  const context = noSolidSurface ? "Yüzey yerleşimi uygun bir varsayım değil" : "Gezegen verisinden çıkan mühendislik etkileri";
  $("engineeringFacts").innerHTML = `<section class="engineering-facts-panel"><div class="engineering-facts-heading"><div><span class="eyebrow">HEDEFE ÖZEL GİRDİLER</span><h3>${escapeHtml(destination.planet)} · ${escapeHtml(context)}</h3></div><small>${escapeHtml(analysis.source || "Veri kaynağı belirtilmedi")}</small></div><div class="engineering-fact-grid">${facts.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div><div class="engineering-implications"><strong>Bu hedef için ne ifade ediyor?</strong>${notes.map(note => `<p>${escapeHtml(note)}</p>`).join("")}</div></section>`;
  const calculator = $("engineeringCalculator");
  calculator.hidden = !(approach === "surface" || approach === "underground") || noSolidSurface;
  updateEngineeringCalculator();
}

function updateEngineeringCalculator() {
  const output = $("engineeringShieldOutput");
  if (!output || !engineeringAnalysis) return;
  const area = Number($("engineeringShieldArea").value);
  const depth = Number($("engineeringShieldDepth").value);
  const density = Number($("engineeringShieldDensity").value);
  if (![area, depth, density].every(Number.isFinite) || area <= 0 || depth <= 0 || density <= 0) {
    output.textContent = "Alan, kalınlık ve yoğunluk pozitif sayılar olmalı.";
    return;
  }
  const volume = area * depth;
  const massKg = volume * density;
  const gravityValue = engineeringAnalysis.metrics?.gravity;
  const gravity = gravityValue == null ? null : Number(gravityValue);
  const load = gravity != null && Number.isFinite(gravity) ? density * depth * gravity * 9.81 / 1000 : null;
  output.innerHTML = `<span><strong>${engineeringFormat(volume, 2)} m³</strong> yaklaşık örtü hacmi</span><span><strong>${engineeringFormat(massKg / 1000, 2)} ton</strong> yaklaşık malzeme kütlesi</span>${load == null ? "" : `<span><strong>${engineeringFormat(load, 2)} kPa</strong> ortalama taban yükü · seçilen gökcismi yerçekimiyle</span>`}`;
}

function engineeringActionSteps(item, analysis, destination) {
  const metrics = analysis.metrics || {};
  const pressure = metrics.surface_pressure_bar;
  const delta = pressure == null ? null : Math.abs(1 - pressure);
  const stepsByArea = {
    "Saha ölçümü": ["Aday iniş alanı belirle; küresel ortalamayı saha koşulu sayma.", "Yerel gün/gece ve mevsim sıcaklığı, atmosfer bileşimi ve basıncı ölç.", "Dozimetreyle radyasyon, regolit/toz ve erişilebilir suyu aynı bölgede haritala."],
    "Yıldız ve jeoloji": ["Yıldız etkinliği ve patlama sıklığına dair gözlemleri derle.", "Atmosfer kaybı, manyetik ortam ve jeolojik gaz döngüsü için hedefe özel model kur.", "K tipi yıldız veya varsayılan tektonik bilgisini kanıt yerine koyma."],
    "Habitat": [delta == null ? "Dış basınç ölçülmeden basınç kabuğu boyutlandırılamaz." : `1 bar iç basınç örneğinde yaklaşık ${engineeringFormat(delta, 2)} bar farkı taşıyacak kabuk hesabı yap.`, "Sıcaklık çevrimlerine göre yalıtım, ısıtma/soğutma ve atık ısı atımını boyutlandır.", "Bağlantılar, hava kilitleri ve acil yedeklerle basınç testini planla."],
    "Radyasyon": ["Hedef sahadaki parçacık türü ve doz hızını ölç veya görev yörüngesine göre modelle.", "Süre, görev sınırı ve kalkan malzemesine göre doz azaltımını uzman aracıyla hesapla.", "Bu sayfadaki hacim/kütle hesabını yalnızca malzeme lojistiği için kullan; doz garantisi sayma."],
    "Enerji": [metrics.insolation == null ? "Saha ışınımını ölç; yıldız katalog değeri yetmez." : `İlk kaynak göstergesi ${engineeringFormat(metrics.insolation, 3)} Dünya akısı; saha üretimini ayrıca ölç.`, "Gece/gölge/toz ve depolama kayıplarını ekle.", "Yaşam desteği ve ısıtma için sürekli yedek güç planla."],
    "Yerel kaynak": ["Sondaj/radar/örnek analizleriyle su ve yapı hammaddesini haritala.", "Konsantrasyon, saflık, erişilebilir derinlik ve çıkarma verimini ölç.", "Çıkarma, arıtma ve taşıma enerjisini elde edilecek kaynakla karşılaştır."],
    "Yaşam desteği": ["Mürettebat ve görev süresini belirle; su, oksijen ve gıda akışını hesapla.", "Geri dönüşüm oranı, kayıplar, yedekler ve arıza senaryolarını ekle.", "Pilot sistem verimini hedef gezegenin toz, sıcaklık ve yerçekimi koşullarında doğrula."],
    "Saha keşfi": ["Radar ve görüntülerden aday boşlukları çıkar; robotik keşifle giriş/çıkışı doğrula.", "Boyut, tavan kalınlığı, zemin ve erişim rotasını üç boyutlu haritala.", "İnsanlı görev öncesi robotik yapısal ve çevresel izleme yap."],
    "Jeoteknik": ["Yerel kaya/regolit örneklerinde dayanım, gözeneklilik ve aşınmayı ölç.", "Sismik/termal döngü, çatlak ve çökme riskini modelle.", "Habitat yükü ve kazı yöntemi için saha ölçekli mühendislik tasarımı hazırla."],
    "Kaynaklar": ["Sıcaklık derinlik profilini ve su/buz dağılımını doğrudan ölç.", "Buz/zemin çıkarma, arıtma ve ısıtma enerjisini hesapla.", "Kaynak sahası ile habitat arasındaki taşıma mesafesini plana ekle."],
    "Altyapı": ["Giriş, hava kilidi, yangın bölmeleri ve iki bağımsız kaçış rotası tasarla.", "Havalandırma, yedek güç ve arıza halinde güvenli kapanmayı doğrula.", "Yapı kurulduktan sonra basınç ve sızdırmazlık testleri yap."],
    "Yörünge": ["Yörünge, görev süresi ve güneş etkinliğine göre radyasyon dozunu modelle.", "Enkaz/mikrometeorit karşılaşmaları ve kaçınma kabiliyetini hesapla.", "Mikro yerçekimi insan sağlığı risklerini ve görev karşı önlemlerini planla."],
    "Lojistik": ["Hedef yörünge ve transfer profilini seç; uzaklık tek başına Δv değildir.", "Kalkış, varış, frenleme, iniş ve dönüş için ayrı itki bütçesi kur.", "İkmal, bakım, haberleşme gecikmesi ve acil dönüş seçeneklerini ekle."],
    "Gezegen envanteri": ["Atmosfer kütlesi/bileşimi ve yer altı uçucu madde envanterini çıkar.", "Mevcut doğal kaynak ile gerekli atmosfer/su miktarı arasındaki farkı hesapla.", "Envanter belirsizse dönüşüm hedefi veya süre iddiası verme."],
    "İklim": ["Enerji ve sera etkisi senaryolarını gezegen iklim modeliyle karşılaştır.", "Sıvı su kararlılığı, kaçış, donma ve buharlaşma döngülerini izle.", "Önce küçük ölçekli ve geri döndürülebilir saha deneyleri tanımla."],
    "Atmosfer kaybı": ["Atmosfer kaçış hızını ve güneş rüzgârı etkileşimini ölç/modelle.", "Manyetik alanı, yerçekimini, atmosfer bileşimini ve jeolojik yenilenmeyi beraber değerlendir.", "Bir kalkanın atmosferi geri oluşturacağını varsayma; ayrı mekanizmaları ölç."],
    "Kavramsal çözüm": ["Konseptin gerekli alan, güç, yapı kütlesi ve bakım gereksinimini tanımla.", "Atmosfer kaçışını azaltma ile atmosfer üretimini birbirinden ayır.", "Sonucu uygulanmış teknoloji değil, araştırma hipotezi olarak tut."],
    "Biyogüvenlik": ["Yerel kimya ve olası yerli yaşam kanıtlarını önce araştır.", "Mikroorganizma/bitki salımının geri döndürülemez ekolojik etkilerini değerlendir.", "Gezegen koruma ve biyogüvenlik kuralları onaylanmadan canlı salımı varsayma."],
    "Yıldızlararası ulaşım": ["Starshot benzeri ışık yelkenini yalnızca küçük insansız sonda konsepti olarak değerlendir.", "Koloni için gereken kütle, yavaşlama, iniş, yaşam desteği ve dönüşü ayrıca çöz.", "Toz çarpışmaları, haberleşme ve varışta yavaşlama risklerini görev tasarımına ekle."],
  };
  return stepsByArea[item.area] || ["Gerekli saha ölçümlerini ve veri kaynağını belirle.", "İhtiyaç duyulan malzeme, güç ve bakım miktarını varsayımlarıyla hesapla.", `${destination.planet} için çözümü yerel ortamda doğrula; bilinmeyenleri açıkça işaretle.`];
}

function renderEngineeringPage() {
  const target = $("engineeringChecklist");
  const overview = $("engineeringOverview");
  const destination = engineeringDestination;
  const analysis = engineeringAnalysis;
  if (!destination || !analysis) return;
  const approach = $("engineeringScenario").value;
  const plan = ENGINEERING_PLANS[approach] || ENGINEERING_PLANS.surface;
  const scenario = analysis.scenarios.find(item => item.id === approach);
  const scoreLine = scenario
    ? `<span>Mevcut doğal koşul ön elemesi: <strong>${scenario.score == null ? "Hesaplanamıyor" : `${scenario.score}/100`}</strong> · veri kapsamı %${scenario.coverage}</span>`
    : `<span>Dünyalaştırma için hesaplanmış uygunluk skoru yok; bu görünüm gereksinim/araştırma panosudur.</span>`;
  const distanceLabel = destination.destination_type === "exoplanet" && destination.distance_ly != null
    ? ` · ${Number(destination.distance_ly).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ışık yılı`
    : "";
  overview.innerHTML = `<div class="engineering-summary"><div><span class="eyebrow">SEÇİLİ HEDEF</span><h3>${escapeHtml(destination.planet)}</h3><p>${escapeHtml(destination.host)}${distanceLabel}</p></div><div class="engineering-summary-copy"><strong>${escapeHtml($("engineeringScenario").selectedOptions[0].textContent)}</strong>${scoreLine}<small>Bu skor altyapı olgunluğunu, görev başarısını veya koloninin kurulabilirliğini ölçmez.</small><a class="text-link" href="${lifeSupportUrl(destination)}">Bu hedefin yaşam destek simülasyonunu aç →</a></div></div>`;
  renderEngineeringFacts(analysis, destination, approach);
  const cards = [...plan];
  if (destination.destination_type === "exoplanet") cards.push({
    area: "Yıldızlararası ulaşım", title: "Sonda ile insanlı koloni görevini ayır", requirement: "Breakthrough Starshot yaklaşık 0,2 c hız fikrini gram ölçekli, mürettebatsız uçuş sondaları için inceler; insan, habitat veya koloni taşımacılığı çözümü değildir.", maturity: "Kavramsal sonda yaklaşımı · insanlı ulaşım çözümü yok", evidence: ["access"],
  });
  target.innerHTML = cards.map((item, index) => `<details class="engineering-card" ${index === 0 ? "open" : ""}><summary><span>${String(index + 1).padStart(2, "0")} · ${escapeHtml(item.area)}</span><i>${escapeHtml(item.maturity)}</i><h3>${escapeHtml(item.title)}</h3><small class="engineering-expand-label"><span class="engineering-open-label">Ayrıntıları aç</span><span class="engineering-close-label">Ayrıntıları gizle</span><b>⌄</b></small></summary><div class="engineering-card-body"><p>${escapeHtml(item.requirement)}</p><div class="engineering-evidence"><strong>Bu gezegendeki veri</strong>${item.evidence.map(key => `<span>${escapeHtml(engineeringEvidence(analysis, key))}</span>`).join("")}</div><div class="engineering-action-plan"><strong>İzlenecek mühendislik adımları</strong><ol>${engineeringActionSteps(item, analysis, destination).map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div></div></details>`).join("");
}

async function loadEngineeringDestinations(query = "") {
  const listRequest = ++engineeringListRequest;
  const select = $("engineeringDestination");
  select.innerHTML = '<option value="">Hedefler yükleniyor…</option>';
  try {
    const queryParams = new URLSearchParams({ limit: "1000" });
    if (query) queryParams.set("q", query);
    const response = await fetch(`/api/destinations?${queryParams}`);
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.results)) throw new Error(data.error || "Hedef listesi alınamadı.");
    if (listRequest !== engineeringListRequest) return;
    engineeringDestinations = data.results;
    if (!engineeringDestinations.length) {
      select.innerHTML = '<option value="">Eşleşen hedef yok</option>';
      engineeringDestination = null;
      engineeringAnalysis = null;
      $("engineeringOverview").innerHTML = '<div class="planet-empty">Aramayla eşleşen bir gezegen veya yıldız sistemi bulunamadı.</div>';
      $("engineeringChecklist").innerHTML = "";
      return;
    }
    select.innerHTML = engineeringDestinations.map((item, index) => `<option value="${index}">${escapeHtml(item.planet)} · ${escapeHtml(item.host)}${formatDestinationDistance(item)}</option>`).join("");
    const requestedParams = new URLSearchParams(window.location.search);
    const requestedPlanet = requestedParams.get("planet");
    const requestedHost = requestedParams.get("host");
    const requestedIndex = requestedPlanet ? engineeringDestinations.findIndex(item => item.planet.toLocaleLowerCase("tr-TR") === requestedPlanet.toLocaleLowerCase("tr-TR") && (!requestedHost || item.host.toLocaleLowerCase("tr-TR") === requestedHost.toLocaleLowerCase("tr-TR"))) : -1;
    const marsIndex = engineeringDestinations.findIndex(item => item.host === "Güneş Sistemi" && item.planet.toLocaleLowerCase("tr-TR") === "mars");
    const previousIndex = engineeringDestination ? engineeringDestinations.findIndex(item => item.host === engineeringDestination.host && item.planet === engineeringDestination.planet) : -1;
    select.value = String(previousIndex >= 0 ? previousIndex : requestedIndex >= 0 ? requestedIndex : query ? 0 : Math.max(0, marsIndex));
    engineeringDestination = engineeringDestinations[Number(select.value)] || null;
    await loadEngineeringAnalysis();
  } catch (error) {
    if (listRequest !== engineeringListRequest) return;
    $("engineeringOverview").innerHTML = `<div class="planet-empty">Hedefler yüklenemedi: ${escapeHtml(error.message)}</div>`;
    $("engineeringChecklist").innerHTML = "";
  }
}

async function loadEngineeringAnalysis() {
  const select = $("engineeringDestination");
  engineeringDestination = engineeringDestinations[Number(select.value)] || null;
  if (!engineeringDestination) return;
  const requestId = ++engineeringRequest;
  engineeringAnalysis = null;
  $("engineeringOverview").innerHTML = '<p class="loading-state">Gökcismi analiz ediliyor…</p>';
  $("engineeringChecklist").innerHTML = '<p class="loading-state">Gereksinimler hazırlanıyor…</p>';
  try {
    const params = new URLSearchParams({ host: engineeringDestination.host, planet: engineeringDestination.planet });
    const response = await fetch(`/api/analyze?${params}`);
    const analysis = await response.json();
    if (!response.ok) throw new Error(analysis.error || "Gezegen analizi alınamadı.");
    if (requestId !== engineeringRequest) return;
    engineeringAnalysis = analysis;
    renderEngineeringPage();
  } catch (error) {
    if (requestId !== engineeringRequest) return;
    $("engineeringOverview").innerHTML = `<div class="planet-empty">Analiz yüklenemedi: ${escapeHtml(error.message)}</div>`;
    $("engineeringChecklist").innerHTML = "";
  }
}

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

function renderComparisonCards(entries, scenarioId) {
  const results = entries.map(({ record, analysis }) => {
    const scenario = analysis.scenarios.find(item => item.id === scenarioId);
    const rows = scenario.indicators.map(item => {
      const value = item.value == null ? "Veri yok" : `${Number(item.value).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${item.unit}`;
      const contribution = item.contribution == null ? "Puan katkısı yok" : `Katkı: ${Number(item.contribution).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} puan`;
      return `<div class="compare-row"><span>${escapeHtml(item.name)} · ağırlık %${item.weight}</span><b>${item.score == null ? "Veri yok" : `${item.score}/100`}</b><small>${escapeHtml(value)} · ${escapeHtml(item.data_status || "Durum bilinmiyor")} · ${escapeHtml(contribution)}</small></div>`;
    }).join("");
    return `<article class="comparison-card"><header><h3>${escapeHtml(record.planet)}</h3><span class="compare-score">${scenario.score == null ? "Hesaplanamıyor" : scenario.score}<small>/100 · ${escapeHtml(record.host)} · kapsam %${scenario.coverage}</small>${scoreRangeNote(scenario) ? `<small class="score-range-note">${escapeHtml(scoreRangeNote(scenario))}</small>` : ""}</span></header>${rows}<p class="comparison-guidance-note">${escapeHtml(scenario.status)}</p><a class="text-link" href="${detailUrl(record)}">Ayrıntılı senaryo analizini aç →</a></article>`;
  }).join("");
  const guidance = entries[0]?.analysis.scenarios.find(item => item.id === scenarioId)?.guidance;
  const mixedPopulations = new Set(entries.map(({ record }) => record.population || (record.host === "Güneş Sistemi" ? "solar" : "exoplanet"))).size > 1;
  const comparabilityNote = mixedPopulations ? '<div class="ranking-explainer"><span>ⓘ</span><p>Güneş Sistemi yüzey sıcaklıkları ile ötegezegen denge sıcaklıkları aynı ölçüm değildir. Karma gruptaki toplam skorlar doğrudan karşılaştırılmamalı; ölçütleri ayrı inceleyin.</p></div>' : "";
  const guidanceText = guidance ? `<div class="ranking-explainer"><span>✓</span><p><strong>${scenarioLabel(scenarioId)} gereksinimleri:</strong> ${guidance.requirements.map(escapeHtml).join(" · ")}<br>${guidance.watchouts.map(escapeHtml).join(" ")}</p></div>` : "";
  return `${comparabilityNote}${guidanceText}${results}`;
}

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
      const analysis = await response.json();
      if (!response.ok) throw new Error(`${record.planet}: ${analysis.error || "Analiz alınamadı."}`);
      return { record, analysis };
    }));
    if (requestId !== compareRequest) return;
    target.innerHTML = renderComparisonCards(entries, scenarioId);
  } catch (error) {
    if (requestId === compareRequest) showError(target, error);
  }
}

function customHasValues(payload) {
  return Object.entries(payload).some(([key, value]) => key !== "name" && String(value ?? "").trim() !== "");
}

function formatCustomValue(indicator, payload) {
  if (indicator.value == null) return "Veri girilmedi";
  if (indicator.key === "temperature") return `${(Number(indicator.value) - 273.15).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} °C`;
  if (indicator.key === "atmosphere_suitability") return payload.atmosphere_status === "breathable" ? "Solunabilir kabul edildi" : "Solunamaz / zararlı kabul edildi";
  if (["radiation", "water", "geothermal", "geology"].includes(indicator.key)) return `${Number(indicator.value).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} / 1`;
  return `${Number(indicator.value).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${indicator.unit}`;
}

function renderCustomScenario(planetName, scenario, payload) {
  const score = scoreWithRange(scenario) === "—" ? "—" : scoreWithRange(scenario);
  const indicators = scenario.indicators.map(indicator => {
    const points = indicator.contribution == null ? "Katkı yok" : `Katkı ${Number(indicator.contribution).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
    return `<div class="custom-indicator-row"><span>${escapeHtml(indicator.name)} · %${indicator.weight}</span><b>${indicator.score == null ? "Veri yok" : `${indicator.score}/100`}</b><small>${escapeHtml(formatCustomValue(indicator, payload))} · ${escapeHtml(indicator.data_status)} · ${points}</small></div>`;
  }).join("");
  const risks = (scenario.critical_checks || []).filter(check => check.status === "risk").map(check => check.name);
  const riskNote = risks.length ? `<div class="custom-risk-note">Zorlu yüzey ölçütleri: ${risks.map(escapeHtml).join(", ")}. Puan otomatik olarak sıfırlanmaz; bu koşullar ayrıca değerlendirilmelidir.</div>` : "";
  return `<article class="custom-score-card"><header><div><h3>${escapeHtml(scenario.name)}</h3><small>${escapeHtml(planetName)}</small></div><span class="custom-score-value">${score}<small>veri kapsamı %${scenario.coverage}</small>${scoreRangeNote(scenario) ? `<small class="score-range-note">${escapeHtml(scoreRangeNote(scenario))}</small>` : ""}</span></header><p>${escapeHtml(scenario.status)}</p>${scenario.scope_note ? `<p class="missing-note">${escapeHtml(scenario.scope_note)}</p>` : ""}${indicators}${riskNote}</article>`;
}

async function loadCustomPlanetScores() {
  const form = $("customPlanetForm");
  const target = $("customPlanetResults");
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.name = String(payload.name || "").trim() || "Özel gezegen";
  try { localStorage.setItem("exohabitat-custom-planet-v1", JSON.stringify(payload)); } catch (_) {}
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
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Özel gezegen puanı hesaplanamadı.");
    if (requestId !== customRequest) return;
    target.innerHTML = result.scenarios.map(scenario => renderCustomScenario(result.planet, scenario, payload)).join("");
  } catch (error) {
    if (requestId === customRequest) showError(target, error);
  }
}

function scheduleCustomPlanetScores() {
  clearTimeout(customTimer);
  customTimer = setTimeout(loadCustomPlanetScores, 350);
}

function restoreCustomPlanet() {
  try {
    const saved = JSON.parse(localStorage.getItem("exohabitat-custom-planet-v1") || "null");
    if (!saved || typeof saved !== "object") return;
    Object.entries(saved).forEach(([name, value]) => {
      const input = $("customPlanetForm").elements.namedItem(name);
      if (input) input.value = value;
    });
    if (customHasValues(saved)) scheduleCustomPlanetScores();
  } catch (_) {}
}

const lifeSupportBaseline = { water: 29.56, oxygen: 0.83, food: 0.62 };
const speedOfLightKmS = 299792.458;
let lifeDestinations = [];
let lifeDestination = null;
let lifeTravelDays = null;
let lifeAnalysisRequest = 0;
let lifeSupportSupplyKg = 0;

function formatMass(value) {
  const kg = Number(value) || 0;
  if (kg >= 1e15) return `${kg.toExponential(2)} kg`;
  if (kg >= 10000) return `${(kg / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ton`;
  return `${kg.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} kg`;
}

function formatTravelDuration(days) {
  if (days == null || !Number.isFinite(days)) return "Hesaplanamıyor";
  if (days < 45) return `${Math.max(0, Math.round(days))} gün`;
  const years = days / 365.25;
  if (years >= 1) return `${years.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} yıl`;
  return `${(days / 30.4375).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ay`;
}

function estimateTravel(destination) {
  if (!destination) return { days: null, basis: "Hedef seçilmedi." };
  if (destination.destination_type === "solar-system") {
    const name = destination.planet.toLocaleLowerCase("tr-TR");
    if (name === "dünya") return { days: 0, basis: "Dünya referans noktası." };
    if (name === "ay") return { days: 3, basis: "Yaklaşık Dünya-Ay görev süresi; rota ve görev profili hesaplanmadı." };
    const au = Number(destination.orbit_au);
    if (!Number.isFinite(au) || au <= 0) return { days: null, basis: "Yörünge uzaklığı bulunamadı." };
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

function formatDestinationDistance(destination) {
  if (destination.distance_ly == null || !Number.isFinite(Number(destination.distance_ly))) return "";
  const distance = Number(destination.distance_ly);
  if (distance === 0) return " · 0 ışık yılı";
  if (distance < 0.001) return " · <0,001 ışık yılı";
  return ` · ${distance.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ışık yılı`;
}

function updateLifeJourney() {
  if (!lifeDestination) return;
  const estimate = estimateTravel(lifeDestination);
  lifeTravelDays = estimate.days;
  $("lifeTravelTime").textContent = formatTravelDuration(estimate.days);
  $("lifeTravelBasis").textContent = estimate.basis;
  $("lifeSpeedWrap").hidden = lifeDestination.destination_type !== "exoplanet";
  suggestLifeDeltaV();
}

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
    const departure = Math.abs(Math.sqrt(muSun * (2 / rEarth - 1 / transferAxis)) - Math.sqrt(muSun / rEarth));
    const arrival = Math.abs(Math.sqrt(muSun / rTarget) - Math.sqrt(muSun * (2 / rTarget - 1 / transferAxis)));
    return (departure + arrival) / 1000 * returnFactor;
  }
  const speed = Math.max(1, Number($("lifeCruiseSpeed").value) || 1);
  // A simplified lower bound: accelerate to cruise speed and decelerate at destination.
  if (!Number.isFinite(Number(lifeDestination.distance_ly)) || Number(lifeDestination.distance_ly) <= 0) return null;
  return speed * 2 * returnFactor;
}

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

function updateRocketEstimate() {
  const deltaVText = $("lifeMissionDeltaV").value.trim();
  const deltaVkmS = deltaVText === "" ? Number.NaN : Number(deltaVText);
  const dryAndFixedLoadKg = Number($("lifeVehicleMass").value) * 1000;
  const isp = Number($("lifeEngineIsp").value);
  const oxidizerFuelRatio = Number($("lifeOxFuelRatio").value);
  const outputs = ["lifePropellantTotal", "lifePropellantFuel", "lifePropellantOxidizer"];
  const note = $("lifePropellantNote");
  if (!Number.isFinite(deltaVkmS) || deltaVkmS < 0) {
    outputs.forEach(id => { $(id).textContent = "—"; });
    note.textContent = "Bu hedef için otomatik Δv önerisi yok; roket kütlesi tahmini için Δv değerini gir.";
    return;
  }
  if (!Number.isFinite(dryAndFixedLoadKg) || dryAndFixedLoadKg <= 0 || !Number.isFinite(isp) || isp <= 0 || !Number.isFinite(oxidizerFuelRatio) || oxidizerFuelRatio <= 0) {
    outputs.forEach(id => { $(id).textContent = "—"; });
    note.textContent = "Araç kütlesi, Isp ve oksijen/yakıt oranı pozitif değerler olmalı.";
    return;
  }
  const finalMassKg = dryAndFixedLoadKg + lifeSupportSupplyKg;
  const exponent = deltaVkmS * 1000 / (isp * 9.80665);
  if (!Number.isFinite(exponent) || exponent > 700) {
    outputs.forEach(id => { $(id).textContent = "Aşırı büyük"; });
    note.textContent = `Δv ${deltaVkmS.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} km/s için bu motor varsayımıyla tek kademeli ideal roket denklemi fiziksel olarak uygulanamaz büyüklükte itici madde veriyor.`;
    return;
  }
  const propellantKg = finalMassKg * Math.expm1(exponent);
  const fuelKg = propellantKg / (1 + oxidizerFuelRatio);
  const oxidizerKg = propellantKg - fuelKg;
  $("lifePropellantTotal").textContent = formatMass(propellantKg);
  $("lifePropellantFuel").textContent = formatMass(fuelKg);
  $("lifePropellantOxidizer").textContent = formatMass(oxidizerKg);
  const massRatio = Math.exp(exponent);
  const ratioText = massRatio >= 1e9 ? massRatio.toExponential(2) : massRatio.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  note.textContent = `Δv ${deltaVkmS.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} km/s · son kütle ${formatMass(finalMassKg)} (araç/yük + yaşam desteği) · ideal kütle oranı ${ratioText}. Çok büyük oranlar tek kademeli aracın pratik olmadığını gösterir.`;
}

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
    const analysis = await response.json();
    if (!response.ok) throw new Error(analysis.error || "Gezegen analizi alınamadı.");
    if (requestId !== lifeAnalysisRequest) return;
    const scenario = analysis.scenarios.find(item => item.id === $("lifeScenario").value);
    if (!scenario) throw new Error("Seçilen yerleşim senaryosu bulunamadı.");
    let travelInputsUpdated = false;
    if (destination.destination_type === "exoplanet" && destination.distance_ly == null) {
      destination.distance_ly = analysis.metrics?.access ?? null;
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
    let data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.results)) {
      response = await fetch("/api/rankings?scenario=surface&min_coverage=0&limit=200");
      data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Hedef listesi alınamadı.");
      lifeDestinations = (data.results || []).map(item => ({
        host: item.host,
        planet: item.planet,
        distance_ly: null,
        orbit_au: null,
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

function updateLifeSupport() {
  if (!$("lifeCrew")) return;
  const crew = Math.max(1, Number($("lifeCrew").value) || 1);
  const stayDays = Math.max(1, Number($("lifeDays").value) || 1);
  const waterRecovery = Number($("waterRecovery").value) / 100;
  const oxygenRecovery = Number($("oxygenRecovery").value) / 100;
  const foodProduction = Number($("foodProduction").value) / 100;
  const returnLegs = $("lifeIncludeReturn").checked ? 2 : 1;
  const transitDays = lifeTravelDays == null ? 0 : lifeTravelDays * returnLegs;
  const totalCrewDays = crew * (transitDays + stayDays);
  const travelCrewDays = crew * transitDays;
  const habitatCrewDays = crew * stayDays;
  $("waterRecoveryLabel").value = `${Math.round(waterRecovery * 100)}%`;
  $("oxygenRecoveryLabel").value = `${Math.round(oxygenRecovery * 100)}%`;
  $("foodProductionLabel").value = `${Math.round(foodProduction * 100)}%`;

  const items = [
    { id: "Water", label: "Su", daily: lifeSupportBaseline.water * (1 - waterRecovery), travel: lifeSupportBaseline.water * (1 - waterRecovery) * travelCrewDays, habitat: lifeSupportBaseline.water * (1 - waterRecovery) * habitatCrewDays },
    { id: "Oxygen", label: "Oksijen", daily: lifeSupportBaseline.oxygen * (1 - oxygenRecovery), travel: lifeSupportBaseline.oxygen * (1 - oxygenRecovery) * travelCrewDays, habitat: lifeSupportBaseline.oxygen * (1 - oxygenRecovery) * habitatCrewDays },
    { id: "Food", label: "Gıda", daily: lifeSupportBaseline.food * (1 - foodProduction), travel: lifeSupportBaseline.food * travelCrewDays, habitat: lifeSupportBaseline.food * (1 - foodProduction) * habitatCrewDays },
  ].map(item => ({ ...item, mission: item.travel + item.habitat, fraction: totalCrewDays ? (item.travel + item.habitat) / (lifeSupportBaseline[item.id.toLowerCase()] * totalCrewDays) : 0 }));
  const total = items.reduce((sum, item) => sum + item.mission, 0);
  $("lifeTotalResupply").textContent = formatMass(total);
  const travelLabel = lifeTravelDays == null ? "yolculuk süresi bilinmiyor" : `${formatTravelDuration(transitDays)} yolculuk`;
  $("lifeMissionSummary").textContent = `${crew.toLocaleString("tr-TR")} kişi · ${travelLabel} · ${stayDays.toLocaleString("tr-TR")} gün kalış${lifeTravelDays == null ? " · ikmal hesabına yolculuk dahil değil" : ""}`;
  for (const item of items) {
    $(`life${item.id}Resupply`).textContent = formatMass(item.mission);
    $(`life${item.id}Daily`).textContent = `Yolculuk ${formatMass(item.travel)} · Hedefte ${formatMass(item.habitat)}`;
    $(`life${item.id}Track`).style.width = `${Math.max(0, Math.min(100, item.fraction * 100))}%`;
  }
  const bottleneck = [...items].sort((a, b) => b.mission - a.mission)[0];
  $("lifeBottleneck").textContent = total > 0
    ? `Bu varsayımlarla en büyük ikmal kalemi ${bottleneck.label.toLocaleLowerCase("tr-TR")} (${formatMass(bottleneck.mission)}). Bu yalnızca kütle karşılaştırmasıdır; depolama hacmi, enerji ve sistem donanımını hesaba katmaz.`
    : "Seçtiğin varsayımlarda su, oksijen ve gıda için dış ikmal gerekmiyor görünüyor. Bu idealize edilmiş sonuç sistem kayıplarını ve yedekleri kapsamaz.";
  lifeSupportSupplyKg = total;
  updateRocketEstimate();
}

function setPage(page) {
  activePage = pageTitles[page] ? page : "overview";
  $("pageTitle").textContent = pageTitles[activePage];
  document.querySelectorAll(".workspace-page").forEach(section => { section.hidden = section.id !== `page-${activePage}`; });
  document.querySelectorAll(".workspace-nav [data-page]").forEach(link => {
    const active = link.dataset.page === activePage;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
  if (activePage === "overview") loadOverview();
  if (activePage === "catalog") loadCatalog();
  if (activePage === "phl-ranking") loadPhlCandidates();
  if (activePage === "rankings") loadRankings();
  if (activePage === "custom-planet") loadCustomPlanetScores();
  if (activePage === "comparison") loadComparison();
  if (activePage === "life-support") {
    if (!lifeDestinations.length) loadLifeSupportDestinations();
    else { updateLifeJourney(); updateLifeSupport(); }
  }
  if (activePage === "engineering") {
    if (!engineeringDestinations.length) loadEngineeringDestinations();
    else if (engineeringAnalysis) renderEngineeringPage();
  }
}

window.addEventListener("hashchange", () => setPage(window.location.hash.slice(1)));
$("overviewScenario").addEventListener("change", loadOverview);
$("catalogScenario").addEventListener("change", loadCatalog);
$("catalogCoverage").addEventListener("change", loadCatalog);
$("catalogSearch").addEventListener("input", () => { clearTimeout(catalogTimer); catalogTimer = setTimeout(loadCatalog, 250); });
$("phlCandidateSearch").addEventListener("input", () => { clearTimeout(phlCandidateTimer); phlCandidateTimer = setTimeout(loadPhlCandidates, 250); });
$("rankingScenario").addEventListener("change", loadRankings);
$("rankingCoverage").addEventListener("change", loadRankings);
$("rankingSearch").addEventListener("input", () => { clearTimeout(rankingTimer); rankingTimer = setTimeout(loadRankings, 250); });
document.querySelectorAll("[data-guide-scenario]").forEach(button => button.addEventListener("click", () => {
  $("rankingScenario").value = button.dataset.guideScenario;
  if (activePage === "rankings") loadRankings();
  window.location.hash = "rankings";
}));
$("rankingResults").addEventListener("change", event => {
  const input = event.target.closest("input[data-compare-key]");
  if (!input) return;
  const record = latestRankedRecords.find(item => recordKey(item) === input.dataset.compareKey);
  if (input.checked && selectedForComparison.size < 3 && record) selectedForComparison.set(recordKey(record), record);
  else selectedForComparison.delete(input.dataset.compareKey);
  updateCompareCount();
  if (activePage === "rankings") loadRankings();
  if (activePage === "comparison") loadComparison();
});
$("compareSelectedButton").addEventListener("click", () => { window.location.hash = "comparison"; });
$("comparisonScenario").addEventListener("change", loadComparison);
$("customPlanetForm").addEventListener("input", scheduleCustomPlanetScores);
$("customPlanetForm").addEventListener("change", scheduleCustomPlanetScores);
$("customPlanetForm").addEventListener("submit", event => { event.preventDefault(); loadCustomPlanetScores(); });
$("resetCustomPlanet").addEventListener("click", () => {
  $("customPlanetForm").reset();
  localStorage.removeItem("exohabitat-custom-planet-v1");
  customRequest++;
  $("customPlanetResults").innerHTML = '<div class="custom-empty"><span>✧</span><h3>Henüz değer girilmedi</h3><p>Bir veya daha fazla alan doldur; senaryo puanları ve veri kapsamı burada görünsün.</p></div>';
});

$("lifeSupportForm").addEventListener("input", updateLifeSupport);
$("lifeSupportForm").addEventListener("change", updateLifeSupport);
$("lifeDestination").addEventListener("change", () => {
  lifeDestination = lifeDestinations[Number($("lifeDestination").value)] || null;
  suggestLifeDeltaV(true);
  updateLifeJourney();
  updateLifeSupport();
  loadLifeSupportDestinationAnalysis();
});
$("lifeScenario").addEventListener("change", loadLifeSupportDestinationAnalysis);
$("engineeringSearch").addEventListener("input", () => {
  clearTimeout(engineeringTimer);
  engineeringTimer = setTimeout(() => loadEngineeringDestinations($("engineeringSearch").value.trim()), 300);
});
$("engineeringDestination").addEventListener("change", loadEngineeringAnalysis);
$("engineeringScenario").addEventListener("change", renderEngineeringPage);
["engineeringShieldArea", "engineeringShieldDepth", "engineeringShieldDensity"].forEach(id => $(id).addEventListener("input", updateEngineeringCalculator));
$("lifeCruiseSpeed").addEventListener("input", () => { updateLifeJourney(); updateLifeSupport(); });
$("lifeIncludeReturn").addEventListener("change", () => { suggestLifeDeltaV(); updateLifeSupport(); });
$("lifeMissionDeltaV").addEventListener("input", () => {
  $("lifeMissionDeltaV").dataset.userEdited = "true";
  updateRocketEstimate();
});
["lifeVehicleMass", "lifeEngineIsp", "lifeOxFuelRatio"].forEach(id => $(id).addEventListener("input", updateRocketEstimate));

restoreCustomPlanet();
updateCompareCount();
setPage(window.location.hash.slice(1) || "overview");
