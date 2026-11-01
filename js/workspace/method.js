// Veri ve yöntem sayfası: proje puanı ile PHL ESI tutarlılık grafiği.

const esiConsistencyCache = new Map();
let esiRequest = 0;
let esiPlot = null;

const esiChart = { width: 720, height: 380, left: 48, right: 16, top: 14, bottom: 44, yMax: 100 };
const esiGroups = [
  { id: "other", match: point => point.phl_class !== 1 && point.phl_class !== 2 },
  { id: "optimistic", match: point => point.phl_class === 2 },
  { id: "conservative", match: point => point.phl_class === 1 },
];

// PHL sınıf numarasını Türkçe etikete çevirir.
function esiPhlLabel(phlClass) {
  if (phlClass === 1) return "PHL konservatif aday";
  if (phlClass === 2) return "PHL iyimser aday";
  return "PHL adayı değil";
}

// ρ değerini sözle anlatır: |ρ| < 0,1 yok, < 0,3 zayıf, < 0,5 orta, < 0,7 belirgin, üstü güçlü.
function esiStrengthText(rho) {
  const size = Math.abs(rho);
  const direction = rho >= 0 ? "pozitif" : "negatif";
  if (size < 0.1) return "Belirgin bir sıra ilişkisi yok";
  if (size < 0.3) return `Zayıf ${direction} ilişki`;
  if (size < 0.5) return `Orta düzeyde ${direction} ilişki`;
  if (size < 0.7) return `Belirgin ${direction} ilişki`;
  return `Güçlü ${direction} ilişki`;
}

// Senaryoya göre 'nasıl okunur?' açıklaması.
function esiScenarioReading(scenarioId) {
  if (scenarioId === "orbital") return "Yörünge puanı yıldız enerjisi, kaçış hızı ve Hill penceresine dayanır; Dünya benzerliğini ölçmediği için ESI ile ilişki beklenmez.";
  if (scenarioId === "underground") return "Yer altı ağırlığının çoğu (jeoloji, su, radyasyon) ötegezegenlerde ölçülmediği için puan yalnızca küçük bir ağırlık payına dayanır; ilişki zayıf kalır.";
  return "Kubbe puanı ESI ile ortak boyutları (yarıçap, yerçekimi, yıldız enerjisi) kullanır, ayrıca basınç ve atmosferi ister ve eksik veriyi 0 sayar; bu yüzden orta düzey bir uyum beklenir.";
}

// Veri değerini SVG koordinatına çevirir: esiX → ESI (0–1) yatay konum, esiY → puan (0–yMax) dikey konum.
function esiX(esi) {
  return esiChart.left + esi * (esiChart.width - esiChart.left - esiChart.right);
}

function esiY(score) {
  return esiChart.top + (1 - score / esiChart.yMax) * (esiChart.height - esiChart.top - esiChart.bottom);
}

// Bir noktayı çizer: konservatif aday karo, iyimser aday büyük daire, diğerleri küçük gri daire.
function esiMark(point, group) {
  const x = esiX(point.esi).toFixed(1);
  const y = esiY(point.score).toFixed(1);
  if (group === "conservative") {
    const r = 5.5;
    return `<path class="esi-dot esi-dot-conservative" d="M${x} ${(y - r).toFixed(1)}L${(+x + r).toFixed(1)} ${y}L${x} ${(+y + r).toFixed(1)}L${(x - r).toFixed(1)} ${y}Z"/>`;
  }
  return `<circle class="esi-dot esi-dot-${group}" cx="${x}" cy="${y}" r="${group === "optimistic" ? 4.5 : 2.5}"/>`;
}

