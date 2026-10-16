# ExoHabitat

Bu sürüm NASA Exoplanet Archive CSV dosyasını kullanır. Koloni puanı NASA'nın resmî puanı değil, projenin tanımladığı bir ön eleme endeksidir.

## Windows'ta çalıştırma
1. Bu klasörü VS Code'da aç.
2. Terminalde bir kez `python -m pip install flask` çalıştır.
3. `python app.py` ile sunucuyu başlat.
4. Tarayıcıda `http://127.0.0.1:5000` adresini aç. Sunucuyu kapatmak için terminalde Ctrl+C.

Live Server, Python analiz API'sini başlatmadığından kullanılmamalı. Three.js/PapaParse CDN için internet gerekir.

## Dosyalar
- `index/index.html`: yıldız haritası
- `index/system-view.html`: sistem/gezegen görünümü
- `js/main.js`: harita ve sisteme geçiş (aktif dosyadır)
- `js/system-view.js`: sistem görünümü, gezegen seçimi ve analiz kartı
- `js/planet_data.js`: CSV yükleme ve güvenli eksik değer dönüşümü
- `app.py`: yerel web/API sunucusu; analiz hesabını yapmaz, modülleri çağırır
- `analysis/metrics.py`: NASA CSV değerlerini temizler ve türetilebilir fiziksel göstergeleri hesaplar
- `analysis/classification.py`: bileşim iddiasında bulunmadan yarıçapa göre boyut sınıfı verir
- `analysis/scenarios.py`: senaryo ağırlıklarını, ölçütleri ve hedef aralıklarını içerir
- `analysis/scoring.py`: ölçüt puanlarını, kapsama oranını ve toplam skoru hesaplar
- `analysis/surface_options.py`: açık yüzey, kubbe, regolit koruması ve Venüs yüksek irtifa alternatiflerini veri kapsamına göre sınıflandırır
- `analyze_planets.py`: CSV için toplu değerlendirme raporu

Harita için koordinatı/uzaklığı bilinmeyen yıldızlar 0 konumuna çizilmez. Eksik gezegen yörüngesi yalnızca görsel olarak temsil edilir ve gerçek uzaklık gibi gösterilmez. `pl_eqt` denge sıcaklığıdır; Güneş Sistemi girdileri yüzey sıcaklığı kullanır.

## Koloni senaryoları

Ana yerleşim türleri önceki gibi **Yüzey / Yer altı / Yörünge** olarak kalır. Yüzey açıldığında seçenekler **Açık yüzeyde doğrudan yaşam**, **Basınçlı kubbe / habitat modülü** ve **Regolit ile örtülü / korumalı habitat** olarak ayrılır. Açık yüzey seçeneği sıcaklık, basınç ve solunabilir atmosferi birlikte ön elemeden geçirir; kubbe seçeneği mevcut yüzey puanını kullanır. Regolitli seçenek için yerel radyasyon, zemin ve malzeme ölçümleri gerekir; bunlar yoksa sayısal puan verilmez. Güneş Sistemi Venüs'ünde ayrıca yüzey dışı bir araştırma konsepti olan yüksek irtifa platformu gösterilir; yüzey ölçümleri bu konseptin puanı olarak kullanılmaz. Kubbe senaryosu sıcaklık %20, yarıçap %15, yerçekimi %10, yıldız enerjisi %15, dış basınç %25 ve atmosfer yönetimi %15 ağırlıktadır. Düşük basınç, solunamaz atmosfer veya zorlu sıcaklık puanı otomatik olarak 0 yapmaz; bunlar kubbe/yaşam destek yükü ve ölçüt puanlarıyla kademeli yansıtılır. Basınç puanı 1 barın altında `0,8 + 0,2 × basınç`, 1 bar ve üstünde `max(0, 1 - log10(basınç)/2)` formülünü kullanır; solunabilir atmosfer 1, diğer bilinen atmosfer türleri 0,5 olarak puanlanır. Basınç veya atmosfer ölçümü yoksa kapsam azalır ve bu belirsizlik ekranda gösterilir. Ölçülmüş yüzey sıcaklığı 180–373,15 K ve basınç 0,5–2 bar aralıkları bilgi amaçlı proje eşikleridir; evrensel yaşanabilirlik sınırı ya da puan vetosu değildir. NASA ötegezegen verisindeki denge sıcaklığı gerçek yüzey sıcaklığı olmadığından yüzey sıcaklığıyla aynı kabul edilmez. Yer altı senaryosu yarıçap, yerçekimi, su, jeotermal koşullar ve jeolojik kararlılığı eşit ağırlıkla ele alır. Yörünge senaryosunda yıldız enerjisi %45, radyasyon %25, su %25 ve Dünya'ya uzaklık %5 ağırlıktadır. Uzaklık yalnızca kaba bir erişim vekilidir; gerçek yolculuk süresini veya maliyetini göstermez. Diğer sayısal göstergeler, senaryo dosyasındaki ideal değer ve toleransa göre `max(0, 1 - |ölçüm - ideal| / tolerans)` formülüyle 0–100 puana çevrilir; toplam puan senaryonun tüm ağırlıkları üzerinden hesaplanır. Eksik ölçütler puana katkı sağlamaz; bilinen ölçütlerin kapsamı ayrıca gösterilir. Tek ölçüm bile varsa kapsamı düşük kısmi puan hesaplanır, tüm ölçümler eksikse “Skor hesaplanamıyor” gösterilir.

Bu, NASA'nın yayımladığı bir koloni puanı değildir. NASA arşivindeki ölçümlere uygulanan, proje kapsamında açıkça tanımlanmış ve tekrar üretilebilir bir uygunluk endeksidir. Ağırlıklar ve hedefler `analysis/scenarios.py` içinde değiştirilebilir. Ötegezegenlerin çoğunda radyasyon, yerel su ve yerleşim erişimi ölçümleri olmadığından ilgili ölçütler bilinmiyor kalır. Özellikle yörünge istasyonu skorunun hesaplanabilmesi için su/radyasyon veya başka doğrulanmış yörünge kaynak verisinin eklenmesi gerekir.

## PHL ile karşılaştırma

Gezegen kataloğu kartlarında ve gezegen senaryo ayrıntılarında PHL verileri görünür. **PHL yaşanabilir adayları** sayfasında konservatif ve iyimser aday sınıfları ayrı listelenir; her grup içinde ESI yüksekten düşüğe sıralanır. ESI Dünya benzerliğini gösterir, yaşanabilirlik olasılığı veya proje koloni skoru değildir. Kaynak dosya, [PHL HWC veri sayfasındaki](https://phl.upr.edu/hwc/data) **Full Catalog (all exoplanets) CSV** dosyasıdır; `data/hwc.csv` adıyla kaydedilmelidir. PHL aday etiketi yaşam kanıtı değildir; katalogda eşleşme olmaması da yaşanamazlık anlamına gelmez.


## PHL modellenmiş yüzey sıcaklığı

`data/hwc.csv` içindeki `P_TEMP_SURF`, PHL'in Dünya'dakiyle aynı albedo ve sera etkisini varsayarak hesapladığı **model tahminidir**; ölçüm değildir ve büyük ölçüde yıldız akısından türer. Bu yüzden **skora katılmaz**; yalnızca bilgi olarak, "PHL model sıcaklığı" etiketiyle gösterilir (kayalık boyut sınıflarında bulunur). NASA denge sıcaklığı gibi, gerçek yüzey sıcaklığı yerine geçmediği için kapsamı da artırmaz. Açık yüzeyde doğrudan yaşam kontrolü de bunu ölçüm saymaz.
