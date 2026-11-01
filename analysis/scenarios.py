"""Scenario definitions. Weights are project assumptions, not NASA values."""

# Üç koloni senaryosu: adı, açıklaması ve ölçüt ağırlıkları (her senaryoda toplam 100).
# Ağırlıkların gerekçesi aşağıda WEIGHT_RATIONALE'de.
SCENARIOS = {
    "surface": {
        "name": "Kubbe yerleşimi",
        "description": "Basınçlı kubbe ve yaşam destek sistemleriyle yüzey yerleşiminin zorluklarını değerlendirir.",
        "interpretation": "Basınçlı ve kapalı bir habitat için fiziksel ön eleme yapar; açık havada yaşanabilirliği göstermez. Ötegezegen denge sıcaklığı gerçek yüzey sıcaklığı değildir.",
        "weights": {
            "temperature": 20, "radius": 15, "gravity": 10, "insolation": 15,
            "surface_pressure_bar": 25, "atmosphere_suitability": 15,
        },
    },
    "underground": {
        "name": "Yer altı sığınağı",
        "description": "Yer altı yerleşimi için yerel jeoloji ve erişim, erişilebilir kaynaklar, radyasyon koruması ve termal koşulları; gezegen ölçeğindeki fiziksel göstergelerden daha yüksek ağırlıkla değerlendirir.",
        "interpretation": "Yarıçap, kütle ve denge sıcaklığı belirli bir mağaranın, kazılabilir zeminin, erişilebilir suyun veya güvenli radyasyon seviyesinin kanıtı değildir. Yerel saha verileri olmadan puan bir ön elemedir.",
        "weights": {"geology": 30, "water": 22, "radiation": 20, "subsurface_temperature": 8, "geothermal": 8, "gravity": 6, "density": 4, "radius": 2},
    },
    "orbital": {
        "name": "Yörünge habitatı",
        "description": "Güneş enerjisi, radyasyon, su ve Dünya'ya uzaklığı düşük ağırlıklı bir erişim vekili olarak değerlendirir.",
        "interpretation": "Gezegen sistemindeki habitat için kaba kaynak ve erişim vekillerini kullanır; görev yörüngesindeki radyasyon ve yaşam destek uygulanabilirliğini ölçmez.",
        "weights": {"insolation": 35, "escape_velocity": 30, "hill_window": 25, "access": 10},
    },
}

# Arayüzde gösterilen 'gerekenler' ve 'dikkat edilecekler' listeleri.
SCENARIO_GUIDANCE = {
    "surface": {
        "requirements": [
            "Basınç ve sıcaklık kontrolü sağlayan kapalı habitat",
            "Atmosferi izleme, arıtma ve yaşam destek sistemi",
            "Yerel radyasyon dozu ve su kaynakları için saha ölçümü",
        ],
        "watchouts": [
            "Bu puan tek başına korumasız yüzeyde yaşanabilirlik anlamına gelmez.",
            "Ötegezegenlerde denge sıcaklığı gerçek yüzey sıcaklığı değildir.",
        ],
        "surface_options": {
            "open_surface": ["Yüzey sıcaklığı", "Yüzey basıncı", "Solunabilir atmosfer", "Yerel radyasyon ve su ölçümü"],
            "dome": ["Basınçlı habitat gövdesi", "Isı kontrolü", "Atmosfer ve toksisite yönetimi", "Yerel radyasyon kalkanı tasarımı"],
            "shielded_surface": ["Yerel radyasyon dozu", "Regolit kalınlığı ve özellikleri", "Zemin/yapı kararlılığı", "Habitat giriş ve hava kilidi"],
            "venus_aerostat": ["İrtifaya bağlı basınç ve sıcaklık", "Rüzgâr ve asitli bulut dayanımı", "Yüzdürme gazı ve platform tasarımı"],
        },
    },
    "underground": {
        "requirements": [
            "Yerel jeoloji, zemin dayanımı ve sığınak kararlılığı",
            "Yer altı sıcaklık profili ve erişilebilir su/uçucu madde ölçümü",
            "Kazı veya doğal mağaraya erişim ve yaşam destek lojistiği",
        ],
        "watchouts": [
            "Küresel gezegen verisi belirli bir mağaranın varlığını veya güvenliğini doğrulamaz.",
            "Radyasyon koruması için derinlik ve yerel doz birlikte ölçülmelidir.",
        ],
    },
    "orbital": {
        "requirements": [
            "Görev yörüngesi ve radyasyon ortamının ayrı modellenmesi",
            "Kalkan malzemesi, kapalı devre su ve yaşam destek sistemi",
            "Güç üretimi, ısı kontrolü ve ikmal/erişim planı",
        ],
        "watchouts": [
            "Yıldız enerjisi, tehlikeli parçacık radyasyonu ölçümü değildir.",
            "Gezegenin ortalama verisi tek başına yörüngedeki dozu belirlemez.",
        ],
    },
}

