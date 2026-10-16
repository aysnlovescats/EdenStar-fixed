"""Planet composition and surface-colonization feasibility classification."""


def classify_planet(radius_earth, mass_earth, density_earth=None, temperature_k=None):
    """Classify planet and determine whether surface/underground scenarios apply."""
    # 1. Kesin Gaz / Buz Devi Sınırları (Yarıçap >= 2.5 R_E veya Kütle >= 15 M_E veya çok düşük yoğunluk)
    if (radius_earth is not None and radius_earth >= 2.5) or \
       (mass_earth is not None and mass_earth >= 15.0) or \
       (density_earth is not None and density_earth < 0.35 and (radius_earth or 0) > 1.5):
        return {
            "kind": "gas_ice_giant",
            "label": "Gaz / Buz Devi (Katı yüzey yok)",
            "surface_applicable": False,
            "underground_applicable": False,
            "reason": "Yarıçap, kütle veya düşük yoğunluk değeri gezegenin kalın bir gaz/buz zarfına sahip olduğunu gösteriyor; yalnızca yörünge istasyonu kurulabilir.",
        }

    # 2. Aşırı Sıcak Lav / Magma Okyanusu Gezegenleri (T > 800 K)
    if temperature_k is not None and temperature_k >= 800:
        return {
            "kind": "lava_world",
            "label": "Aşırı Sıcak / Lav Gezegeni",
            "surface_applicable": False,
            "underground_applicable": False,
            "reason": f"Denge sıcaklığı ({round(temperature_k)} K) kayaç erime ve yaşam destek sınırlarının çok üzerinde; yüzey veya yer altı yerleşimi kurulamaz.",
        }

    # 3. Geçiş Bölgesi (Sub-Neptune / Mini-Neptün veya Süper-Dünya: 1.6 < R < 2.5)
    if (radius_earth is not None and radius_earth > 1.6) or (mass_earth is not None and mass_earth > 5.0):
        return {
            "kind": "sub_neptune_or_super_earth",
            "label": "Süper-Dünya / Mini-Neptün (Geçiş Sınıfı)",
            "surface_applicable": True,
            "underground_applicable": True,
            "penalty": 0.85,  # Kalın atmosfer / yüksek basınç riski cezası
            "reason": "1.6–2.5 Dünya yarıçapı aralığındaki gezegenler yüksek basınçlı kalın atmosfer veya okyanus tabakası barındırabilir; yüzey/yer altı puanına %15 ihtiyat payı uygulanır.",
        }

    # 4. Kayalık / Karasal Aday
    return {
        "kind": "terrestrial_candidate",
        "label": "Kayalık / Karasal Gezegen Adayı",
        "surface_applicable": True,
        "underground_applicable": True,
        "penalty": 1.0,
        "reason": "Boyut ve kütle parametreleri katı kabuklu karasal gezegen/uydu modeliyle uyumludur.",
    }