// Dağılım grafiğini SVG olarak çizer: ızgara, eksenler ve noktalar (önce gri, adaylar üstte).
function renderEsiChart(data) {
  const chart = $("esiCheckChart");
  // Puanlar çoğu senaryoda 100'e yaklaşmaz; ekseni verinin üstündeki ilk 10'un katına kadar çiz.
  esiChart.yMax = Math.min(100, Math.max(10, Math.ceil(Math.max(0, ...data.points.map(point => point.score)) / 10) * 10));
  const { width, height, left, right, top, bottom, yMax } = esiChart;
  const yStep = yMax <= 50 ? 10 : 25;
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, index) => index * yStep);
  const grid = yTicks.map(score => `<line class="esi-grid" x1="${left}" x2="${width - right}" y1="${esiY(score)}" y2="${esiY(score)}"/><text x="${left - 8}" y="${esiY(score) + 3}" text-anchor="end">${score}</text>`).join("");
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(esi => `<text x="${esiX(esi)}" y="${height - bottom + 16}" text-anchor="middle">${esi.toLocaleString("tr-TR")}</text>`).join("");
  const marks = esiGroups.map(group => `<g>${data.points.filter(group.match).map(point => esiMark(point, group.id)).join("")}</g>`).join("");
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${grid}<line class="esi-axis" x1="${left}" x2="${width - right}" y1="${esiY(0)}" y2="${esiY(0)}"/>${ticks}<text x="${(left + width - right) / 2}" y="${height - 6}" text-anchor="middle">Dünya Benzerlik İndeksi (ESI, PHL)</text><text transform="translate(12 ${(top + height - bottom) / 2}) rotate(-90)" text-anchor="middle">Proje puanı (/100)</text>${marks}<circle id="esiFocus" class="esi-focus" r="8" visibility="hidden"/></svg>`;
  esiPlot = { svg: chart.querySelector("svg"), points: data.points };
}

// İmlece en yakın noktayı bulur (14 piksel içinde); binlerce noktaya ayrı fare olayı bağlamak yerine bu kullanılır.
function nearestEsiPoint(event) {
  const box = esiPlot.svg.getBoundingClientRect();
  const scale = box.width / esiChart.width;
  const x = (event.clientX - box.left) / scale;
  const y = (event.clientY - box.top) / scale;
  let best = null;
  let bestDistance = 14 / scale;
  for (const point of esiPlot.points) {
    const distance = Math.hypot(esiX(point.esi) - x, esiY(point.score) - y);
    if (distance < bestDistance) { best = point; bestDistance = distance; }
  }
  return best;
}

// İmleç bir noktanın yakınındaysa ipucunu (ad, ESI, puan, kapsam) gösterir ve noktayı halkayla işaretler.
function showEsiTooltip(event) {
  const tooltip = $("esiCheckTooltip");
  const focus = $("esiFocus");
  const point = esiPlot && nearestEsiPoint(event);
  esiPlot?.svg.classList.toggle("is-pointing", !!point);
  if (!point) {
    tooltip.hidden = true;
    focus?.setAttribute("visibility", "hidden");
    return;
  }
  focus.setAttribute("cx", esiX(point.esi));
  focus.setAttribute("cy", esiY(point.score));
  focus.setAttribute("visibility", "visible");
  tooltip.innerHTML = `<strong>${escapeHtml(point.planet)}</strong><span>${escapeHtml(point.host)}</span><dl><dt>ESI</dt><dd>${point.esi.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</dd><dt>Proje puanı</dt><dd>${point.score}/100</dd><dt>Veri kapsamı</dt><dd>%${point.coverage}</dd></dl><small>${esiPhlLabel(point.phl_class)} · ayrıntı için tıkla</small>`;
  tooltip.hidden = false;
  const wrap = tooltip.parentElement.getBoundingClientRect();
  const flip = event.clientX - wrap.left > wrap.width - 220;
  tooltip.style.left = `${event.clientX - wrap.left + (flip ? -16 : 16)}px`;
  tooltip.style.top = `${event.clientY - wrap.top + 12}px`;
  tooltip.style.transform = flip ? "translateX(-100%)" : "none";
}

function hideEsiTooltip() {
  $("esiCheckTooltip").hidden = true;
  $("esiFocus")?.setAttribute("visibility", "hidden");
}

// Tıklanan noktanın gezegenini sistem görünümünde açar.
function openEsiPoint(event) {
  const point = esiPlot && nearestEsiPoint(event);
  if (point) window.location.href = detailUrl(point);
}

// Tablo görünümü: PHL adaylarını ESI'ye göre sıralı listeler (grafiği göremeyenler için de erişilebilir).
function renderEsiTable(points) {
  const candidates = points.filter(point => point.phl_class === 1 || point.phl_class === 2).sort((a, b) => b.esi - a.esi);
  const table = $("esiCheckTable");
  table.querySelector("summary").textContent = `Tablo görünümü: PHL adayları (${candidates.length})`;
  table.querySelector("div").innerHTML = candidates.length
    ? `<table><thead><tr><th>Gezegen</th><th>PHL sınıfı</th><th>ESI</th><th>Proje puanı</th><th>Kapsam</th></tr></thead><tbody>${candidates.map(point => `<tr><td><a href="${detailUrl(point)}">${escapeHtml(point.planet)}</a></td><td>${point.phl_class === 1 ? "Konservatif" : "İyimser"}</td><td>${point.esi.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td><td>${point.score}</td><td>%${point.coverage}</td></tr>`).join("")}</tbody></table>`
    : "<p>Bu senaryoda puanı olan PHL adayı yok.</p>";
}

// Özet kutuları (ρ, gezegen sayısı, nasıl okunur), grafik ve tabloyu çizer.
function renderEsiConsistency(data, scenarioId) {
  if (!data.available) {
    $("esiCheckSummary").innerHTML = `<div class="planet-empty">${escapeHtml(data.message || "PHL verisi yok.")} Beklenen dosya: ${escapeHtml(data.expected_file || "data/hwc.csv")}</div>`;
    $("esiCheckChart").innerHTML = "";
    return;
  }
  const rho = data.spearman;
  const rhoText = rho == null ? "—" : rho.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $("esiCheckSummary").innerHTML = `<div class="stat-card"><span>SPEARMAN SIRA KORELASYONU (ρ)</span><strong>${rhoText}</strong><small>${rho == null ? "Hesaplanamadı" : esiStrengthText(rho)}</small></div><div class="stat-card"><span>KARŞILAŞTIRILAN GEZEGEN</span><strong>${data.pair_count.toLocaleString("tr-TR")}</strong><small>ESI'si olan ve kapsamı %0'dan büyük</small></div><div class="stat-card esi-reading"><span>NASIL OKUNUR?</span><p>${escapeHtml(esiScenarioReading(scenarioId))}</p></div>`;
  renderEsiChart(data);
  renderEsiTable(data.points);
  $("esiCheckNote").textContent = `${data.note} ρ: −1 ile 1 arasında; 1, iki sıralamanın tamamen aynı olduğunu gösterir.`;
}

// /api/esi-consistency'den veriyi alır; senaryo başına önbellekte tutar.
async function loadEsiConsistency() {
  const scenarioId = $("esiScenario").value;
  const requestId = ++esiRequest;
  try {
    if (!esiConsistencyCache.has(scenarioId)) {
      $("esiCheckSummary").innerHTML = '<div class="loading-state">Karşılaştırma hazırlanıyor…</div>';
      const response = await fetch(`/api/esi-consistency?scenario=${encodeURIComponent(scenarioId)}`);
      const data = await readApiJson(response);
      if (!response.ok) throw new Error(data.error || "Karşılaştırma verisi alınamadı.");
      esiConsistencyCache.set(scenarioId, data);
    }
    if (requestId !== esiRequest) return;
    renderEsiConsistency(esiConsistencyCache.get(scenarioId), scenarioId);
  } catch (error) {
    if (requestId === esiRequest) showError($("esiCheckSummary"), error);
  }
}

// Ağırlık gerekçeleri ve duyarlılık analizi.

const weightMethodologyCache = new Map();
const weightSensitivityCache = new Map();
let weightRequest = 0;

// Sayı biçimlendirme yardımcıları (yüzde payı, ρ, yüzde).
function formatShare(value) {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function formatRho(value) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function formatPercent(fraction) {
  return `%${Math.round(fraction * 100)}`;
}

// Ağırlık tablosu: ölçüt, ağırlık çubuğu, gerekçe ve kaynak bağlantıları.
function renderWeightRationale(data) {
  const maxWeight = Math.max(...data.weights.map(item => item.weight));
  const rows = data.weights.map(item => {
    const sources = item.sources.map(source => source.url
      ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>`
      : `<span>${escapeHtml(source.label)}</span>`).join("");
    return `<tr><th scope="row">${escapeHtml(item.name)}</th><td class="weight-cell"><span class="weight-bar"><i style="width:${(item.weight / maxWeight * 100).toFixed(1)}%"></i></span><b>%${formatShare(item.share_percent)}</b></td><td>${escapeHtml(item.reason)}</td><td class="weight-sources">${sources}</td></tr>`;
  }).join("");
  $("weightRationale").innerHTML = `<p class="weight-basis">${escapeHtml(data.basis)}</p><div class="weight-table-wrap"><table class="weight-table"><thead><tr><th>Ölçüt</th><th>Ağırlık</th><th>Gerekçe</th><th>Kaynak</th></tr></thead><tbody>${rows}</tbody></table></div><p class="weight-derivation">${escapeHtml(data.derivation_note)}</p>`;
}

