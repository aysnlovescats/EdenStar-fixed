"""Input cleaning and NASA archive derived astrophysical metrics."""
import math

# NASA CSV'sinde sy_dist değeri boş olan önemli sistemler için literatür uzaklıkları (parsek)
KNOWN_DISTANCES_PC = {
    "trappist-1": 12.43,
    "kepler-186": 178.5,
    "kepler-452": 551.7,
}


# Güvenli sayı dönüşümü: boş metin, sayı olmayan metin, NaN ve sonsuz değerler None olur.
# Böylece bozuk bir hücre programı çökertmez, o ölçüt 'veri yok' görünür.
def number(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


# Yıldızın tayf sınıfını (O, B, A, F, G, K, M) döndürür. Katalogda yoksa yıldız sıcaklığından
# kaba sınıf çıkarır ve 'estimated' (tahmin) olarak işaretler.
def stellar_type(row):
    """Return the catalog spectral class, or a rough class inferred from Teff."""
    catalog_type = str(row.get("st_spectype") or "").strip().upper()
    if catalog_type and catalog_type[0] in "OBAFGKM":
        return catalog_type, catalog_type[0], "archive"
    temperature = number(row.get("st_teff"))
    if temperature is None or temperature <= 0:
        return None, None, "unknown"
    # Broad temperature ranges are only a fallback when the archive has no type.
    if temperature >= 30000:
        letter = "O"
    elif temperature >= 10000:
        letter = "B"
    elif temperature >= 7500:
        letter = "A"
    elif temperature >= 6000:
        letter = "F"
    elif temperature >= 5200:
        letter = "G"
    elif temperature >= 3900:
        letter = "K"
    else:
        letter = "M"
    return f"{letter} (sıcaklıktan yaklaşık)", letter, "estimated"


# Kütlenin türünü belirler: pl_bmassprov='Mass' → gerçek kütle (archive); 'Msini' → yalnızca alt sınır (estimated);
# boş → doğrulanamadı (unknown). Yerçekimi, yoğunluk, kaçış hızı ve Hill hesabı yalnızca gerçek kütleyi kullanır.
def mass_provenance(row, mass, estimated):
    """Distinguish a true reported mass from NASA's projected-mass alternatives."""
    if mass is None:
        return None
    if estimated:
        return {"kind": "estimated", "label": "Kütle, yarıçap-kütle bağıntısından tahmin edildi"}
    raw = str(row.get("pl_bmassprov") or "").strip()
    normalized = "".join(character for character in raw.casefold() if character.isalnum())
    if normalized == "mass":
        return {"kind": "archive", "label": "NASA Exoplanet Archive gerçek kütle girdisi (pl_bmassprov=Mass)"}
    if normalized in {"msini", "msinisini"}:
        return {
            "kind": "estimated",
            "label": f"NASA arşivindeki {raw} değeri gerçek kütle değil; yerçekimi puanında ölçülmüş kütle sayılmadı",
        }
    return {
        "kind": "unknown",
        "label": "NASA kütle değeri var ancak pl_bmassprov eksik; gerçek kütle mi alt sınır mı doğrulanamadı",
    }


# Project prior for the exploratory model, not an observed planet property.
# K stars are given a modest advantage for their long, relatively steady main-sequence lives.
# Varsayımsal modelde kullanılan yıldız sınıfı katsayıları (proje varsayımı, olasılık değil).
STELLAR_PRIORS = {"O": 0.25, "B": 0.35, "A": 0.45, "F": 0.60, "G": 0.75, "K": 0.85, "M": 0.65}


# Yarıçaptan kütle tahmini (Chen & Kipping 2017 ampirik bağıntısı). Sonuç her zaman 'tahmin' olarak işaretlenir.
def estimate_mass_from_radius(r):
    """Chen & Kipping (2017) empirical Mass-Radius relation."""
    if r is None or r <= 0:
        return None
    if r < 1.23:
        return r ** 3.58
    if r < 14.26:
        return 1.436 * (r ** 1.698)
    return 317.8  # Jüpiter ölçeği


# Aynı bağıntının tersi: kütleden yarıçap tahmini.
def estimate_radius_from_mass(m):
    """Chen & Kipping (2017) inverse empirical Radius-Mass relation."""
    if m is None or m <= 0:
        return None
    if m < 2.04:
        return m ** 0.279
    if m < 131.6:
        return 0.808 * (m ** 0.589)
    return 17.74 * (m ** -0.044)


# Yıldız enerjisini (akı, Dünya = 1) bulur. Sıra: 1) NASA'nın pl_insol değeri, 2) S = L / a²,
# 3) L yoksa S = R² · (T / 5772)⁴ / a² (Stefan–Boltzmann). İkinci dönen değer akının hesaplanıp hesaplanmadığını söyler.
def calculate_insolation(row):
    """Earth-normalized flux and whether it was derived rather than archived."""
    flux = number(row.get("pl_insol"))
    if flux is not None and flux > 0:
        return flux, False
    au, log_lum = number(row.get("pl_orbsmax")), number(row.get("st_lum"))
    if au and au > 0 and log_lum is not None:
        return (10 ** log_lum) / (au ** 2), True
    radius, temp = number(row.get("st_rad")), number(row.get("st_teff"))
    if au and au > 0 and radius and temp:
        return (radius ** 2) * ((temp / 5772.0) ** 4) / (au ** 2), True
    return None, False


# Tek bir NASA satırından bütün ölçüm sözlüğünü üretir ve her değerin kaynağını (provenance) yazar.
# Tüm büyüklükler Dünya = 1 birimindedir. Dönüş: (ölçümler, akı tahmini mi, sıcaklık tahmini mi).
def derive_planet_metrics(row):
    radius = number(row.get("pl_rade"))
    mass = number(row.get("pl_bmasse"))
    radius_estimated = False
    mass_estimated = False

    if radius is None and mass is not None:
        radius = estimate_radius_from_mass(mass)
        radius_estimated = True
    elif mass is None and radius is not None:
        mass = estimate_mass_from_radius(radius)
        mass_estimated = True

    flux, flux_estimated = calculate_insolation(row)
    temperature = number(row.get("pl_eqt"))
    temp_estimated = False
    if temperature is None and flux is not None and flux > 0:
        # Denge sıcaklığı yoksa akıdan tahmin: T = 278,5 · S^0,25. 278,5 K, ışığı hiç yansıtmayan (albedo = 0)
        # bir cismin Dünya uzaklığındaki sıcaklığıdır; Dünya'nın albedosuyla 255 K olurdu. Bu değer ana puana girmez.
        temperature = 278.5 * (flux ** 0.25)
        temp_estimated = True
    # pl_eqt and the flux-derived fallback are equilibrium estimates, not surface measurements.
    temperature_kind = "equilibrium" if temperature is not None else "unknown"

    host = str(row.get("hostname") or "").strip().casefold()
    sy_dist = number(row.get("sy_dist"))
    if sy_dist is None and host in KNOWN_DISTANCES_PC:
        sy_dist = KNOWN_DISTANCES_PC[host]

    ecc = number(row.get("pl_orbeccen"))
    semi_major_axis = number(row.get("pl_orbsmax"))
    stellar_mass = number(row.get("st_mass"))
    spectral_label, spectral_class, spectral_source = stellar_type(row)
    star_prior = STELLAR_PRIORS.get(spectral_class)

    # Dünya birimlerinde: yerçekimi g = M / R², yoğunluk ρ = M / R³ (Dünya için ikisi de 1).
    gravity = (mass / (radius ** 2)) if (mass and radius and radius > 0) else None
    density = (mass / (radius ** 3)) if (mass and radius and radius > 0) else None
    escape_vel = math.sqrt(mass / radius) if (mass and radius and radius > 0) else None
    # Measurement-grade derived values require a catalog radius and an actual mass,
    # never a radius-mass estimate or an Msini lower bound.
    physical_mass = mass is not None and mass_provenance(row, mass, mass_estimated) and mass_provenance(row, mass, mass_estimated)["kind"] == "archive"
    measured_radius = number(row.get("pl_rade"))
    density_measured = mass / measured_radius ** 3 if physical_mass and measured_radius and measured_radius > 0 else None
    # Kaçış hızı v = 11,19 · √(M / R) km/s (Dünya'nınki 11,19 km/s). Yalnızca gerçek kütle ve ölçülmüş yarıçapla.
    escape_measured = 11.19 * math.sqrt(mass / measured_radius) if physical_mass and measured_radius and measured_radius > 0 else None
    hill_window = None
    if physical_mass and measured_radius and measured_radius > 0 and semi_major_axis and semi_major_axis > 0 and stellar_mass and stellar_mass > 0:
        # Hill yarıçapı r = a · (M / 3M*)^(1/3); 332.946 = Güneş kütlesinin Dünya kütlesi cinsinden değeri.
        # Kararlı yörünge penceresi = 0,49 · r_Hill / gezegen yarıçapı (prograde yörüngeler için kabul).
        hill_radius_au = semi_major_axis * (mass / (3 * stellar_mass * 332946.0)) ** (1 / 3)
        planet_radius_au = measured_radius * 6371.0 / 149597870.7
        hill_window = 0.49 * hill_radius_au / planet_radius_au

    # Stellar flux and planet mass do not measure a planet's radiation dose or
    # subsurface heat. Leave both unknown until comparable observations exist.
    radiation = None
    geothermal = None

    # Her ölçümün kaynağı: archive (NASA), derived (formülle), estimated (tahmin).
    # scoring.py hangisinin puana gireceğine buna bakarak karar verir.
    provenance = {
        "radius": (
            {"kind": "estimated", "label": "Yarıçap, kütle-yarıçap bağıntısından tahmin edildi"}
            if radius_estimated else
            {"kind": "archive", "label": "NASA Exoplanet Archive yarıçap değeri"}
            if radius is not None else None
        ),
        "mass": mass_provenance(row, mass, mass_estimated),
        "gravity": (
            {"kind": "estimated", "label": "En az bir kütle/yarıçap girdisi tahmin edildi veya kütle provenance bilgisi ölçümü doğrulamıyor"}
            if radius_estimated or mass_estimated or (mass is not None and (mass_provenance(row, mass, mass_estimated) or {}).get("kind") != "archive") else
            {"kind": "derived", "label": "NASA arşivinde provenance=Mass kütlesi ve yarıçaptan hesaplandı"}
            if gravity is not None else None
        ),
        "density": {"kind": "derived", "label": "Gerçek kütle (pl_bmassprov=Mass) ve arşiv yarıçapından hesaplandı"} if density_measured is not None else None,
        "escape_velocity": {"kind": "derived", "label": "Gerçek kütle (pl_bmassprov=Mass) ve arşiv yarıçapından hesaplandı"} if escape_measured is not None else None,
        "hill_window": {"kind": "derived", "label": "Yarı büyük eksen, gerçek gezegen kütlesi, yıldız kütlesi ve yarıçaptan; prograde kararlı bölge yaklaşık 0,49 Hill yarıçapı kabul edildi"} if hill_window is not None else None,
        "subsurface_temperature": {"kind": "estimated", "label": "Arşiv denge sıcaklığı yer altı sıcaklığını ölçmez; yalnızca keşif modelinde kaba termal vekil olarak kullanıldı"} if temperature is not None else None,
        "insolation": (
            {"kind": "estimated", "label": "Yıldız ve yörünge verilerinden hesaplandı"}
            if flux_estimated else
            {"kind": "archive", "label": "NASA Exoplanet Archive yıldız enerjisi değeri"}
            if flux is not None else None
        ),
        "temperature": (
            {"kind": "estimated", "label": "Yıldız enerjisinden yaklaşık hesaplandı"}
            if temp_estimated else
            {"kind": "archive", "label": "NASA Exoplanet Archive denge sıcaklığı değeri; yüzey sıcaklığı değildir"}
            if temperature is not None else None
        ),
        "access": (
            {"kind": "estimated", "label": "NASA Exoplanet Archive sistem uzaklığından türetildi veya yaklaşık yedek değer kullanıldı"}
            if row.get("sy_dist") is None and sy_dist is not None else
            {"kind": "archive", "label": "NASA Exoplanet Archive sistem uzaklığı"}
            if sy_dist is not None else None
        ),
    }

    metrics = {
        "radius": radius,
        "mass": mass,
        "gravity": gravity,
        "density": density,
        "density_score_input": density_measured,
        "escape_velocity": escape_measured,
        "hill_window": hill_window,
        "subsurface_temperature": temperature,
        "escape_vel": escape_vel,
        "insolation": flux,
        "temperature": temperature,
        "temperature_kind": temperature_kind,
        "access": sy_dist,
        "eccentricity": ecc if ecc is not None else 0.02,
        "radiation": radiation,
        "geothermal": geothermal,
        "stellar_type": spectral_label,
        "stellar_class": spectral_class,
        "stellar_habitability_prior": star_prior,
        "provenance": provenance,
        "estimated_flags": {
            "radius": radius_estimated,
            "mass": mass_estimated,
            "flux": flux_estimated,
            "temperature": temp_estimated,
        },
    }
    provenance["stellar_habitability_prior"] = (
        {
            "kind": "estimated",
            "label": "Yıldız sınıfına dayalı proje varsayımı; gezegenin yaşanabilirlik kanıtı değildir",
        }
        if star_prior is not None else None
    )
    provenance["stellar_type"] = (
        {"kind": spectral_source, "label": "NASA Exoplanet Archive yıldız tayf sınıfı" if spectral_source == "archive" else "Yıldız sıcaklığından yaklaşık tayf sınıfı"}
        if spectral_label is not None else None
    )
    return metrics, flux_estimated, temp_estimated
