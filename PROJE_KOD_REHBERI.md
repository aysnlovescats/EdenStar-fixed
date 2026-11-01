# EdenStar — Kod Rehberi

Bu belge, projenin ilk aşamasını öğretmene anlatmak için hazırlanmıştır. Kodun hangi parçalarının ne yaptığını, gezegen verisinin puana nasıl dönüştüğünü ve ekrandaki sonuçların nereden geldiğini özetler.

## 1. Proje ne yapıyor?

EdenStar; NASA Exoplanet Archive CSV kataloğundaki ötegezegenleri ve projede tanımlı Güneş Sistemi cisimlerini üç yerleşim yaklaşımına göre ön değerlendiren bir web uygulamasıdır:

- **Yüzey/kubbe:** Sıcaklık, basınç, atmosfer ve fiziksel ölçüler.
- **Yer altı:** Jeoloji, erişilebilir kaynaklar, radyasyon koruması, termal koşullar ve gezegen ölçeğindeki fiziksel vekiller.
- **Yörünge:** Yıldız enerjisi, kaçış hızı, kararlı yörünge penceresi ve Dünya’ya uzaklık.

Bu puanlar NASA’nın resmî yaşanabilirlik veya koloni başarı puanı değildir. Projenin belirlediği ölçüt ve ağırlıklardan oluşan, kaynak durumunu ve eksik veriyi gösteren bir **ön eleme endeksidir**.

## 2. Kodun çalışma akışı

```text
Kullanıcı arayüzü (HTML + CSS + JavaScript)
        │ HTTP isteği
        ▼
app.py (Flask API uç noktaları)
        │
        ├── dataset.py       NASA CSV'sini yükler
        ├── metrics.py       değerleri temizler/türetir, kaynak durumunu ekler
        ├── classification.py gezegen sınıfı ve senaryo uygulanabilirliği
        ├── scenarios.py     ölçütleri ve ağırlıkları tanımlar
        ├── scoring.py       ölçütleri ve toplam senaryo puanını hesaplar
        └── data_sources.py / phl_catalog.py kaynak ve PHL karşılaştırması
```

Örneğin kullanıcı bir gezegen seçtiğinde `system-view/analysis.js`, `/api/analyze` adresine gezegenin yıldız ve gezegen adını gönderir. `app.py` veriyi bulup analiz modüllerine iletir. API, ölçütler ve puanlarla JSON yanıtlar; JavaScript bu yanıtı gezegen ayrıntı ekranında gösterir.

## 3. Python analiz kodları

### `app.py` — Sunucu ve API

Flask web sunucusudur. Analiz formüllerinin çoğu burada yazılmamıştır; ilgili analiz modüllerini çağırır.

- `handle_http_error(error)`: API isteklerindeki HTTP hatalarını JSON biçiminde döndürür.
- `api_unexpected_error(error)`: Beklenmeyen sunucu hatasını kayda alır ve arayüze genel bir hata yanıtı verir.
- `home()`: Ana adrese girilince çalışma alanı sayfasına yönlendirir.
- `analyze()`: Seçilen Güneş Sistemi cismi veya ötegezegen için ölçütleri, sınıflandırmayı, üç senaryonun puanını, kaynaklarını ve yüzey seçeneklerini birleştirir. Sonuç JSON’dur.
- `rankings()`: İstenen senaryoya göre sıralama üretir; arama, gezegen grubu ve en az veri kapsamı filtrelerini uygular.
- `phl_candidates()`: PHL kataloğundaki adayları konservatif/iyimser gruplar halinde sunar.
- `esi_consistency_check()` / `_esi_consistency(...)`: Seçilen senaryo için proje puanı ile PHL ESI değerlerini eşleştirir ve Spearman sıra korelasyonunu döndürür; sonuç senaryo başına önbelleğe alınır.
- `destinations()`: Yaşam destek ve mühendislik sayfalarının kullanabileceği hedef listesini verir.
- `map_scores()`: Harita katmanları için puan ve gezegen verilerini sağlar.
- `analyze_custom_planet()`: Kullanıcının kendi gezegeni için girdiği değerleri senaryo analizine gönderir.
- `_ranked_planets(...)`: Gezegen kayıtlarını senaryo puanına, kapsamına ve filtrelere göre hazırlar.
- `_solar_ranking_entries()`: Merkür, Venüs, Dünya, Mars, Ay ve diğer proje içi Güneş Sistemi cisimlerinin yaklaşık verilerini ortak analiz biçimine çevirir.
- `serve(...)`, `index_files(...)`, `css_files(...)`, `js_files(...)`, `data_files(...)`, `asset_files(...)`: HTML, stil, JavaScript, CSV ve görsel dosyalarını sunar; izin verilen dosya uzantılarını sınırlar.

