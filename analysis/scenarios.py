"""Scenario definitions. Weights are project assumptions, not NASA values."""

SCENARIOS = {
    "surface": {
        "name": "Yüzey yerleşimi",
        "description": "Yüzey koşullarında yaşam destek ihtiyacını değerlendirir.",
        "weights": {"temperature": 30, "radius": 15, "gravity": 20, "density": 10, "insolation": 25},
    },
    "underground": {
        "name": "Yer altı yerleşimi",
        "description": "Yer çekimi, gezegen yapısı ve enerji ihtiyacını öne çıkarır.",
        "weights": {"radius": 15, "gravity": 20, "density": 20, "water": 20, "geothermal": 10, "geology": 15},
    },
    "orbital": {
        "name": "Yörünge istasyonu",
        "description": "Güneş enerjisi, yıldız sistemi uzaklığı ve kaynak erişimini değerlendirir.",
        "weights": {"insolation": 35, "access": 35, "radiation": 20, "water": 10},
    },
}

INDICATORS = {
    "temperature": {"name": "Denge sıcaklığı", "unit": "K", "ideal": 288, "tolerance": 110},
    "radius": {"name": "Yarıçap", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1.5},
    "gravity": {"name": "Yerçekimi", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1},
    "density": {"name": "Yoğunluk göstergesi", "unit": "Dünya = 1", "ideal": 1, "tolerance": 1.5},
    "insolation": {"name": "Yıldız enerjisi", "unit": "Dünya akısı = 1", "ideal": 1, "tolerance": 1.5},
    "access": {"name": "Dünya'ya sistem uzaklığı", "unit": "ışık yılı (yakınlık göstergesi)", "ideal": 0, "tolerance": 1000},
    "radiation": {"name": "Radyasyon güvenliği", "unit": "0–1 ölçüm", "ideal": None, "tolerance": None},
    "water": {"name": "Su / yerel kaynak", "unit": "0–1 ölçüm", "ideal": None, "tolerance": None},
    "geothermal": {"name": "Yer altı ısı koşulları", "unit": "ölçüm gerekli", "ideal": None, "tolerance": None},
    "geology": {"name": "Jeolojik kararlılık", "unit": "ölçüm gerekli", "ideal": None, "tolerance": None},
}
