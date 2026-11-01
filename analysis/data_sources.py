"""Scenario-specific planetary data sources and their measurement scope."""

# Senaryo ve cisme göre gösterilecek veri kaynağı kartları (NASA veri setleri, görev ölçümleri, PHL modeli).
# Bilgi içindir; puana girmez.
DATA_SOURCES = [
    {
        "id": "exoplanet-archive",
        "body": "*",
        "scenarios": ["surface", "underground", "orbital"],
        "kind": "dataset",
        "label": "NASA Exoplanet Archive · Planetary Systems",
        "summary": "Yarıçap, kütle, yörünge ve yıldız verileri; bu analizde temel ötegezegen kaynağı.",
        "scope": "Ötegezegen kataloğu. Yüzey basıncı, yerel radyasyon, su veya jeoloji ölçümü sağlamaz.",
        "url": "https://exoplanetarchive.ipac.caltech.edu/docs/data.html",
    },
    {
        "id": "exoplanet-spectra",
        "body": "*",
        "scenarios": ["surface"],
        "kind": "dataset",
        "label": "NASA Exoplanet Archive · Atmospheric Spectroscopy",
        "summary": "Yayımlanmış bazı geçiş, tutulma ve doğrudan görüntüleme tayflarına erişim.",
        "scope": "Yalnızca belirli ötegezegenlerde var; tayf tek başına yüzey basıncını veya solunabilirliği doğrulamaz.",
        "url": "https://exoplanetarchive.ipac.caltech.edu/docs/atmospheres/atmospheres_home.html",
    },
    {
        "id": "exoplanet-phl-tsurf",
        "body": "*",
        "scenarios": ["surface"],
        "kind": "model",
        "label": "PHL Habitable Worlds Catalog · modellenmiş yüzey sıcaklığı",
        "summary": "Dünya'dakiyle aynı albedo ve sera etkisi varsayılarak hesaplanan tahmini yüzey sıcaklığı (Méndez ve Rivera-Valentín, 2017).",
        "scope": "Model tahminidir, ölçüm değildir; gerçek atmosfer bilinmediği için gerçek yüzey sıcaklığını doğrulamaz. Yalnızca bilgi olarak gösterilir, skora katılmaz.",
        "url": "https://phl.upr.edu/hwc",
    },
    {
        "id": "mars-rems",
        "body": "mars",
        "scenarios": ["surface"],
        "kind": "dataset",
        "label": "Mars · Curiosity REMS çevre ölçümleri",
        "summary": "Gale Krateri'nde sıcaklık, basınç, rüzgâr, nem ve UV ölçümleri.",
        "scope": "Yerel ve zamana bağlı rover ölçümleri; tüm Mars yüzeyini temsil etmez.",
        "url": "https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MSL-M-REMS-5-MODRDR-V1.0",
    },
    {
        "id": "mars-rad",
        "body": "mars",
        "scenarios": ["surface", "underground", "orbital"],
        "kind": "dataset",
        "label": "Mars · Curiosity RAD radyasyon ölçümleri",
        "summary": "RAD'ın ilk 10 aylık yüzey gözlemlerinde kozmik ışınlardan yaklaşık 210 µGy/gün soğurulan doz hızı ölçüldü.",
        "scope": "Bu, Gale Krateri ve belirli bir dönem için ölçümdür; habitat kalkanı veya tüm Mars için skor değildir.",
        "url": "https://science.nasa.gov/resource/radiation-measurements-on-mars/",
        "measurement": {"name": "Yayımlanmış doz hızı örneği", "value": 210, "unit": "µGy/gün", "location": "Gale Krateri · ilk 10 ay"},
    },
    {
        "id": "mars-hirise",
        "body": "mars",
        "scenarios": ["surface", "underground"],
        "kind": "dataset",
        "label": "Mars · HiRISE stereo arazi modelleri",
        "summary": "Seçilmiş alanlar için yüksek çözünürlüklü yükseklik modelleri ve ortogörüntüler.",
        "scope": "Bölgesel kapsama; yer seçimi ve eğim incelemesi için, küresel jeoloji puanı için değil.",
        "url": "https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MRO-M-HIRISE-5-DTM-V1.0",
    },
    {
        "id": "moon-diviner",
        "body": "ay",
        "scenarios": ["surface", "underground"],
        "kind": "dataset",
        "label": "Ay · LRO Diviner sıcaklık haritaları",
        "summary": "Gündüz/gece ve kutup bölgeleri için yüzey sıcaklığı, zaman ve hata katmanları.",
        "scope": "Konum ve yerel saate bağlı harita verisi; Ay için tek bir sıcaklık değeri değildir.",
        "url": "https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-DLRE-5-GDR-V1.0",
    },
    {
        "id": "moon-lola",
        "body": "ay",
        "scenarios": ["surface", "underground"],
        "kind": "dataset",
        "label": "Ay · LRO LOLA topoğrafya",
        "summary": "Lazer altimetre ölçümlerinden yükseklik profilleri ve arazi haritaları.",
        "scope": "Arazi ve eğim bağlamı sağlar; mağaranın varlığını veya yapısal güvenliğini tek başına kanıtlamaz.",
        "url": "https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-LOLA-2-EDR-V1.0",
    },
    {
        "id": "moon-minirf",
        "body": "ay",
        "scenarios": ["surface", "underground"],
        "kind": "dataset",
        "label": "Ay · LRO Mini-RF radar",
        "summary": "Özellikle kutup ve kalıcı gölgeli bölgeler için kalibre edilmiş radar görüntüleri.",
        "scope": "Radar imzaları saha incelemesine yardımcı olur; tek başına erişilebilir su veya yaşanabilir mağara doğrulaması değildir.",
        "url": "https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-MRFLRO-5-CDR-MAP-V1.0",
    },
    {
        "id": "titan-atmosphere",
        "body": "titan",
        "scenarios": ["surface"],
        "kind": "reference",
        "label": "Titan · NASA yüzey basıncı ve atmosfer bileşimi",
        "summary": "Yaklaşık 1.5 bar yüzey basıncı; atmosfer ağırlıkla azot ve metandan oluşur.",
        "scope": "Küresel atmosfer özellikleri; yerel hava, toksisite ve habitat mühendisliğini tek başına belirlemez.",
        "url": "https://science.nasa.gov/saturn/moons/titan/facts/",
    },
    {
        "id": "venus-gram",
        "body": "venus",
        "scenarios": ["surface", "orbital"],
        "kind": "model",
        "label": "Venüs · Venus-GRAM irtifa atmosfer modeli",
        "summary": "Yüksekliğe göre basınç, sıcaklık, yoğunluk, bileşim ve rüzgâr tahminleri.",
        "scope": "Mühendislik modelidir; doğrudan yerel ölçüm değildir ve asit bulutu/yapı dayanımını tek başına çözmez.",
        "url": "https://software.nasa.gov/software/MFS-32314-1",
    },
    {
        "id": "venus-havoc",
        "body": "venus",
        "scenarios": ["surface"],
        "kind": "study",
        "label": "Venüs · HAVOC yüksek irtifa konsepti",
        "summary": "Yaklaşık 50 km irtifada hava platformu fikrini inceleyen NASA konsept çalışması.",
        "scope": "Görev/yerleşim konsepti; doğrulanmış bir görev veya kullanılabilir yerel veri seti değildir.",
        "url": "https://www.nasa.gov/general/havoc/",
    },
    {
        "id": "underground-shelters",
        "body": ["mars", "ay"],
        "scenarios": ["underground"],
        "kind": "study",
        "label": "Ay ve Mars · olası lav tüneli sığınakları",
        "summary": "Lav tünelleri ve mağaraların radyasyon, mikrometeorit ve sıcaklık koruması sağlayabilme olasılığı.",
        "scope": "Aday bölgeler için araştırma konusu; her gökcisminde doğrulanmış, küresel mağara haritası değildir.",
        "url": "https://science.nasa.gov/blogs/science-news/2025/09/26/hammering-out-shelter-on-moon-and-mars/",
    },
    {
        "id": "oltaris",
        "body": "*",
        "scenarios": ["orbital"],
        "kind": "model",
        "label": "Yörünge/habitat tasarımı · NASA OLTARIS",
        "summary": "Yörünge, radyasyon ortamı ve kalkan malzemesine göre radyasyon etkisini modeller.",
        "scope": "Planet düzeyinde sabit veri değildir; görev yörüngesi ve habitat tasarım girdisi ister, hesaplama için kayıt gerekir.",
        "url": "https://oltaris.nasa.gov/",
    },
]


# Seçilen cisim ve senaryo için uygun kaynak kartlarını süzer: ötegezegenlere yalnızca genel ('*') ve
# ötegezegen kaynakları, Güneş Sistemi cisimlerine o cisme ait kaynaklar gösterilir.
def scenario_data_sources(host, planet_name, scenario_id):
    """Return applicable references without implying their values are global or scored."""
    if host.casefold() == "güneş sistemi":
        body = "ay" if planet_name.casefold() == "ay" else planet_name.casefold()
    else:
        body = "exoplanet"

    results = []
    for source in DATA_SOURCES:
        if scenario_id not in source["scenarios"]:
            continue
        if source["id"].startswith("exoplanet-") and body != "exoplanet":
            continue
        if not source["id"].startswith("exoplanet-") and body == "exoplanet" and source["body"] != "*":
            continue
        if source["body"] != "*" and body not in ([source["body"]] if isinstance(source["body"], str) else source["body"]):
            continue
        results.append({key: value for key, value in source.items() if key != "scenarios"})
    return results
