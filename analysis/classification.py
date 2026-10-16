"""Radius-based size labels, with a clearly qualified mass-only fallback."""

LARGE_MASS_EARTH = 10


def classify_planet(radius, mass=None):
    """Prefer radius; use high mass only as a tentative size hint, never composition."""
    if radius is None or radius <= 0:
        if mass is not None and mass >= LARGE_MASS_EARTH:
            return {
                "label": "Büyük kütleli (yarıçap bilinmiyor)",
                "kind": "large_mass_hint",
                "reason": f"Kütle {mass:.1f} Dünya kütlesi; yarıçap ve bileşim bilinmiyor, bu kesin boyut sınıfı değildir.",
            }
        return {
            "label": "Sınıflandırılamadı",
            "kind": "unknown",
            "reason": "Yarıçap veya boyut sınıfı için yeterli kütle ölçümü bulunmuyor.",
        }

    if radius < 0.8:
        label, kind = "Küçük gezegen boyutunda", "small"
    elif radius < 1.25:
        label, kind = "Dünya boyutunda", "earth_sized"
    elif radius < 2:
        label, kind = "Süper-Dünya boyutunda", "super_earth_sized"
    elif radius < 4:
        label, kind = "Neptün boyutunda", "neptune_sized"
    else:
        label, kind = "Büyük gezegen boyutunda", "large"

    return {
        "label": label,
        "kind": kind,
        "reason": "Yarıçapa dayalı boyut sınıfı; bileşim bu veriden belirlenemez.",
    }
