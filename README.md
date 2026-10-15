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
- `analysis/scenarios.py`: senaryo ağırlıklarını, ölçütleri ve hedef aralıklarını içerir
- `analysis/scoring.py`: ölçüt puanlarını, kapsama oranını ve toplam skoru hesaplar
- `analyze_planets.py`: CSV için toplu değerlendirme raporu

Harita için koordinatı/uzaklığı bilinmeyen yıldızlar 0 konumuna çizilmez. Eksik gezegen yörüngesi yalnızca görsel olarak temsil edilir ve gerçek uzaklık gibi gösterilmez. `pl_eqt` denge sıcaklığıdır; Güneş Sistemi girdileri yüzey sıcaklığı kullanır.

## Koloni senaryoları

Analiz kartındaki Yüzey / Yer altı / Yörünge düğmeleri, yalnızca seçilen senaryonun skorunu ve göstergelerini açar. Her senaryonun ölçütleri farklıdır: yüzey için sıcaklık/yerçekimi/yıldız enerjisi; yer altı için yoğunluk/yerçekimi ve gelecekte eklenecek jeotermal, jeoloji ve su ölçümleri; yörünge için yıldız enerjisi ve Dünya'ya sistem uzaklığı (yakınlık vekili). Her sayısal gösterge, senaryo dosyasındaki ideal değer ve toleransa göre `max(0, 1 - |ölçüm - ideal| / tolerans)` formülüyle 0–100 puana çevrilir; toplam puan mevcut göstergelerin ağırlıklı ortalamasıdır. Eksik ölçüm sıfır sayılmaz, puan hesabından çıkarılır; toplam ağırlığa göre veri kapsamı ayrıca görünür. En az iki ölçüm ve %30 kapsam yoksa yanıltıcı toplam skor yerine “Skor hesaplanamadı” gösterilir.

Bu, NASA'nın yayımladığı bir koloni puanı değildir. NASA arşivindeki ölçümlere uygulanan, proje kapsamında açıkça tanımlanmış ve tekrar üretilebilir bir uygunluk endeksidir. Ağırlıklar ve hedefler `analysis/scenarios.py` içinde değiştirilebilir. Ötegezegenlerin çoğunda radyasyon, yerel su ve yerleşim erişimi ölçümleri olmadığından ilgili ölçütler bilinmiyor kalır. Özellikle yörünge istasyonu skorunun hesaplanabilmesi için su/radyasyon veya başka doğrulanmış yörünge kaynak verisinin eklenmesi gerekir.