// İlk 10 cismin sıra aralığı grafiği: nokta mevcut sıra, çizgi ağırlıklar değişince görülen en iyi–en kötü sıra.
function renderWeightRankChart(data) {
  const rowHeight = 28, labelWidth = 170, right = 92, top = 26, width = 720;
  const maxRank = Math.max(data.top_n + 1, ...data.top_bodies.map(item => item.rank_max));
  const height = top + data.top_bodies.length * rowHeight + 8;
  const xAt = rank => labelWidth + (rank - 1) / Math.max(1, maxRank - 1) * (width - labelWidth - right);
  const ticks = [...new Set([1, data.top_n, maxRank, Math.round((1 + maxRank) / 2)])].sort((a, b) => a - b);
  const grid = ticks.map(rank => `<line class="esi-grid" x1="${xAt(rank)}" x2="${xAt(rank)}" y1="${top - 6}" y2="${height - 6}"/><text x="${xAt(rank)}" y="${top - 12}" text-anchor="middle">${rank}.</text>`).join("");
  const cutoff = `<line class="weight-cutoff" x1="${xAt(data.top_n + 0.5)}" x2="${xAt(data.top_n + 0.5)}" y1="${top - 6}" y2="${height - 6}"/>`;
  const rows = data.top_bodies.map((item, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    const label = item.planet.length > 24 ? `${item.planet.slice(0, 23)}…` : item.planet;
    const range = item.rank_min === item.rank_max ? "her seferinde aynı sırada" : `${item.rank_min}.–${item.rank_max}. sıralar arasında`;
    return `<g><title>${escapeHtml(item.planet)} · mevcut sıra ${item.base_rank} · ${range} · denemelerin ${formatPercent(item.top_share)} kadarında ilk ${data.top_n} içinde</title><text class="weight-rank-label" x="${labelWidth - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(label)}</text><line class="weight-range" x1="${xAt(item.rank_min)}" x2="${xAt(item.rank_max)}" y1="${y}" y2="${y}"/><circle class="weight-base" cx="${xAt(item.base_rank)}" cy="${y}" r="5"/><text x="${width - right + 10}" y="${y + 4}">ilk ${data.top_n}'da ${formatPercent(item.top_share)}</text></g>`;
  }).join("");
  $("weightRankChart").innerHTML = `<div class="esi-check-legend" aria-hidden="true"><span><i class="esi-key weight-key-base"></i>Mevcut ağırlıklarla sıra</span><span><i class="weight-key-range"></i>Ağırlıklar değişince görülen en iyi–en kötü sıra</span><span><i class="weight-key-cutoff"></i>İlk ${data.top_n} sınırı</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Mevcut ilk ${data.top_n} cismin, ağırlıklar değiştiğinde aldığı sıra aralığı">${grid}${cutoff}${rows}</svg>`;
}

