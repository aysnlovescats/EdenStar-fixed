"""Input cleaning and NASA archive derived astrophysical metrics."""
import math

# NASA CSV'sinde sy_dist değeri boş olan önemli sistemler için literatür uzaklıkları (parsek)
KNOWN_DISTANCES_PC = {
    "trappist-1": 12.43,
    "kepler-186": 178.5,
    "kepler-452": 551.7,
}


def number(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def estimate_mass_from_radius(r):
    """Chen & Kipping (2017) empirical Mass-Radius relation."""
    if r is None or r <= 0:
        return None
    if r < 1.23:
        return r ** 3.58
    if r < 14.26:
        return 1.436 * (r ** 1.698)
    return 317.8  # Jüpiter ölçeği


def estimate_radius_from_mass(m):
    """Chen & Kipping (2017) inverse empirical Radius-Mass relation."""
    if m is None or m <= 0:
        return None
    if m < 2.04:
        return m ** 0.279
    if m < 131.6:
        return 0.808 * (m ** 0.589)
    return 17.74 * (m ** -0.044)


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
        temperature = 278.5 * (flux ** 0.25)
        temp_estimated = True

    host = str(row.get("hostname") or "").strip().casefold()
    sy_dist = number(row.get("sy_dist"))
    if sy_dist is None and host in KNOWN_DISTANCES_PC:
        sy_dist = KNOWN_DISTANCES_PC[host]

    ecc = number(row.get("pl_orbeccen"))
    orbper = number(row.get("pl_orbper"))
    st_teff = number(row.get("st_teff"))

    gravity = (mass / (radius ** 2)) if (mass and radius and radius > 0) else None
    density = (mass / (radius ** 3)) if (mass and radius and radius > 0) else None
    escape_vel = math.sqrt(mass / radius) if (mass and radius and radius > 0) else None

    # Radyasyon güvenliği (0-1 arası, 1 = Dünya benzeri güvenli)
    radiation = None
    if flux is not None and flux > 0:
        flux_factor = math.exp(-0.35 * abs(math.log(max(flux, 1e-4))))
        star_factor = 1.0
        if st_teff is not None:
            if st_teff < 3500 and (orbper is None or orbper < 20):
                star_factor = 0.62  # Kırmızı cüce yakın yörünge XUV/Flare riski
            elif st_teff < 4200:
                star_factor = 0.82
            elif st_teff > 7000:
                star_factor = 0.70  # Yüksek UV yıldızı
        radiation = round(max(0.0, min(1.0, flux_factor * star_factor)), 3)

    # Jeotermal ve iç ısı uygunluğu (0-1 arası; kütle ve gelgit esnemesinden türetilir)
    geothermal = None
    if mass is not None and mass > 0:
        # Dünya benzeri kütlede (0.5 - 3.0 M_E) ideal iç ısı; çok küçükse çekirdek donmuş, çok büyükse aşırı volkanik
        mass_heat = math.exp(-0.45 * abs(math.log(max(mass, 0.01))))
        tidal_boost = 1.0
        if orbper is not None and orbper < 15 and (ecc or 0) > 0.01:
            tidal_boost = 0.90  # Aşırı gelgit volkanizması (Io etkisi) hafif kırpılır
        geothermal = round(max(0.0, min(1.0, mass_heat * tidal_boost)), 3)

    metrics = {
        "radius": radius,
        "mass": mass,
        "gravity": gravity,
        "density": density,
        "escape_vel": escape_vel,
        "insolation": flux,
        "temperature": temperature,
        "access": sy_dist,
        "eccentricity": ecc if ecc is not None else 0.02,
        "radiation": radiation,
        "geothermal": geothermal,
        "estimated_flags": {
            "radius": radius_estimated,
            "mass": mass_estimated,
            "flux": flux_estimated,
            "temperature": temp_estimated,
        },
    }
    return metrics, flux_estimated, temp_estimated