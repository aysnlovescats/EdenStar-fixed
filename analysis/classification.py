"""Planet composition and surface-colonization feasibility classification."""

#sınıf,uygulanabilirlik,ceza katsayısı döndürü.
def classify_planet(radius_earth, mass_earth, density_earth=None, temperature_k=None):
    """Classify planet and determine whether surface/underground scenarios apply."""
    if radius_earth is None and mass_earth is None:
        return {
            "kind": "unknown",
            "label": "Sınıflandırılamadı",
            "surface_applicable": None,
            "underground_applicable": None,
            "reason": "Yarıçap veya kütle verisi yok; gezegen türü bilinmiyor.",
        }

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

    # High heat warns about habitat load; it does not establish molten rock.
    if temperature_k is not None and temperature_k >= 800:
        return {
            "kind": "extreme_heat",
            "label": "Aşırı Sıcak Yüzey",
            "surface_applicable": True,
            "underground_applicable": True,
            "reason": f"Ölçülmüş yüzey sıcaklığı ({round(temperature_k)} K) çok yüksek ısı kontrolü ve habitat yükü gerektirir; bu eşik kayaç erimesi iddiası değildir.",
        }

    # 3. Geçiş Bölgesi (Sub-Neptune / Mini-Neptün veya Süper-Dünya: 1.6 < R < 2.5)
    if (radius_earth is not None and radius_earth > 1.6) or (mass_earth is not None and mass_earth > 5.0):
        return {
            "kind": "sub_neptune_or_super_earth",
            "label": "Süper-Dünya / Mini-Neptün (Geçiş Sınıfı)",
            "surface_applicable": True,
            "underground_applicable": True,
            "penalty": 0.85,  # Kalın atmosfer / yüksek basınç riski cezası
            "reason": "Yarıçapı 1.6–2.5 Dünya veya kütlesi 5–15 Dünya aralığındaki gezegenler kalın atmosfer ya da okyanus tabakası barındırabilir; yüzey/yer altı puanına %15 ihtiyat payı uygulanır.",
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

#yanlızca doğrulanmıs verilerle yukardaki fonk çağırır
def classify_metrics(metrics):
    """Classify using available properties, never treating equilibrium heat as surface heat."""
    provenance = metrics.get("provenance", {})
    # Classification should not turn an inferred mass/radius into a physical fact.
    # Only use catalog/project inputs here; derived density is usable only when both
    # of its inputs are catalog/project values.
    radius_source = (provenance.get("radius") or {}).get("kind")
    mass_source = (provenance.get("mass") or {}).get("kind")
    radius = metrics.get("radius") if radius_source in ("archive", "project") else None
    mass = metrics.get("mass") if mass_source in ("archive", "project") else None
    density = metrics.get("density") if radius is not None and mass is not None else None
    source_kind = (metrics.get("provenance", {}).get("temperature") or {}).get("kind")
    temperature = (
        metrics.get("temperature")
        if metrics.get("temperature_kind") == "surface" and source_kind != "user"
        else None
    )
    return classify_planet(
        radius, mass, density, temperature,
    )
