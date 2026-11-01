# EdenStar

Bu sürüm NASA Exoplanet Archive CSV dosyasını kullanır. Koloni puanı NASA'nın resmî puanı değil, projenin tanımladığı bir ön eleme endeksidir.

## Windows'ta çalıştırma
1. Bu klasörü VS Code'da aç.
2. Terminalde bir kez `python -m pip install -r requirements.txt` çalıştır.
3. `python app.py` ile sunucuyu başlat.
4. Tarayıcıda `http://127.0.0.1:5000` adresini aç. Sunucuyu kapatmak için terminalde Ctrl+C.

## Testler
`python -m pip install -r requirements-dev.txt` ile pytest kurulduktan sonra proje klasöründe `python -m pytest` çalıştır.

Live Server, Python analiz API'sini başlatmadığından kullanılmamalı. Three.js/PapaParse CDN için internet gerekir.

## Dosyalar
- `index/index.html`: yıldız haritası
- `index/system-view.html`: sistem/gezegen görünümü
- `js/main.js`: harita ve sisteme geçiş (aktif dosyadır)
- `js/system-view/`: sistem görünümü (`scene.js`, `system.js`), analiz kartı (`analysis.js`) ve başlangıç (`app.js`)
- `js/workspace/`: çalışma alanı sayfaları; her sayfa grubu ayrı dosyada, başlangıç kodu `app.js` içinde
- `tests/`: puanlama testleri
- `js/planet_data.js`: CSV yükleme ve güvenli eksik değer dönüşümü
- `app.py`: yerel web/API sunucusu; analiz hesabını yapmaz, modülleri çağırır
- `analysis/metrics.py`: NASA CSV değerlerini temizler ve türetilebilir fiziksel göstergeleri hesaplar
- `analysis/classification.py`: mevcut yarıçap, kütle, yoğunluk ve gerçek yüzey sıcaklığından ihtiyatlı sınıf/uygulanabilirlik bilgisi verir; eksik veriyi sınıflandırılamadı bırakır
- `analysis/scenarios.py`: senaryo ağırlıklarını, ölçütleri ve hedef aralıklarını içerir
- `analysis/scoring.py`: ölçüt puanlarını, kapsama oranını ve toplam skoru hesaplar
- `analysis/consistency.py`: proje puanı ile PHL ESI arasındaki Spearman sıra korelasyonu (tutarlılık kontrolü)
- `analysis/methodology.py`: her ağırlığın gerekçesini ve kaynağını API'ye hazır biçimde verir (`scenarios.py` içindeki `WEIGHT_RATIONALE`)
- `analysis/sensitivity.py`: ağırlık duyarlılık analizi (Monte Carlo, tek tek artırma, eşit ağırlık karşılaştırması)
- `analysis/surface_options.py`: açık yüzey, kubbe, regolit koruması ve Venüs yüksek irtifa alternatiflerini veri kapsamına göre sınıflandırır
- `analyze_planets.py`: CSV için toplu değerlendirme raporu

Harita için koordinatı/uzaklığı bilinmeyen yıldızlar 0 konumuna çizilmez. Eksik gezegen yörüngesi yalnızca görsel olarak temsil edilir ve gerçek uzaklık gibi gösterilmez. `pl_eqt` denge sıcaklığıdır; Güneş Sistemi girdileri yüzey sıcaklığı kullanır.

## Koloni senaryoları