### `analysis/dataset.py` — NASA veri dosyası

- `_latest_csv()`: `data/` içindeki kullanılabilir NASA CSV dosyasını bulur.
- `load_planets()`: CSV’yi okur, satırları gezegen/yıldız anahtarlarına göre düzenler ve tekrar kullanmak için önbelleğe alır.

### `analysis/metrics.py` — Ölçümler ve türetilmiş fiziksel değerler

- `number(value)`: CSV’deki metin veya boş değerleri güvenli sayısal değere çevirir; geçersiz/boş girdiyi `None` yapar.
- `stellar_type(row)`: Yıldızın katalog özelliklerinden tayf sınıfı bilgisi çıkarır.
- `mass_provenance(row, mass, estimated)`: Kütlenin NASA’da gerçek kütle (`pl_bmassprov=Mass`), başka bir ölçüm türü veya tahmin olup olmadığını belirler. Bu kaynak denetimi özellikle kaçış hızı ve Hill hesabında önemlidir.
- `estimate_mass_from_radius(r)` ve `estimate_radius_from_mass(m)`: Eksik boyut için yaklaşık bağıntı kullanır. Tahmin olduğu işaretlenir; doğrulanmış ölçüm gibi değerlendirilmez.
- `calculate_insolation(row)`: Yıldız parlaklığı ve yörünge uzaklığından gezegene gelen yıldız enerjisini hesaplar; mevcut veri yeterliyse alternatif yıldız parametrelerini kullanır.
- `derive_planet_metrics(row)`: Tek bir NASA satırını ortak ölçüt sözlüğüne dönüştürür. Yerçekimi, yoğunluk, kaçış hızı ve Hill penceresi gibi değerleri hesaplar; her değerin arşiv, türetilmiş veya tahmin niteliğini `provenance` içinde tutar.

Kaçış hızı ve Hill penceresi için tahmini kütle kullanılmaz. Gerçek kütle ve gerekli arşiv girdileri yoksa ilgili değer bilinmiyor kalır.

### `analysis/classification.py` — Gezegen türü ve uygulanabilirlik

- `classify_planet(...)`: Yarıçap, kütle ve varsa yoğunluğa göre cismi ihtiyatlı biçimde kayalık aday, geçiş sınıfı veya gaz/buz devi olarak etiketler. Bazı sınıflarda yüzey/yer altı senaryolarının uygulanabilir olmadığını belirtir.
- `classify_metrics(metrics)`: Önce ölçümlerin kaynağını kontrol eder; tahminleri doğrulanmış fiziksel bilgi gibi sınıflandırmaya sokmaz, sonra `classify_planet` fonksiyonunu çağırır.

Bu sınıflandırma kesin bileşim analizi değildir. Özellikle büyük gezegenlerde katı yüzey bulunduğunu varsaymamak için kullanılır.

### `analysis/scenarios.py` — Ölçütler ve ağırlıklar

`SCENARIOS`, her senaryonun görünen adını, açıklamasını ve ağırlıklarını tanımlar. `INDICATORS`, ölçüt adını, birimini ve puanlama kuralını saklar. `SCENARIO_GUIDANCE`, arayüzde gösterilen gereksinim ve risk notlarını içerir. `SURFACE_GUARDRAILS`, yüzey ön elemesindeki proje aralıklarını tanımlar.

