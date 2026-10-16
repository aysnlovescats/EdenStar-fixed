"""Input cleaning and NASA archive derived metrics."""
import math


def number(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def calculate_insolation(row):
    """Earth-normalized flux and whether it was derived rather than archived."""
    flux = number(row.get("pl_insol"))
    if flux is not None and flux > 0:
        return flux, False
    au, log_lum = number(row.get("pl_orbsmax")), number(row.get("st_lum"))
    if au and au > 0 and log_lum is not None:
        return 10 ** log_lum / au ** 2, True
    radius, temp = number(row.get("st_rad")), number(row.get("st_teff"))
    if au and au > 0 and radius and temp:
        return radius ** 2 * (temp / 5772) ** 4 / au ** 2, True
    return None, False


def derive_planet_metrics(row):
    radius, mass = number(row.get("pl_rade")), number(row.get("pl_bmasse"))
    flux, flux_estimated = calculate_insolation(row)
    temperature = number(row.get("pl_eqt"))
    temp_estimated = False
    if temperature is None and flux is not None and flux > 0:
        temperature = 278.5 * flux ** .25
        temp_estimated = True
    sy_dist = number(row.get("sy_dist"))
    gravity = mass / radius ** 2 if mass and radius and radius > 0 else None
    access = sy_dist * 3.26156 if sy_dist is not None else None
    provenance = {
        "radius": {"kind": "archive", "label": "NASA arşiv değeri"} if radius is not None else None,
        "gravity": {"kind": "derived", "label": "NASA arşivindeki kütle ve yarıçaptan türetildi"} if gravity is not None else None,
        "insolation": (
            {"kind": "estimated", "label": "Yıldız parlaklığı ve yörüngeden tahmin edildi"}
            if flux_estimated else {"kind": "archive", "label": "NASA arşivindeki yıldız enerjisi değeri"}
            if flux is not None else None
        ),
        "temperature": (
            {"kind": "estimated", "label": "Yıldız enerjisinden yaklaşık hesaplandı"}
            if temp_estimated else {"kind": "archive", "label": "NASA arşivindeki denge sıcaklığı değeri"}
            if temperature is not None else None
        ),
        "access": {"kind": "derived", "label": "NASA sistem uzaklığı parsec'ten ışık yılına çevrildi"} if access is not None else None,
    }
    metrics = {
        "radius": radius,
        "mass": mass,
        "gravity": gravity,
        "density": mass / radius ** 3 if mass and radius and radius > 0 else None,
        "insolation": flux, "temperature": temperature,
        "temperature_kind": "equilibrium",
        # NASA's sy_dist is parsecs; the scoring/UI indicator is in light-years.
        "access": access,
        "surface_pressure_bar": None,
        "atmosphere_status": None,
        "atmosphere_summary": None,
        # Not in this dataset with reliable, comparable measurements.
        "radiation": None, "water": None, "geothermal": None, "geology": None,
        "provenance": provenance,
    }
    return metrics, flux_estimated, temp_estimated
