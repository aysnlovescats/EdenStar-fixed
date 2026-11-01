// Ortak yardımcılar, sayfa durumu ve gezegen kartları.

// Kısayol: id ile sayfa elemanını bul.
const $ = id => document.getElementById(id);
// Puan metni ('57/100' veya puan yoksa '—').
const scoreWithRange = item => item.score == null ? "—" : `${item.score}/100`;
// Puan bir aralıksa olası alt–üst sınır notunu üretir.
const scoreRangeNote = item => item?.score_min != null && item.score_max > item.score_min
  ? `Bilinmeyen ölçütlerle olası aralık: ${item.score_min}–${item.score_max}/100`
  : "";
// Varsayımsal model aralığını metne çevirir.
const modelRangeText = model => model?.score_min == null
  ? "hesaplanamıyor"
  : model.score_max > model.score_min ? `${model.score_min}–${model.score_max}/100` : `${model.score_min}/100`;
// Sayfa kimliği → başlıkta görünen ad.
const pageTitles = { overview: "Genel bakış", catalog: "Gezegen kataloğu", "phl-ranking": "PHL yaşanabilir adayları", rankings: "Senaryo sıralaması", scenarios: "Senaryo rehberi", "custom-planet": "Kendi gezegenim", comparison: "Karşılaştırma", "life-support": "Yaşam destek laboratuvarı", engineering: "Kolonizasyon mühendisliği", method: "Veri ve yöntem" };
// Sayfa durumu: karşılaştırma için seçilenler (en fazla 3), son sıralama, açık sayfa, arama zamanlayıcıları
// ve istek sayaçları (eski yanıtların yenisinin üzerine yazmasını önler).
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

// Metindeki &, <, >, ", ' karakterlerini kaçışlar; dış veriden gelen metin sayfada kod olarak çalışamaz (XSS önlemi).
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

// API yanıtını JSON olarak okur; sunucu HTML hata sayfası döndürdüyse anlaşılır bir hata verir.
async function readApiJson(response) {
  const body = await response.text();
  try { return JSON.parse(body); }
  catch (_) { throw new Error("Sunucu JSON yerine HTML yanıtı verdi. Python sunucusunu yeniden başlatıp tekrar deneyin."); }
}

// Bir kaydı 'yıldız|||gezegen' biçiminde benzersiz anahtara çevirir (karşılaştırma seçimi için).
function recordKey(record) {
  return `${record.host}|||${record.planet}`;
}

// Karşılaştırma için seçili cisim sayısını menüde ve düğmede günceller; 2'den azsa düğmeyi kapatır.
function updateCompareCount() {
  const count = selectedForComparison.size;
  $("compareCount").textContent = count;
  $("compareSelectedCount").textContent = count;
  $("compareSelectedButton").disabled = count < 2;
}

// Cismin sistem görünümü bağlantısı: system-view.html?host=...&planet=...
function detailUrl(record) {
  const params = new URLSearchParams({ host: record.host, planet: record.planet });
  return `system-view.html?${params}`;
}

// Cismi yaşam destek simülatöründe açan bağlantı.
function lifeSupportUrl(record) {
  const params = new URLSearchParams({ host: record.host, planet: record.planet });
  return `workspace.html?${params}#life-support`;
}

// Gezegen kartındaki küçük PHL bölümü (aday durumu ve ESI).
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

// Katalog ve sıralamadaki gezegen kartı: puan, kapsam çubuğu, güçlü ölçütler, eksik veriler,
// bağlantılar ve (istenirse) karşılaştırma kutusu.
function renderPlanetCard(record, { selectable = false } = {}) {
  const key = recordKey(record);
  const strengths = (record.strengths || []).map(item => `${escapeHtml(item.name)} <strong>${item.score}</strong>`).join(" · ") || "Yeterli ölçüt verisi yok";
  const missing = (record.missing || []).slice(0, 2);
  const missingText = missing.length ? `Eksik: ${missing.map(escapeHtml).join(", ")}${record.missing.length > 2 ? ` +${record.missing.length - 2}` : ""}` : "Senaryo ölçütlerinde veri mevcut";
  const checked = selectedForComparison.has(key) ? "checked" : "";
  const unavailable = !selectedForComparison.has(key) && selectedForComparison.size >= 3 ? "disabled" : "";
  return `<article class="planet-card">
    <header><span class="planet-glyph">${escapeHtml((record.planet || "?").slice(0, 1).toUpperCase())}</span><div class="planet-name"><h3 title="${escapeHtml(record.planet)}">${escapeHtml(record.planet)}${record.contested ? ' <small class="contested-mark" title="NASA arşivinde doğrulaması sorgulanmış">†</small>' : ""}</h3><p title="${escapeHtml(`${record.host} · ${record.planet_class}`)}">${escapeHtml(record.host)} · ${escapeHtml(record.planet_class)}</p></div><span class="score-pill">${record.score == null ? "—" : record.score}<small>${Number(record.coverage) === 0 ? '<i class="no-data-badge">VERİ YOK</i> · puan 0 kabul edildi' : "Bilinen ölçüt puanı /100"} · kapsam %${record.coverage}</small>${scoreRangeNote(record) ? `<small class="score-range-note">${escapeHtml(scoreRangeNote(record))}</small>` : ""}</span></header>
    <div class="coverage-track" aria-label="Veri kapsamı yüzde ${record.coverage}"><i style="width:${Math.max(0, Math.min(100, Number(record.coverage) || 0))}%"></i></div>
    <div class="planet-card-detail"><div>Öne çıkan ölçütler: ${strengths}</div><div class="missing-note">${missingText}</div>${record.scope_note ? `<div class="missing-note">${escapeHtml(record.scope_note)}</div>` : ""}${record.applicability_note ? `<div class="missing-note">${escapeHtml(record.applicability_note)}</div>` : ""}<div>Güven: <strong>${escapeHtml(record.confidence)}</strong></div>${record.contested ? '<div class="missing-note">† NASA kaydında doğrulama tartışmalı olarak işaretli.</div>' : ""}${renderPlanetPhl(record.phl)}</div>
    <div class="planet-card-actions"><a href="${detailUrl(record)}">Senaryo ayrıntısı ↗</a><a class="planet-mission-link" href="${lifeSupportUrl(record)}" title="Bu gezegenle yaşam destek simülasyonunu aç" aria-label="${escapeHtml(record.planet)} için yaşam destek simülasyonunu aç">↗</a>${selectable ? `<label><input type="checkbox" data-compare-key="${escapeHtml(key)}" ${checked} ${unavailable}> Karşılaştır</label>` : ""}</div>
  </article>`;
}

// /api/rankings'ten sıralı listeyi alır (senaryo, en az kapsam, arama, sonuç sayısı, gök cismi grubu).
async function fetchRankings({ scenario = "surface", coverage = 0, query = "", limit = 100, population = "all" } = {}) {
  const params = new URLSearchParams({ scenario, min_coverage: String(coverage), q: query, limit: String(limit), population });
  const response = await fetch(`/api/rankings?${params}`);
  const data = await readApiJson(response);
  if (!response.ok) throw new Error(data.error || "Sıralama alınamadı.");
  return data;
}

// Sonuçları 'Güneş Sistemi' ve 'Ötegezegenler' olarak iki grupta gösterir.
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

// Veri yüklenemezse hedef alana hata mesajı yazar.
function showError(target, error) {
  target.innerHTML = `<div class="planet-empty">Veri yüklenemedi: ${escapeHtml(error.message)}<br><small>Uygulamanın Python sunucusunda çalıştığından emin ol.</small></div>`;
}