Güncel yer altı ağırlıkları: yerel jeoloji/erişim/kararlılık %30, erişilebilir su %22, radyasyon koruması %20, termal koşullar %8, jeotermal potansiyel %8, yerçekimi %6, yoğunluk %4 ve yarıçap %2. Bu yüzdeler doğa yasası değildir; yerel saha koşullarını gezegen ölçeğindeki dolaylı göstergelerden daha önemli sayan proje kararıdır.

### `analysis/scoring.py` — Puanlama motoru

Bu dosya ölçüt puanlarını, toplam senaryo puanını, veri kapsamını ve varsayımsal model aralığını üretir.

- `_rounded_score(value)`: Sonuçları kullanıcı arayüzünde tam sayıya yuvarlar.
- `_criterion_score(value, definition)`: Ölçüt tanımındaki kurala göre 0–1 arası uygunluk puanı üretir. Normalleştirilmiş girdileri sınırlar; düşük daha iyi/yüksek daha iyi yönlü ölçütleri eşik ile değerlendirir; diğer ölçütlerde ideal değer ve tolerans kullanır.
- `_surface_pressure_score(pressure_bar)`: Dış basıncın habitat üzerindeki yüküne yönelik proje formülünü uygular.
- `_surface_critical_checks(metrics)`: Yüzey sıcaklığı, basınç ve atmosfer gibi temel koşullar için “aralıkta”, “risk” veya “bilinmiyor” durumlarını hazırlar. Bunlar puana ek açıklama sağlar.
- `_exploratory_model(metrics, scenario)`: Tahmin, model veya kullanıcı girdilerini doğrulanmış ana puandan ayrı tutup varsayımlı puan aralığı oluşturur. Denge sıcaklığı buradaki kaba yer altı termal vekilidir; gerçek yer altı ölçümü değildir.
- `score_scenario(metrics, scenario_id)`: Bir senaryo için ölçütleri sırayla puanlar; kaynak doğrulanmış mı diye kontrol eder; toplam puanı ve veri kapsamını hesaplar. Eksik ölçüt toplam puana 0 katkı yapar ve veri kapsamını azaltır. Böylece “0 ölçüldü ve kötü çıktı” ile “veri yok” göstergeleri arayüzde ayrılabilir.

Toplam puan, her ölçütün kendi ağırlıklı puan katkılarının **tüm senaryo ağırlıklarına** bölünmesiyle hesaplanır. Bilinmeyen ölçütler biliniyormuş gibi ortalamadan çıkarılmaz. Bu yaklaşım eksik verinin yüksek puana dönüşmesini önler; kapsam yüzdesi de puanın ne kadar ölçüme dayandığını gösterir.

### `analysis/methodology.py` — Ağırlık gerekçeleri

- `scenario_methodology(scenario_id)`: Senaryonun ağırlıklarını büyükten küçüğe, her biri için yüzde payı, gerekçesi ve kaynaklarıyla döndürür. Veri `scenarios.py` içindeki `WEIGHT_RATIONALE`, `WEIGHT_SOURCES` ve `WEIGHT_DERIVATION_NOTE` sözlüklerinden gelir. `/api/methodology` ve `/api/analyze` (alan: `methodology`) bunu kullanır. **AI raporu eklendiğinde ağırlıkları bu alandan açıklamalı, kendi gerekçe uydurmamalıdır.**

### `analysis/sensitivity.py` — Ağırlık duyarlılık analizi