Ana yerleşim türleri önceki gibi **Yüzey / Yer altı / Yörünge** olarak kalır. Yüzey açıldığında seçenekler **Açık yüzeyde doğrudan yaşam**, **Basınçlı kubbe / habitat modülü** ve **Regolit ile örtülü / korumalı habitat** olarak ayrılır. Açık yüzey seçeneği sıcaklık, basınç ve solunabilir atmosferi birlikte ön elemeden geçirir; kubbe seçeneği mevcut yüzey puanını kullanır. Regolitli seçenek için yerel radyasyon, zemin ve malzeme ölçümleri gerekir; bunlar yoksa sayısal puan verilmez. Güneş Sistemi Venüs'ünde ayrıca yüzey dışı bir araştırma konsepti olan yüksek irtifa platformu gösterilir; yüzey ölçümleri bu konseptin puanı olarak kullanılmaz. Kubbe senaryosu sıcaklık %20, yarıçap %15, yerçekimi %10, yıldız enerjisi %15, dış basınç %25 ve atmosfer yönetimi %15 ağırlıktadır. Düşük basınç, solunamaz atmosfer veya zorlu sıcaklık puanı otomatik olarak 0 yapmaz; bunlar kubbe/yaşam destek yükü ve ölçüt puanlarıyla kademeli yansıtılır. Basınç puanı 1 barın altında `0,8 + 0,2 × basınç`, 1 bar ve üstünde `max(0, 1 - log10(basınç)/2)` formülünü kullanır; solunabilir atmosfer 1, diğer bilinen atmosfer türleri 0,5 olarak puanlanır. Basınç veya atmosfer ölçümü yoksa kapsam azalır ve bu belirsizlik ekranda gösterilir. Ölçülmüş yüzey sıcaklığı 180–373,15 K ve basınç 0,5–2 bar aralıkları bilgi amaçlı proje eşikleridir; evrensel yaşanabilirlik sınırı ya da puan vetosu değildir. NASA ötegezegen verisindeki denge sıcaklığı gerçek yüzey sıcaklığı olmadığından yüzey sıcaklığıyla aynı kabul edilmez. Yer altı senaryosu yerel jeoloji/erişim/kararlılık (%30), erişilebilir su (%22), radyasyon koruması (%20), termal koşullar (%8), jeotermal potansiyel (%8), yerçekimi (%6), yoğunluk (%4) ve yarıçapı (%2) değerlendirir. Ağırlıklar evrensel bilimsel sabitler değil; saha seçimi için önemli olan yerel jeoloji, erişim, su ve radyasyon başlıklarını gezegen ölçeğindeki vekillerden önde tutan proje varsayımlarıdır. Eksik ölçütler toplam puana 0 katkı yapar ve kapsamı düşürür. NASA denge sıcaklığı yer altı sıcaklığını ölçmediğinden ana puana değil, varsayımsal model aralığına kaba termal vekil olarak girer. Yoğunluk için NASA pl_bmassprov=Mass kütlesi ve arşiv yarıçapı gerekir. Yörünge senaryosunda yıldız enerjisi %35, kaçış hızı %30, kararlı yörünge penceresi %25 ve Dünya'ya uzaklık %10 ağırlıktadır. Kaçış hızı ve Hill penceresi için yalnızca gerçek gezegen kütlesi (pl_bmassprov=Mass) kullanılır; Hill hesabı yıldız kütlesi, yörünge yarı büyük ekseni ve gezegen yarıçapını gerektirir. Kararlı prograde bölge yaklaşık Hill yarıçapının 0,49'u olarak alınır. Uzaklık yalnızca kaba bir erişim vekilidir; gerçek yolculuk süresini veya maliyetini göstermez. Yörünge puanı radyasyon veya suyu kapsamaz; verileri varsa ek ölçüt olarak gösterilebilir. Diğer sayısal göstergeler, senaryo dosyasındaki ideal değer ve toleransa göre `max(0, 1 - |ölçüm - ideal| / tolerans)` formülüyle 0–100 puana çevrilir. Ana puan, doğrulanmış ölçütlerin kendi ağırlıklarıyla toplam senaryo ağırlığına yaptığı katkıların toplamıdır; veri kapsamı hangi ağırlığın ölçüldüğünü ayrıca gösterir. Bilinmeyen ölçütler ana puanda 0 kabul edilir; veri kapsamı ise yalnızca doğrulanmış ölçümleri sayar. Bu nedenle düşük kapsamlı puan, sıfır uygunluk kanıtı değil, eksik veri için ihtiyatlı alt sınırdır. Üst sınır bilinmeyen ölçütlerin tam uygun olduğu varsayımını gösterir. Hiç ölçüm yoksa puan 0, kapsam %0 ve belirsizlik aralığı 0–100 olarak gösterilir.

Yörünge senaryosunda kaçış hızı tek yönlü puanlanır: düşük daha iyidir; 20 km/s ve üzeri 0 puandır. Kararlı yörünge penceresi de tek yönlüdür: büyüdükçe iyidir ve 30 gezegen yarıçapında 100 puana ulaşır. 20 ve 30 eşikleri fizik yasası veya güvenli yörünge garantisi değil, sıralamayı ölçekleyen proje varsayımlarıdır. Diğer ölçütlerde ideal değer/tolerans formülü geçerlidir.