# Her ölçütün adı, birimi ve puanlama kuralı: ideal ± tolerans, ya da tek yönlü eşik
# (lower_better: düşük daha iyi, higher_better: yüksek daha iyi), ya da 0–1 normalize.
INDICATORS = {
    "temperature": {"name": "Denge sıcaklığı", "unit": "K", "ideal": 288, "tolerance": 110},
    "subsurface_temperature": {"name": "Denge sıcaklığı (yer altı ısı vekili)", "unit": "K", "ideal": 288, "tolerance": 150},
    "radius": {"name": "Yarıçap", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1.5},
    "gravity": {"name": "Yerçekimi", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1},
    "density": {"name": "Yoğunluk göstergesi", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1.5},
    "escape_velocity": {"name": "Kaçış hızı", "unit": "km/s", "direction": "lower_better", "threshold": 20},
    "hill_window": {"name": "Kararlı yörünge penceresi", "unit": "gezegen yarıçapı (yaklaşık 0,49 Hill bölgesi)", "direction": "higher_better", "threshold": 30},
    "insolation": {"name": "Yıldız enerjisi", "unit": "Dünya akısı = 1", "ideal": 1, "tolerance": 1.5},
    "access": {"name": "Dünya'ya uzaklık (çok düşük ağırlıklı erişim vekili)", "unit": "ışık yılı", "ideal": 0, "tolerance": 1000},
    "surface_pressure_bar": {"name": "Dış basınç (1 bar kabin farkı)", "unit": "bar", "ideal": 1, "tolerance": 2},
    "atmosphere_suitability": {"name": "Atmosfer yönetimi", "unit": "0–1 ölçeği", "ideal": 1, "tolerance": 1},
    "radiation": {"name": "Radyasyon güvenliği", "unit": "0–1 uygunluk", "ideal": 1, "tolerance": 1, "scale": "normalized"},
    "water": {"name": "Su / yerel kaynak", "unit": "0–1 uygunluk", "ideal": 1, "tolerance": 1, "scale": "normalized"},
    "geothermal": {"name": "Yer altı ısı koşulları", "unit": "0–1 uygunluk", "ideal": 1, "tolerance": 1, "scale": "normalized"},
    "geology": {"name": "Yerel jeoloji, erişim ve kararlılık", "unit": "0–1 uygunluk", "ideal": 1, "tolerance": 1, "scale": "normalized"},
}

# Project guardrails for unprotected, human-compatible surface conditions.
# These are screening assumptions, not universal biological limits.
# Açık yüzeyde korumasız yaşam ön elemesi için sıcaklık ve basınç aralıkları (proje varsayımı).
SURFACE_GUARDRAILS = {
    "temperature_kelvin": (180, 373.15),
    "surface_pressure_bar": (0.5, 2.0),
}