- `criterion_rows(records, scenario_id)`: Her cisim için `score_scenario` sonucundaki doğrulanmış ölçüt puanlarını (`criterion_score`, yuvarlanmamış) ve sınıf cezasını toplar. Kapsamı %0 olanlar dışarıda kalır.
- `weighted_score(row, weights)`: Aynı puan kuralını (eksik ölçüt 0, tüm ağırlıklara bölme, sınıf cezası) verilen ağırlıklarla hızlıca yeniden hesaplar.
- `weight_sensitivity(rows, scenario_id, runs, spread, top_n, seed)`: Monte Carlo (her ağırlık rastgele ±spread), tek tek ağırlık artırma ve eşit ağırlık karşılaştırması yapar; ortalama ve en kötü Spearman ρ, ilk 10'un korunma oranı ve ilk 10 cismin görülen sıra aralığını döndürür. Sabit tohum sayesinde sonuç tekrarlanabilir.

### `analysis/consistency.py` — ESI tutarlılık kontrolü

- `_average_ranks(values)`: Değerleri sıralar; eşit değerlere sıralarının ortalamasını verir.
- `spearman(xs, ys)`: Sıralar üzerinde Pearson korelasyonu, yani Spearman ρ. Üçten az nokta veya varyans yoksa `None`.
- `esi_score_pairs(planets, catalog, scenario_id)`: PHL'de ESI'si olan ve senaryo kapsamı %0'dan büyük gezegenleri puanlarıyla eşleştirir. Kapsamı %0 olanlar dışarıda kalır; onların puanı ölçüm değil kanıt eksikliğidir.
- `esi_consistency(...)`: Eşleşen noktaları, nokta sayısını ve ρ değerini birlikte döndürür.

### `analysis/surface_options.py` — Yüzey yaklaşımı seçenekleri

- `build_surface_options(...)`: Açık yüzey, basınçlı kubbe, regolit koruması ve Venüs için yüksek irtifa platformu gibi seçenekleri ölçüm kapsamına göre hazırlar. Gerekli yerel veri yoksa başarılıymış gibi puan uydurmaz.

### `analysis/data_sources.py` — Kaynak kartları

- `scenario_data_sources(host, planet_name, scenario_id)`: Seçili cisim ve senaryo için ilgili veri/kurum kaynaklarını ve kaynak durumlarını arayüz formatına dönüştürür.

### `analysis/phl_catalog.py` — PHL katalog eşleştirme

- `normalize_planet_name(value)`: Adları eşleştirmeye uygun hale getirir.
- `load_phl_catalog()` / `_read_phl_catalog(...)`: İsteğe bağlı PHL CSV dosyasını yükler ve önbellekler.
- `phl_summary(...)` / `phl_comparison(...)`: Gezegen adını PHL kataloğuyla eşleştirir ve ESI/bölge bilgisini sağlar.
- `ranked_phl_candidates(catalog)`: PHL adaylarını liste ve sıralama için düzenler.

PHL eşleşmesi proje puanı değildir; ESI yaşanabilirlik olasılığı veya yaşam kanıtı sayılmaz.

### `analyze_planets.py` — Toplu analiz aracı

CSV’deki gezegenleri ekranda tek tek seçmeden analiz etmek ve toplu çıktı üretmek için komut satırı başlangıç dosyasıdır. Web sunucusundan bağımsız olarak analiz fonksiyonlarını kullanır.

## 4. Tarayıcı kodları

### `index/index.html`, `index/system-view.html`, `index/workspace.html`

Üç HTML dosyası üç ana ekran iskeletini kurar: yıldız haritası, gezegen sistemi görünümü ve çok sayfalı çalışma alanı. Başlıklar, seçim alanları, formlar, grafik yuvaları ve sonuç kartlarının HTML elemanları burada tanımlanır. HTML hesaplama yapmaz; JavaScript bu elemanlara veri yerleştirir.

### `js/main.js` — 3B yıldız haritası

Three.js ile yıldız sistemlerini ve gezegen bağlantılarını 3B sahnede çizer. Temel fonksiyon grupları:

