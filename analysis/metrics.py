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
    metrics = {
        "radius": radius,
        "gravity": mass / radius ** 2 if mass and radius and radius > 0 else None,
        "density": mass / radius ** 3 if mass and radius and radius > 0 else None,
        "insolation": flux, "temperature": temperature,
        "access": sy_dist,
        # Not in this dataset with reliable, comparable measurements.
        "radiation": None, "water": None, "geothermal": None, "geology": None,
    }
    return metrics, flux_estimated, temp_estimated