# Why each weight has its value. Weights are reasoned project assumptions: they were not
# derived with pairwise comparison (AHP) or calibration. analysis/sensitivity.py measures
# how much the ranking depends on them. Keep this next to SCENARIOS so a weight never
# changes without its reason; /api/analyze and /api/methodology serve it (e.g. to an AI report).
# Ağırlık gerekçelerinde kullanılan kaynaklar (kısa ad → açıklama ve bağlantı).
WEIGHT_SOURCES = {
    "esi": {
        "label": "Schulze-Makuch ve ark. (2011), Astrobiology · Dünya Benzerlik İndeksi ağırlıkları (yarıçap 0,57 · yoğunluk 1,07 · kaçış hızı 0,70 · yüzey sıcaklığı 5,58)",
        "url": "https://phl.upr.edu/projects/earth-similarity-index-esi",
    },
    "habitable_zone": {
        "label": "Kasting, Kopparapu ve ark. (2014), PNAS · yaşanabilir bölge sınırları: 0,35–1,01 Dünya akısı (iyimser 0,32–1,78)",
        "url": "https://arxiv.org/abs/1312.1328",
    },
    "rocky_limit": {
        "label": "Rogers (2015), ApJ · yaklaşık 1,6 Dünya yarıçapı üzerindeki gezegenlerin çoğu kayalık değil (keskin sınır değil, olasılıksal geçiş)",
        "url": "https://arxiv.org/abs/1407.4457",
    },
    "rocket_equation": {
        "label": "Tsiolkovsky roket denklemi · gereken itici madde Δv ile üstel artar (proje fizik hesabı)",
        "url": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/",
    },
    "hill_stability": {
        "label": "Hill küresi · prograde yörüngeler yaklaşık 0,49 Hill yarıçapı içinde kararlı kabul edildi (proje fizik hesabı)",
        "url": None,
    },
    "project": {
        "label": "Proje varsayımı · literatürde bu senaryo için sayısal ağırlık yok; gerekçe metinde açıklandı",
        "url": None,
    },
}