- `addStar(...)`, `layer(...)`, `dirPos(...)`, `setScope(...)`: yıldız ve harita katmanlarını oluşturur; yıldızları harita koordinatlarına yerleştirir.
- `mkLab(...)`, `glow(...)`, `nodeObj(...)`, `size(...)`, `pcol(...)`, `planetLab(...)`: metin etiketlerini, parıltı efektini, görünmez tıklama yüzeylerini ve gezegen görünümünü hazırlar.
- `enterSystem(...)`, `enterMap()`: harita ile seçili sistem görünümü arasında geçiş yapar.
- `showNode(...)`, `showCosmicSource(...)`, `showPlanet(...)`: seçilen yıldız, kozmik kaynak veya gezegen için bilgi panelini açar.
- `pan(...)`, `zoomBy(...)`, `hover(...)`, `pick(...)`: sürükleme, yakınlaştırma, üzerine gelme ve tıklamayla seçim etkileşimlerini yönetir.
- `resize()`, `layout(...)`, `updateCompass()`: ekran yeniden boyutlandığında sahneyi, etiketleri ve yön göstergesini günceller. `escapeMarkup(...)` panelde gösterilecek metnin HTML olarak yorumlanmasını önler.

Animasyon döngüsü Three.js sahnesini sürekli çizer. `cosmic_sources.js` haritada açılıp kapatılabilen kozmik kaynakların veri listesini sağlar.

### `js/planet_data.js` — Tarayıcıdaki CSV ve önbellek

`num(...)` güvenli sayı dönüşümü yapar. `dbOpen()`, `cacheRead()` ve `cacheWrite()` tarayıcının IndexedDB deposunda katalog verisini saklayıp yeniden kullanır. Bu, NASA CSV’sinin tarayıcı tarafında işlenmesi gereken harita/gezegen listesi özelliklerine destek verir; bilimsel puanın ana kaynağı yine Python API analizidir.

### `js/system-view/` — Gezegen sistemi ve analiz ekranı

Three.js ile yıldızı, yörüngeleri ve gezegenleri gösterir; gezegen seçilince analiz API’sine istek gönderir. Kod dört dosyaya bölünmüştür ve `system-view.html` içinde bu sırayla yüklenir: `scene.js` (sahne, DOM referansları, Güneş Sistemi verisi), `system.js` (sistem çizimi, gezegen listesi), `analysis.js` (koloni analizi ve karşılaştırma), `app.js` (kamera, animasyon, başlangıç). Dosyalar ortak global kapsamı paylaşır; başlangıç kodu `app.js` içinde olduğu için o dosya en son yüklenmelidir. Başlıca fonksiyonlar:

- `openSystem(...)`, `clearSystem()`, `makeStarfield()`: sistem sahnesini kurar ve temizler.
- `addToSystem(...)`, `starColor(...)`, `planetColor(...)`, `orbitColor(...)`, `visualPlanetSize(...)`, `makeGlowTexture()`: sahne nesnelerini ekler; görsel renk, boyut ve yıldız parıltısını belirler.
- `buildPlanetList(...)`, `selectPlanet(...)`: gezegen listesini oluşturur ve seçim yapar.
- `addLabel(...)`, `classifyPlanetSize(...)`: sahne etiketlerini ve görsel boyut sınıfını hazırlar.
- `renderDataSources(...)`, `renderScenarioGuidance(...)`, `renderPhlComparisonDetail()`: kaynak, rehber ve PHL bilgilerini ekrana basar.
- `renderScenarioDetails(...)`, `renderSurfaceOptionDetail(...)`, `renderSelectedScenario()`: puan, kapsam, ölçüt açıklaması ve yüzey seçeneği detaylarını gösterir.
- `renderComparisonChoices()`, `renderComparisonCard(...)`, `runPlanetComparison()`: birden fazla gezegenin senaryolarını karşılaştırır.
- `showColonyAnalysis(...)`: seçilmiş gezegenin analizini yükler.
- `updateCamera()`, `updateLabels()`, `animate(...)`: kamera, etiket ve animasyon döngüsünü yönetir.
- `loadSystems(...)`, `updateSpeedLabel()`: harita/veri listesinden sistemleri seçilebilir hale getirir ve yörünge animasyon hızını arayüzde gösterir. `readApiJson(...)` API yanıtını JSON olarak okur; `escapeHtml(...)` dinamik metinleri güvenli biçimde ekrana basar.

