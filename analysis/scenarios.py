"""Scenario definitions with scenario-specific physical ideals and tolerances."""

SCENARIOS = {
    "surface": {
        "name": "Yüzey yerleşimi (Kubbe / Açık)",
        "description": "Yüzey sıcaklığı, atmosfer tutma kapasitesi (kaçış hızı), yerçekimi ve radyasyon güvenliğini değerlendirir.",
        "weights": {
            "temperature": 25,
            "gravity": 20,
            "escape_vel": 15,
            "insolation": 15,
            "radiation": 15,
            "density": 10,
        },
        "overrides": {
            "temperature": {"ideal": 288, "tolerance": 85},  # 203K (-70C) ile 373K (+100C) arası
        },
    },
    "underground": {
        "name": "Yer altı yerleşimi (Mağara / Lav Tüpü)",
        "description": "Kayaç yoğunluğu, yerçekimi, genişletilmiş kabuk sıcaklığı toleransı ve jeotermal iç ısıyı değerlendirir.",
        "weights": {
            "density": 25,
            "gravity": 25,
            "temperature": 20,
            "geothermal": 15,
            "radius": 10,
            "radiation": 5,
        },
        "overrides": {
            # Yer altında kayaç yalıtımı sayesinde daha soğuk (Mars/Ay/Europa) veya ılıman gezegenler uygundur;
            # ancak yüzey sıcaklığı 480K üstü olan gezegenlerde kabuk ısısı aşırı yükselir.
            "temperature": {"ideal": 250, "tolerance": 195},
        },
    },
    "orbital": {
        "name": "Yörünge istasyonu",
        "description": "Güneş enerjisi verimi, Dünya'ya lojistik yakınlık, radyasyon güvenliği ve yörünge kararlılığını değerlendirir.",
        "weights": {
            "insolation": 30,
            "access": 30,
            "radiation": 20,
            "eccentricity": 10,
            "escape_vel": 10,
        },
        "overrides": {
            "insolation": {"ideal": 1.0, "tolerance": 2.2},
            "escape_vel": {"ideal": 1.2, "tolerance": 2.5},  # Gaz devlerinin yörüngelerine de uyumlu
        },
    },
}

INDICATORS = {
    "temperature": {"name": "Denge / Yüzey sıcaklığı", "unit": "K", "ideal": 288, "tolerance": 90, "mode": "linear"},
    "radius": {"name": "Gezegen yarıçapı", "unit": "Dünya = 1", "ideal": 1.0, "tolerance": 1.2, "mode": "log"},
    "gravity": {"name": "Yüzey yerçekimi", "unit": "g (Dünya = 1)", "ideal": 1.0, "tolerance": 0.9, "mode": "log"},
    "density": {"name": "Yığın yoğunluğu (Kayaç yapısı)", "unit": "Dünya = 1", "ideal": 1.0, "tolerance": 0.85, "mode": "log"},
    "escape_vel": {"name": "Atmosfer tutma / Kaçış hızı", "unit": "Dünya = 1", "ideal": 1.0, "tolerance": 0.95, "mode": "log"},
    "insolation": {"name": "Yıldız enerjisi (Akı)", "unit": "Dünya = 1", "ideal": 1.0, "tolerance": 1.2, "mode": "log"},
    "access": {"name": "Dünya'ya uzaklık", "unit": "parsek", "ideal": 0.0, "tolerance": 150.0, "mode": "distance"},
    "radiation": {"name": "Radyasyon güvenliği indeksi", "unit": "0–1", "ideal": 1.0, "tolerance": 1.0, "mode": "direct"},
    "geothermal": {"name": "Jeotermal / İç ısı dengesi", "unit": "0–1", "ideal": 1.0, "tolerance": 1.0, "mode": "direct"},
    "eccentricity": {"name": "Yörünge kararlılığı (Dışmerkezlik)", "unit": "e", "ideal": 0.0, "tolerance": 0.35, "mode": "zero_ideal"},
}