Bir ölçütün verisi yoksa o ölçütün gösterilen puanı **“Veri yok”** olur; toplam hesapta katkısı 0 kabul edilir. Bu nedenle hiç doğrulanmış ölçümü olmayan bir hedef sıralamada toplam 0 puan ve %0 kapsamla yer alabilir. Arayüzdeki **“VERİ YOK”** rozeti bu 0'ın ölçülmüş başarısızlık değil, kanıt eksikliği olduğunu belirtir. Kapsam ve puan aralığı da bu belirsizliği gösterir.

Bu, NASA'nın yayımladığı bir koloni puanı değildir. NASA arşivindeki ölçümlere uygulanan, proje kapsamında açıkça tanımlanmış ve tekrar üretilebilir bir uygunluk endeksidir. Ağırlıklar ve hedefler `analysis/scenarios.py` içinde değiştirilebilir. Ötegezegenlerin çoğunda yerel su, jeotermal koşullar, jeoloji ve görev ortamı ölçümleri olmadığından bu ölçütler bilinmiyor kalır.

Doğrulanmış en az bir ölçüt varsa kısmi senaryo puanı gösterilir. Her ölçütün katkısı kendi senaryo ağırlığıyla hesaplanır ve toplam, senaryonun tüm ağırlıklarına bölünür; örneğin %15 ağırlıklı bir ölçütte 90 puan, genel puana 13,5 puan katkı yapar. Eksik ölçütler ana puanda 0 kabul edilir ve veri kapsamını düşürür. Böylece eksikler ihtiyatlı alt sınırı etkilerken kapsam ayrıca görünür; hiç doğrulanmış ölçüm yoksa puan 0 ve kapsam %0 gösterilir. Arşivdeki rapor değerleri ve Güneş Sistemi için açıkça belirtilen proje verileri puana girebilir. Yalnızca doğrulanmış girdilerden basit formülle türetilen yerçekimi, yoğunluk, kaçış hızı ve Hill penceresi de kaynak koşulları sağlanıyorsa ölçüm puanına katılır; tahmin, PHL modeli ve kullanıcı girdileri ayrı varsayımsal modelde kalır.

## PHL ile karşılaştırma