### `js/workspace/` — Katalog, sıralama ve mühendislik araçları

Çalışma alanındaki sayfaları yönetir ve API’den gelen sonuçları kartlara dönüştürür. Kod sayfalara göre bölünmüştür ve `workspace.html` içinde bu sırayla yüklenir: `common.js` (ortak yardımcılar, kartlar), `catalog.js` (genel bakış, katalog, PHL), `engineering.js` (mühendislik), `rankings.js` (sıralama, karşılaştırma, kendi gezegenin), `life-support.js` (yaşam destek ve yolculuk), `app.js` (sayfa geçişleri, olay dinleyicileri, başlangıç; en son yüklenmelidir).

- `renderPlanetCard(...)`, `fetchRankings(...)`, `renderPopulationGroups(...)`: katalog ve senaryo sıralamasını gösterir.
- `loadOverview()`, `loadCatalog()`, `loadRankings()`, `loadComparison()`: ana bakış, katalog, sıralama ve karşılaştırma verisini yükler.
- `escapeHtml(...)`, `readApiJson(...)`, `recordKey(...)`, `updateCompareCount(...)`, `detailUrl(...)`, `lifeSupportUrl(...)`, `showError(...)`, `scenarioLabel(...)`: ekrana güvenli metin basma, API yanıtını okuma, kayıtları eşleştirme, bağlantı üretme ve hata/etiket yönetimi gibi ortak işleri yapar.
- `renderPhlCandidateCards(...)`, `parsePhlCsvRows(...)`, `readPhlCandidatesFromCsv(...)`, `loadPhlCandidates()`: PHL dosyasını ve aday kartlarını yönetir.
- `engineeringIndicator(...)`, `engineeringEvidence(...)`, `engineeringFormat(...)`: mühendislik ekranında analiz ölçütünü, kaynak durumunu ve sayısal gösterimi hazırlar.
- `renderEngineeringFacts(...)`, `updateEngineeringCalculator()`, `updateEngineeringHeatEstimate()`, `engineeringActionSteps(...)`, `renderEngineeringPage()`, `loadEngineeringDestinations(...)`, `loadEngineeringAnalysis()`: kolonizasyon mühendisliği ekranındaki hesapları, varsayımları ve hedef analizini yönetir.
- `renderComparisonCards(...)`: seçilmiş gezegenlerin ölçüt satırlarını ve puanlarını yan yana gösterir.
- `customHasValues(...)`, `formatCustomValue(...)`, `renderCustomScenario(...)`, `loadCustomPlanetScores()`, `scheduleCustomPlanetScores()`, `restoreCustomPlanet()`: kullanıcının girdiği gezegen özelliklerini puanlama API’sine gönderir, giriş değişikliklerini zamanlar ve kayıtlı formu geri yükler.
- `formatMass(...)`, `formatTravelDuration(...)`, `estimateTravel(...)`, `formatDestinationDistance(...)`, `updateLifeJourney()`: kütle/mesafe/süre gösterimini ve hedeften seçilen seyir hızına göre yolculuk süresini yönetir; uzun yolculuk eşiği aşılınca uyarı verir.
- `updateLifePower()`: güç ihtiyacı, yıldız akısı ve panel verimiyle ideal panel alanını hesaplar.
- `lifeSupplyAtWaterRecovery(...)`, `renderLifeSensitivity(...)`: su geri kazanımı değişirken ikmal kütlesinin nasıl değiştiğini gösterir.
- `suggestedMissionDeltaV()`, `suggestLifeDeltaV()`, `updateRocketEstimate()`: görev için Δv önerisi ve ideal roket denklemiyle itici/başlangıç kütlesi tahmini üretir.
- `loadLifeSupportDestinationAnalysis()`, `loadLifeSupportDestinations()`, `updateLifeSupport()`: hedef verisini ve kişi başı su/oksijen/gıda tüketiminden toplam ikmal hesabını yönetir.
- `method.js` (ağırlıklar): `loadWeightCheck()` gerekçe ve duyarlılık verisini alır; `renderWeightRationale(...)` ağırlık tablosunu, `renderWeightSensitivity(...)` özet kutularını ve tek tek artırma tablosunu, `renderWeightRankChart(...)` ilk 10 cismin sıra aralığı grafiğini çizer.
- `method.js`: Veri ve yöntem sayfasındaki ESI tutarlılık grafiği. `loadEsiConsistency()` API'den veriyi alır ve senaryo başına önbelleğe koyar; `renderEsiChart(...)` SVG dağılım grafiğini çizer (y ekseni verinin en büyük değerine göre ölçeklenir); `showEsiTooltip(...)` imlece en yakın noktayı bulup ipucunu gösterir; `openEsiPoint(...)` tıklanan gezegenin sistem görünümünü açar; `renderEsiTable(...)` PHL adaylarını tablo olarak listeler.
- `setPage(...)`: çalışma alanındaki etkin sayfayı değiştirir.