# Her senaryonun genel mantığı (basis) ve her ağırlığın gerekçesi ile kaynakları.
# Testler her ağırlığın burada gerekçesi olmasını zorunlu tutar.
WEIGHT_RATIONALE = {
    "surface": {
        "basis": "Basınçlı kubbede habitatın yapısını ve yaşam destek yükünü belirleyen dış koşullara öncelik verildi: basınç, sıcaklık ve atmosfer toplam %60. Gezegen ölçeği (yarıçap, yerçekimi) ve enerji kalan %40.",
        "indicators": {
            "surface_pressure_bar": {
                "reason": "Kubbe kabuğunun taşıyacağı basınç farkı yapısal tasarımı en çok belirleyen dış koşul. Vakumda kabuk yalnızca iç basıncı taşır; Venüs gibi yüksek basınçta yapı içe doğru ezilir. Bu yüzden en yüksek ağırlık.",
                "sources": ["project"],
            },
            "temperature": {
                "reason": "Isıtma/soğutma yükünü belirler. ESI'de yüzey sıcaklığı açık ara en yüksek ağırlığa sahip (5,58). İdeal 288 K Dünya ortalaması; ±110 K tolerans proje ön eleme aralığına (180–373 K) yakın.",
                "sources": ["esi"],
            },
            "radius": {
                "reason": "Katı yüzey olasılığının vekili: yaklaşık 1,6 Dünya yarıçapının üzerinde gezegenlerin çoğu kalın gaz zarfı taşır. ESI'de de bir bileşen.",
                "sources": ["rocky_limit", "esi"],
            },
            "insolation": {
                "reason": "Güneş enerjisi üretimi ve ısı dengesi. Yaşanabilir bölge yaklaşık 0,35–1,01 Dünya akısı; kubbe sıvı su şartına bağlı olmadığı için tolerans (±1,5) bu aralıktan geniş tutuldu.",
                "sources": ["habitable_zone"],
            },
            "atmosphere_suitability": {
                "reason": "Solunabilir atmosfer yaşam destek yükünü azaltır, zararlı atmosfer artırır. Ölçüt kaba (solunabilir 1, diğer 0,5) olduğu için ağırlığı basınçtan düşük tutuldu.",
                "sources": ["project"],
            },
            "gravity": {
                "reason": "İnsan sağlığı ve iniş/kalkış maliyeti. Uzun süreli düşük veya yüksek yerçekiminin insana etkisi tam bilinmediği ve yarıçap/yoğunlukla kısmen örtüştüğü için en düşük ağırlık.",
                "sources": ["esi", "project"],
            },
        },
    },
    "underground": {
        "basis": "Yer altı yerleşiminde başarıyı yerel saha koşulları belirler; gezegen ölçeğindeki büyüklükler yalnızca dolaylı vekildir. Bu yüzden jeoloji, su ve radyasyon toplam %72, gezegen ölçeği vekilleri %28.",
        "indicators": {
            "geology": {
                "reason": "Mağara/tünel varlığı, zemin dayanımı ve kazılabilirlik yerleşimin fiziksel olarak kurulabilmesinin ön şartı; bu yüzden en yüksek ağırlık.",
                "sources": ["project"],
            },
            "water": {
                "reason": "Su ve uçucu maddeler yaşam desteği ve yakıt üretimi için yerinde kullanılabilir; Dünya'dan taşıma ihtiyacını en çok azaltan kaynak.",
                "sources": ["project"],
            },
            "radiation": {
                "reason": "Yer altına inmenin temel amacı radyasyondan korunmak; yerel doz ve gereken derinlik ölçülmeden yerleşim tasarlanamaz.",
                "sources": ["project"],
            },
            "subsurface_temperature": {
                "reason": "Denge sıcaklığı yer altı sıcaklığını ölçmez, yalnızca kaba termal vekil; bu yüzden düşük ağırlık.",
                "sources": ["project"],
            },
            "geothermal": {
                "reason": "Isı ve enerji kaynağı olabilir ama ötegezegenlerde ölçülemiyor; düşük ağırlık.",
                "sources": ["project"],
            },
            "gravity": {
                "reason": "Kazı ve inşaat yükleri ile insan sağlığı; yerel koşullara göre dolaylı.",
                "sources": ["project"],
            },
            "density": {
                "reason": "Kayalık iç yapının vekili; ESI'de de bir bileşen. Gerçek kütle gerektirdiği için çoğu gezegende bilinmiyor.",
                "sources": ["esi"],
            },
            "radius": {
                "reason": "En dolaylı vekil: belirli bir saha hakkında bilgi vermez, yalnızca katı yüzey olasılığına işaret eder.",
                "sources": ["rocky_limit"],
            },
        },
    },
    "orbital": {
        "basis": "Yörünge habitatında yüzey koşulları belirleyici değildir; enerji ve gezegenle malzeme alışverişinin maliyeti belirleyicidir.",
        "indicators": {
            "insolation": {
                "reason": "Güneş paneli gücü ve termal tasarım doğrudan yıldız akısına bağlı; yörüngede başlıca enerji kaynağı.",
                "sources": ["habitable_zone"],
            },
            "escape_velocity": {
                "reason": "Yüzeyden yörüngeye malzeme taşımak için gereken Δv kaçış hızıyla artar ve roket denkleminde itici madde ihtiyacı üstel büyür.",
                "sources": ["rocket_equation"],
            },
            "hill_window": {
                "reason": "Gezegen çevresinde kararlı yörünge kurulabilecek bölgenin büyüklüğü; küçük pencere istasyonun yerleşebileceği yörüngeleri sınırlar.",
                "sources": ["hill_stability"],
            },
            "access": {
                "reason": "Dünya'ya uzaklık lojistik vekili. Bütün ötegezegenler insanlı erişimin çok dışında olduğu için ayırt ediciliği düşük; en düşük ağırlık.",
                "sources": ["project"],
            },
        },
    },
}

WEIGHT_DERIVATION_NOTE = (
    "Ağırlıklar proje ekibinin gerekçeli varsayımıdır; ikili karşılaştırma (AHP) veya kalibrasyonla türetilmemiştir. "
    "Koloni uygunluğu için literatürde uzlaşılmış sayısal ağırlıklar yoktur. Duyarlılık analizi, ağırlıklar değiştiğinde "
    "sıralamanın ne kadar korunduğunu gösterir."
)
