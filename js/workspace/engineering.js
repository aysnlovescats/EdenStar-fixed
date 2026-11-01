// Kolonizasyon mühendisliği sayfası ve hesaplayıcıları.

// Her yaklaşım için gereksinim panosu: alan, başlık, gereksinim, olgunluk seviyesi
// ve bu gezegende bakılacak veri anahtarları (evidence).
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

// Analiz sonucunda verilen anahtarlı ölçütü (ör. 'temperature') herhangi bir senaryoda bulur.
function engineeringIndicator(analysis, key) {
  for (const scenario of analysis?.scenarios || []) {
    const match = (scenario.indicators || []).find(item => item.key === key);
    if (match) return match;
  }
  return null;
}

// Bir gereksinim için bu gezegende eldeki kanıtı tek cümleyle yazar
// (ör. 'Analizde mevcut · 0,006 bar' veya 'veri yok').
function engineeringEvidence(analysis, key) {
  const metrics = analysis?.metrics || {};
  if (key === "local_site") return "Yerel saha haritası bu gezegen-geneli veri kümesinde yok.";
  if (key === "stellar_environment") return "Yıldız etkinliği ve uzun dönem iklim kararlılığı bu analizde ölçülmüyor.";
  if (key === "orbit") return "Görev yörüngesi ve enkaz/radyasyon profili bu analizde yok.";
  if (key === "magnetosphere") return "Manyetik alan ve atmosfer kayıp hızı bu analizde yok.";
  if (key === "biosafety") return "Gezegen-geneli ölçümle belirlenemez; ayrı biyogüvenlik değerlendirmesi gerekir.";
  if (key === "temperature" && metrics.temperature_kind === "modeled_surface") {
    return `PHL modeli: Dünya benzeri atmosfer varsayımıyla tahmini yüzey sıcaklığı ${Number(metrics.temperature).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} K; ölçüm puanına katılmaz, varsayımsal modelde kullanılır.`;
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

// Sayıyı Türkçe biçimde yazar; geçersizse 'Bilinmiyor'.
function engineeringFormat(value, digits = 2) {
  return value == null || !Number.isFinite(Number(value))
    ? "Bilinmiyor"
    : Number(value).toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

// 'Hedefe özel girdiler' panosu: temel değerleri gösterir ve kurallarla 'bu hedef için ne ifade ediyor?'
// notlarını yazar (basınç farkı, düşük yerçekimi, düşük/yüksek akı, cisme özel notlar).
// Hesaplayıcıyı yalnızca yüzey ve yer altı yaklaşımında açar.
function renderEngineeringFacts(analysis, destination, approach) {
  const metrics = analysis.metrics || {};
  const isSolar = destination.host === "Güneş Sistemi";
  const noSolidSurface = isSolar && ["jüpiter", "satürn"].includes(destination.planet.toLocaleLowerCase("tr-TR"));
  const temperatureLabel = metrics.temperature == null ? "Sıcaklık"
    : metrics.temperature_kind === "surface" ? "Yaklaşık yüzey sıcaklığı"
    : metrics.temperature_kind === "modeled_surface" ? "PHL model sıcaklığı · ölçüm puanına katılmaz, varsayımsal modelde kullanılır"
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
    notes.push("Sıcaklık, Dünya benzeri atmosfer varsayan PHL modelinden geliyor; gerçek atmosfer ve sera etkisi bilinmiyor. Isıtma/soğutma boyutlandırması için ölçülmüş yüzey verisi gerekir. Bu değer ölçüm puanına katılmaz; varsayımsal modelde kullanılır.");
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

// Koruyucu örtü ve kubbe hesaplayıcısı:
// hacim = alan × kalınlık, kütle = hacim × yoğunluk, alan yoğunluğu = ρ·d/10 (g/cm²), taban yükü = ρ·d·g.
function updateEngineeringCalculator() {
  const output = $("engineeringShieldOutput");
  if (!output || !engineeringAnalysis) return;
  const area = Number($("engineeringShieldArea").value);
  const depth = Number($("engineeringShieldDepth").value);
  const density = Number($("engineeringShieldDensity").value);
  if (![area, depth, density].every(Number.isFinite) || area <= 0 || depth <= 0 || density <= 0) {
    output.textContent = "Alan, kalınlık ve yoğunluk pozitif sayılar olmalı.";
    updateEngineeringHeatEstimate();
    return;
  }
  const volume = area * depth;
  const massKg = volume * density;
  const arealDensity = density * depth / 10;
  const gravityValue = engineeringAnalysis.metrics?.gravity;
  const gravity = gravityValue == null ? null : Number(gravityValue);
  const load = gravity != null && Number.isFinite(gravity) ? density * depth * gravity * 9.81 / 1000 : null;
  const internalBar = Number($("engineeringInternalPressure").value);
  const domeRadius = Number($("engineeringDomeRadius").value);
  const domeThickness = Number($("engineeringDomeThickness").value);
  const pressureMetric = engineeringAnalysis.metrics?.surface_pressure_bar;
  const targetName = engineeringDestination?.planet?.toLocaleLowerCase("tr-TR");
  const nearVacuumSolarTargets = new Set(["ay", "europa", "enceladus", "merkür"]);
  const externalBar = pressureMetric != null && Number.isFinite(Number(pressureMetric))
    ? Number(pressureMetric)
    : engineeringDestination?.host === "Güneş Sistemi" && nearVacuumSolarTargets.has(targetName) ? 0 : null;
  let coverText = "Dış basınç veya yerçekimi verisi yok; örtü denge kalınlığı hesaplanmıyor.";
  if (externalBar != null && gravity != null && gravity > 0 && Number.isFinite(internalBar) && internalBar >= 0) {
    const outwardPressurePa = Math.max(0, internalBar - externalBar) * 100000;
    // İç basıncı yalnızca örtünün ağırlığıyla dengelemek için gereken kalınlık: t = Δp / (ρ·g).
    const thickness = outwardPressurePa / (density * gravity * 9.81);
    coverText = outwardPressurePa === 0
      ? `Basınç farkı dışa doğru değil (${engineeringFormat(internalBar - externalBar, 3)} bar); bu ideal denge hesabında ek örtü kalınlığı 0 m.`
      : `${engineeringFormat(thickness, 1)} m ideal eşdeğer örtü · Δp/(ρg); zemin taşıması, geometri ve ankraj hesaba katılmıyor.`;
  }
  let stressText = "Dış basınç verisi veya geçerli kubbe girdileri yok; gerilme hesaplanmıyor.";
  if (externalBar != null && Number.isFinite(internalBar) && internalBar >= 0 && Number.isFinite(domeRadius) && domeRadius > 0 && Number.isFinite(domeThickness) && domeThickness > 0) {
    const deltaPressurePa = (internalBar - externalBar) * 100000;
    // İnce küresel kabukta membran gerilmesi: σ = Δp·r / (2t). Pozitif → çekme, negatif → basma.
    const stressMpa = deltaPressurePa * domeRadius / (2 * domeThickness) / 1e6;
    const thinShellNote = domeThickness / domeRadius >= 0.1 ? " t/r oranı ince kabuk varsayımını zayıflatır." : "";
    stressText = `Δp ${engineeringFormat(Math.abs(internalBar - externalBar), 3)} bar · ${engineeringFormat(Math.abs(stressMpa), 2)} MPa ${stressMpa < 0 ? "basma" : "çekme"} membran gerilmesi · ${stressMpa < 0 ? "dış basınç burkulması kontrol edilmedi" : "malzeme dayanımı/güvenlik katsayısı kontrol edilmedi"}.${thinShellNote}`;
  }
  output.innerHTML = `<span><strong>${engineeringFormat(volume, 2)} m³</strong> yaklaşık örtü hacmi</span><span><strong>${engineeringFormat(massKg / 1000, 2)} ton</strong> yaklaşık malzeme kütlesi</span><span><strong>${engineeringFormat(arealDensity, 1)} g/cm²</strong> alan yoğunluğu · radyasyon dozunu tek başına vermez</span>${load == null ? "" : `<span><strong>${engineeringFormat(load, 2)} kPa</strong> ortalama taban yükü · seçilen gökcismi yerçekimiyle</span>`}<span><strong>Örtü dengesi</strong>${coverText}</span><span><strong>Kubbe basınç gerilmesi</strong>${stressText}</span>`;
  updateEngineeringHeatEstimate();
}

// Işınımla ısı kaybı (Stefan–Boltzmann): P = ε·σ·A·(T_iç⁴ − T_dış⁴). İletim ve yalıtım dahil değil.
function updateEngineeringHeatEstimate() {
  const output = $("engineeringHeatOutput");
  if (!output || !engineeringAnalysis) return;
  const outside = Number(engineeringAnalysis.metrics?.temperature);
  const inside = Number($("engineeringInteriorTemp").value);
  const area = Number($("engineeringHeatArea").value);
  const emissivity = Number($("engineeringEmissivity").value);
  if (!Number.isFinite(outside) || outside <= 0 || !Number.isFinite(inside) || inside <= 0 || !Number.isFinite(area) || area <= 0 || !Number.isFinite(emissivity) || emissivity <= 0 || emissivity > 1) {
    output.textContent = "Hedef sıcaklığı ve geçerli iç sıcaklık, alan, ε girdileri gerekli.";
    return;
  }
  const stefanBoltzmann = 5.670374419e-8;
  const netRadiationW = emissivity * stefanBoltzmann * area * (inside ** 4 - outside ** 4);
  const temperatureKind = engineeringAnalysis.metrics?.temperature_kind;
  const basis = temperatureKind === "surface" ? "hedef yüzey sıcaklığı" : temperatureKind === "modeled_surface" ? "model yüzey sıcaklığı" : "denge sıcaklığı vekili (gerçek yüzey değil)";
  output.innerHTML = `<span><strong>${engineeringFormat(Math.abs(netRadiationW) / 1000, 2)} kW</strong>${netRadiationW >= 0 ? "net ideal radyatif ısı kaybı" : "net ideal radyatif ısı kazancı"}</span><span><strong>${engineeringFormat(outside, 1)} K</strong>${basis} · yalıtım/iletim ve çevre görüş faktörü dahil değil</span>`;
}

// Her gereksinim alanı için 'nasıl ölçülür / ne yapılmalı' adımlarını döndürür.
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

// Mühendislik sayfasını seçili hedef ve yaklaşımla yeniden çizer: girdiler, gereksinim kartları ve adımlar.
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
    ? `<span>Bilinen ölçüt puanı: <strong>${scenario.score == null ? "Hesaplanamıyor" : `${scenario.score}/100`}</strong> · veri kapsamı %${scenario.coverage}${scoreRangeNote(scenario) ? ` · ${escapeHtml(scoreRangeNote(scenario))}` : ""}</span>`
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

// Hedef listesini /api/destinations'tan alıp seçim kutusunu doldurur (arama destekli).
async function loadEngineeringDestinations(query = "") {
  const listRequest = ++engineeringListRequest;
  const select = $("engineeringDestination");
  select.innerHTML = '<option value="">Hedefler yükleniyor…</option>';
  try {
    const queryParams = new URLSearchParams({ limit: "1000" });
    if (query) queryParams.set("q", query);
    const response = await fetch(`/api/destinations?${queryParams}`);
    const data = await readApiJson(response);
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

// Seçilen hedefin analizini /api/analyze'dan alır ve sayfayı çizer.
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
    const analysis = await readApiJson(response);
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
