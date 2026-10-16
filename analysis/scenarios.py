"""Scenario definitions. Weights are project assumptions, not NASA values."""

SCENARIOS = {
    "surface": {
        "name": "Kubbe yerleşimi",
        "description": "Basınçlı kubbe ve yaşam destek sistemleriyle yüzey yerleşiminin zorluklarını değerlendirir.",
        "weights": {
            "temperature": 20, "radius": 15, "gravity": 10, "insolation": 15,
            "surface_pressure_bar": 25, "atmosphere_suitability": 15,
        },
    },
    "underground": {
        "name": "Yer altı sığınağı",
        "description": "Yer altı yerleşiminin yerçekimi, kaynak, ısı ve jeolojik kararlılık gereksinimlerini değerlendirir.",
        "weights": {"radius": 20, "gravity": 20, "water": 20, "geothermal": 20, "geology": 20},
    },
    "orbital": {
        "name": "Yörünge habitatı",
        "description": "Güneş enerjisi, radyasyon, su ve Dünya'ya uzaklığı düşük ağırlıklı bir erişim vekili olarak değerlendirir.",
        "weights": {"insolation": 45, "access": 5, "radiation": 25, "water": 25},
    },
}

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

INDICATORS = {
    "temperature": {"name": "Denge sıcaklığı", "unit": "K", "ideal": 288, "tolerance": 110},
    "radius": {"name": "Yarıçap", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1.5},
    "gravity": {"name": "Yerçekimi", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1},
    "density": {"name": "Yoğunluk göstergesi", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1.5},
    "insolation": {"name": "Yıldız enerjisi", "unit": "Dünya akısı = 1", "ideal": 1, "tolerance": 1.5},
    "access": {"name": "Dünya'ya uzaklık (çok düşük ağırlıklı erişim vekili)", "unit": "ışık yılı", "ideal": 0, "tolerance": 1000},
    "surface_pressure_bar": {"name": "Dış basınç (1 bar kabin farkı)", "unit": "bar", "ideal": 1, "tolerance": 2},
    "atmosphere_suitability": {"name": "Atmosfer yönetimi", "unit": "0–1 ölçeği", "ideal": 1, "tolerance": 1},
    "radiation": {"name": "Radyasyon güvenliği", "unit": "0–1 uygunluk", "ideal": 1, "tolerance": 1, "scale": "normalized"},
    "water": {"name": "Su / yerel kaynak", "unit": "0–1 uygunluk", "ideal": 1, "tolerance": 1, "scale": "normalized"},
    "geothermal": {"name": "Yer altı ısı koşulları", "unit": "0–1 uygunluk", "ideal": 1, "tolerance": 1, "scale": "normalized"},
    "geology": {"name": "Jeolojik kararlılık", "unit": "0–1 uygunluk", "ideal": 1, "tolerance": 1, "scale": "normalized"},
}

# Project guardrails for unprotected, human-compatible surface conditions.
# These are screening assumptions, not universal biological limits.
SURFACE_GUARDRAILS = {
    "temperature_kelvin": (180, 373.15),
    "surface_pressure_bar": (0.5, 2.0),
}