## 5. Görünüm, statik dosyalar ve veri

- `css/*.css`: her ekranın renk, yerleşim, kart, form, mobil düzen ve görsel stil kurallarını içerir. `space-theme.css` genel uzay temasını ve sayfalara ait arka planları sağlar.
- `js/cosmic_sources.js`: harita katmanında kullanılacak kozmik kaynak kayıtlarını tanımlar.
- `assets/`: sayfa arka planları ve gezegen görselleri gibi statik medya dosyaları.
- `data/`: NASA ötegezegen CSV’si ve varsa PHL CSV’si. PHL dosyası isteğe bağlıdır; README’de belirtilen ad `data/hwc.csv`.
- `requirements.txt`: Python bağımlılıklarını listeler; mevcut temel bağımlılık Flask’tır.
- `README.md`: kurulumu, çalıştırmayı ve yöntem varsayımlarını anlatır.
- `DÜZELTİLENLER.txt`: geliştirme sırasında yapılan değişikliklerin notlarıdır.

## 6. Öğretmene anlatılabilecek önemli yöntem notları

1. **Kaynak kalitesi:** Bir değer sadece sayısal olduğu için ölçüm sayılmaz. Kod `provenance` bilgisini izleyerek arşiv ölçümü, formülle türetilmiş değer, tahmin ve kullanıcı varsayımını ayırır.
2. **Eksik veri:** Ölçüt bilinmiyorsa bireysel satırda “Veri yok” görünür; toplam puana katkısı 0 olur. Veri kapsamı, toplam ağırlığın ne kadarının kaynakla desteklendiğini belirtir. %0 kapsamlı toplam puan, ölçülmüş başarısızlık değil kanıt yokluğudur.
3. **Yer altı puanı:** Ağırlığın çoğu saha verisi isteyen jeoloji, erişim, su ve radyasyon başlıklarındadır. NASA ötegezegen kataloğu çoğu gezegen için bu yerel bilgileri sağlamaz. Denge sıcaklığı yer altı sıcaklığı olmadığından ana puana değil varsayımsal modele girer.
4. **Varsayımlar:** Senaryo eşikleri ve ağırlıkları proje varsayımlarıdır. Bunlar sonuçları tekrar üretilebilir kılar; ancak mühendislik tasarımının veya görev güvenliği sertifikasının yerini almaz.
5. **Makine öğrenmesi:** Bu sürümde scikit-learn ile benzer gezegen öneren bir model uygulanmış değildir. Mevcut puanlama açıklanabilir, kurala dayalı hesaplamadır. Benzer gezegen önerisi ayrı bir sonraki geliştirme aşaması olarak eklenebilir.

## 7. Yerel çalıştırma

Windows terminalinde proje klasörüne geçip `python -m pip install -r requirements.txt` ve ardından `python app.py` çalıştırılır. Tarayıcıda `http://127.0.0.1:5000` açılır. Flask API gerektiği için yalnızca statik Live Server kullanmak analiz isteklerini çalıştırmaz.