// Duyarlılık özet kutuları, sıra grafiği ve tek tek artırma tablosu.
function renderWeightSensitivity(data) {
  if (!data.available) {
    $("weightSensitivitySummary").innerHTML = '<div class="planet-empty">Bu senaryoda duyarlılık analizi için yeterli puanlanmış cisim yok.</div>';
    $("weightRankChart").innerHTML = "";
    return;
  }
  const spreadText = `±%${Math.round(data.spread * 100)}`;
  $("weightSensitivitySummary").innerHTML = `<div class="stat-card"><span>GENEL SIRALAMA UYUMU</span><strong>${formatRho(data.spearman_mean)}</strong><small>Ortalama Spearman ρ · en kötü %5'lik dilim ${formatRho(data.spearman_p5)}</small></div><div class="stat-card"><span>İLK ${data.top_n} KORUNMASI</span><strong>${formatPercent(data.top_retention_mean)}</strong><small>Ortalama · en kötü denemede ${formatPercent(data.top_retention_min)}</small></div><div class="stat-card"><span>TÜM AĞIRLIKLAR EŞİT OLSAYDI</span><strong>${formatRho(data.equal_weights.spearman)}</strong><small>ρ · ilk ${data.top_n}'un ${formatPercent(data.equal_weights.top_retention)} kadarı aynı kalırdı</small></div><div class="stat-card esi-reading"><span>NASIL OKUNUR?</span><p>${data.runs} denemede her ağırlık ${spreadText} içinde rastgele değiştirildi; ${data.body_count.toLocaleString("tr-TR")} cisim yeniden sıralandı. ρ = 1 sıralamanın hiç değişmediğini gösterir. Genel sıralama kararlıysa ama ilk ${data.top_n} değişiyorsa, ağırlıklar özellikle listenin en üstünü belirler.</p></div>`;
  renderWeightRankChart(data);
  const details = $("weightOneAtATime");
  details.querySelector("div").innerHTML = `<table><thead><tr><th>Artırılan ölçüt (+%${Math.round(data.spread * 100)})</th><th>Mevcut ağırlık</th><th>Sıralama uyumu (ρ)</th><th>İlk ${data.top_n} korunması</th></tr></thead><tbody>${data.one_at_a_time.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${item.weight}</td><td>${formatRho(item.spearman)}</td><td>${formatPercent(item.top_retention)}</td></tr>`).join("")}</tbody></table>`;
  $("weightSensitivityNote").textContent = data.note;
}

// JSON'u bir kez indirir, sonra önbellekten verir.
async function fetchCachedJson(cache, key, url) {
  if (!cache.has(key)) {
    const response = await fetch(url);
    const data = await readApiJson(response);
    if (!response.ok) throw new Error(data.error || "Veri alınamadı.");
    cache.set(key, data);
  }
  return cache.get(key);
}

// Seçili senaryo ve değişim oranı için gerekçe ve duyarlılık verisini yükleyip çizer.
async function loadWeightCheck() {
  const scenarioId = $("weightScenario").value;
  const spread = $("weightSpread").value;
  const sensitivityKey = `${scenarioId}|${spread}`;
  const requestId = ++weightRequest;
  try {
    if (!weightSensitivityCache.has(sensitivityKey)) {
      $("weightSensitivitySummary").innerHTML = '<div class="loading-state">Sıralamalar yeniden hesaplanıyor… (ilk seferde birkaç saniye sürebilir)</div>';
      $("weightRankChart").innerHTML = "";
    }
    const methodology = await fetchCachedJson(weightMethodologyCache, scenarioId, `/api/methodology?scenario=${encodeURIComponent(scenarioId)}`);
    if (requestId !== weightRequest) return;
    renderWeightRationale(methodology);
    const sensitivity = await fetchCachedJson(weightSensitivityCache, sensitivityKey, `/api/weight-sensitivity?scenario=${encodeURIComponent(scenarioId)}&spread=${encodeURIComponent(spread)}`);
    if (requestId !== weightRequest) return;
    renderWeightSensitivity(sensitivity);
  } catch (error) {
    if (requestId === weightRequest) showError($("weightSensitivitySummary"), error);
  }
}