Gezegen kataloğu kartlarında ve gezegen senaryo ayrıntılarında PHL verileri görünür. **PHL yaşanabilir adayları** sayfasında konservatif ve iyimser aday sınıfları ayrı listelenir; her grup içinde ESI yüksekten düşüğe sıralanır. ESI Dünya benzerliğini gösterir, yaşanabilirlik olasılığı veya proje koloni skoru değildir. Kaynak dosya, [PHL HWC veri sayfasındaki](https://phl.upr.edu/hwc/data) **Full Catalog (all exoplanets) CSV** dosyasıdır; `data/hwc.csv` adıyla kaydedilmelidir. PHL aday etiketi yaşam kanıtı değildir; katalogda eşleşme olmaması da yaşanamazlık anlamına gelmez.


### Ağırlıkların gerekçesi ve duyarlılık analizi

Koloni uygunluğu için literatürde uzlaşılmış sayısal ağırlıklar yoktur; projedeki ağırlıklar gerekçeli proje varsayımlarıdır. Her ağırlığın gerekçesi ve dayandığı kaynak (ESI ağırlıkları, yaşanabilir bölge sınırları, kayalık gezegen yarıçap sınırı, roket denklemi vb.) `analysis/scenarios.py` içindeki `WEIGHT_RATIONALE` ve `WEIGHT_SOURCES` sözlüklerinde tutulur. Yeni bir ağırlık eklenirse gerekçesi yazılmadan testler geçmez. Gerekçeler `/api/methodology?scenario=...` ile ve her `/api/analyze` yanıtındaki `methodology` alanında verilir; ileride eklenecek AI raporu ağırlıkları bu alandan açıklamalıdır.

`/api/weight-sensitivity?scenario=...&spread=20|50` ağırlıkları sabit tohumla 100 kez rastgele ±%20 veya ±%50 değiştirip sıralamayı yeniden hesaplar. Mevcut veriyle genel sıralama çok kararlıdır (Spearman ρ ≥ 0,96), ancak listenin en üstü ağırlıklara duyarlıdır: tüm ağırlıklar eşit olsaydı ilk 10'un kubbede %80'i, yörüngede %70'i aynı kalırdı; yörüngede ±%50 değişimde en kötü denemede ilk 10'un yalnızca %40'ı korunur. Yüksek kararlılığın bir kısmı eksik veriden gelir: ötegezegenlerin çoğunda aynı ölçütler bilinmediği için bu ölçütlerin ağırlığı değişince puanları birlikte kayar, aralarındaki sıra değişmez.

### ESI tutarlılık kontrolü

**Veri ve yöntem** sayfası, ESI değeri olan ve seçili senaryoda kapsamı %0'dan büyük ötegezegenler için proje puanı ile ESI'yi dağılım grafiğinde gösterir ve Spearman sıra korelasyonunu (ρ) hesaplar (`/api/esi-consistency?scenario=...`). Mevcut veriyle ρ kubbe senaryosunda yaklaşık 0,41 (orta), yer altında 0,26 (zayıf), yörüngede 0,00'dır. Yörünge puanı Dünya benzerliğini ölçmediği için ilişki beklenmez. Bu bir doğrulama değil, iki farklı ölçünün ne kadar aynı yönde sıraladığını gösteren genel bir tutarlılık kontrolüdür.

## PHL modellenmiş yüzey sıcaklığı

`data/hwc.csv` içindeki `P_TEMP_SURF`, PHL'in Dünya'dakiyle aynı albedo ve sera etkisini varsayarak hesapladığı **model tahminidir**; ölçüm değildir ve büyük ölçüde yıldız akısından türer. Bu yüzden **bilinen ölçüt puanına katılmaz**; varsayımsal modelde, açıkça model girdisi olarak kullanılır (kayalık boyut sınıflarında bulunur). NASA denge sıcaklığı gibi, gerçek yüzey sıcaklığı yerine geçmediği için gerçek ölçüm kapsamını artırmaz. Açık yüzeyde doğrudan yaşam kontrolü de bunu ölçüm saymaz.

Puanlamada kaynak ve veri türü de denetlenir: NASA arşivinde raporlanmış değerler, açıkça belirtilen proje ölçümleri ve yalnızca bu girdilerden basit formülle türetilen değerler puana girebilir. Herhangi bir girdisi tahmini olan türetimler, modeller ve kullanıcı girdileri ölçüm puanına ve kapsamına girmez; varsayımsal modelde ayrı gösterilir. Ötegezegen kataloğunda kütleden çıkarılan “yer altı ısı uygunluğu” ve yıldız akısından çıkarılan “radyasyon güvenliği” doğrudan ölçülmüş ölçüler değildir; bu nedenle bilinmiyor bırakılır. Yerçekimi puanına yalnızca NASA `pl_bmassprov=Mass` kütlesi ve arşiv yarıçapından hesaplandığında girer. `Msini`, `Msin(i)/sin(i)` veya provenance bilgisi eksik kütleyle hesaplanan yerçekimi ana puana girmez; ayrı varsayımsal modelde kaynak etiketiyle gösterilir. Kütle, yarıçap veya uzaklık gibi diğer türetilmiş/tahmini değerler satırda kaynak türüyle gösterilir.

Her senaryoda ayrıca **Varsayımsal model** gösterilir. Bu ikinci değer, bilinen ölçüt puanından ayrıdır; NASA/PHL tahminlerini ve PHL model sıcaklığını kullanabilir. Eksik NASA/PHL ölçütler nötr puan almaz; olası aralığın alt sınırında 0, üst sınırında 100 kabul edilir ve model kapsamına ölçüm olarak eklenmez. Denge sıcaklığı yıldız enerjisinden türetildiği için ikisi birlikte puanlanmaz. Yıldız enerjisi mevcutsa varsayımsal modelde korunur; ilişkili PHL/NASA sıcaklık ölçütü model paydasından çıkarılır, böylece yıldız enerjisi kaybolmadan çift sayım önlenir. Yıldız sınıfı için 10/110 ağırlıklı bir bağlam varsayımı kullanılır. NASA, K cücelerini uzun ana kol ömürleri ve M cücelerine göre daha ılımlı etkinlikleri nedeniyle yaşam arayışı için umut verici hedefler arasında tartışır ([NASA](https://www.nasa.gov/universe/goldilocks-stars-may-be-just-right-for-finding-habitable-worlds/)). Projedeki yıldız sınıfı katsayıları (K: 85, G: 75, M: 65, F: 60, A: 45, B: 35, O: 25) bilimsel olasılık değildir; yalnızca keşif amaçlı bir varsayımdır. Bu nedenle yıldız tipi tek başına gezegenin yaşanabilir olduğunu göstermez.
