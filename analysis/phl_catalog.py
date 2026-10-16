"""Read and normalize the downloaded Planetary Habitability Laboratory HWC CSV."""
import csv
import re
from functools import lru_cache
from pathlib import Path

from .metrics import number

PHL_FILE = Path(__file__).resolve().parent.parent / "data" / "hwc.csv"
PHL_SOURCE = "https://phl.upr.edu/hwc/data"


def normalize_planet_name(value):
    value = (value or "").casefold().replace("’", "'")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value).split())


def load_phl_catalog():
    """Return HWC rows keyed by normalized name and known alternate names."""
    if not PHL_FILE.is_file():
        return None
    return _read_phl_catalog(PHL_FILE.stat().st_mtime_ns)


@lru_cache(maxsize=2)
def _read_phl_catalog(_modified_at):
    catalog = {}
    with PHL_FILE.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(line for line in source if line.strip() and not line.lstrip().startswith("#"))
        if not reader.fieldnames:
            raise ValueError("PHL hwc.csv dosyasında sütun başlıkları bulunamadı.")
        for raw in reader:
            row = {(key or "").strip().casefold(): (value or "").strip() for key, value in raw.items()}
            name = row.get("p_name", "")
            if not name:
                continue
            normalized = normalize_planet_name(name)
            parsed = {
                "name": name,
                "habitability_class": number(row.get("p_habitable")),
                "esi": number(row.get("p_esi")),
                "conservative_zone": number(row.get("p_habzone_con")),
                "optimistic_zone": number(row.get("p_habzone_opt")),
                "planet_type": row.get("p_type_temp") or row.get("p_type") or None,
                "host": row.get("s_name") or "Yıldız sistemi bilinmiyor",
                "star_type": row.get("s_type") or None,
                "distance_pc": number(row.get("s_distance")),
                "radius": number(row.get("p_radius")),
                "mass": number(row.get("p_mass")),
                "flux": number(row.get("p_flux")),
                "equilibrium_temperature": number(row.get("p_temp_equil")),
                "surface_temperature": number(row.get("p_temp_surf")),
                "discovery_year": number(row.get("p_year")),
            }
            catalog[normalized] = parsed
            # Alternate-name separators vary between catalog exports; try exact aliases only.
            aliases = re.split(r"\s*[;,|]\s*", row.get("p_alt_names", ""))
            for alias in aliases:
                alias_key = normalize_planet_name(alias)
                if alias_key:
                    catalog.setdefault(alias_key, parsed)
    return catalog


def phl_summary(planet_name, catalog):
    """Convert one matched HWC row into a cautious, UI-ready summary."""
    item = catalog.get(normalize_planet_name(planet_name))
    if item is None:
        return {
            "matched": False,
            "status": "PHL kataloğunda eşleşme yok",
            "caveat": "Bu, gezegenin yaşanamaz olduğu anlamına gelmez; katalogda eşleşen kayıt bulunmadı.",
        }

    classification = item["habitability_class"]
    if classification == 1:
        status = "Konservatif aday"
    elif classification == 2:
        status = "İyimser aday"
    elif classification == 0:
        status = "PHL'de aday olarak işaretlenmemiş"
    else:
        status = "PHL adaylık etiketi yok"

    return {
        "matched": True,
        "status": status,
        "catalog_name": item["name"],
        "habitability_class": classification,
        "esi": item["esi"],
        "conservative_zone": item["conservative_zone"],
        "optimistic_zone": item["optimistic_zone"],
        "planet_type": item["planet_type"],
        "caveat": "PHL aday etiketi gerçek yaşanabilirlik veya yaşam kanıtı değildir.",
    }


def phl_comparison(planet_name, population="exoplanet"):
    """Return a safe UI payload even when the optional PHL CSV is not installed."""
    if population != "exoplanet":
        return {
            "available": False,
            "not_applicable": True,
            "message": "PHL kataloğu ötegezegenleri kapsar; Güneş Sistemi cisimleri burada karşılaştırılmaz.",
            "source_url": PHL_SOURCE,
        }
    try:
        catalog = load_phl_catalog()
    except (OSError, ValueError) as error:
        return {
            "available": False,
            "message": f"PHL veri dosyası okunamadı: {error}",
            "source_url": PHL_SOURCE,
            "expected_file": "data/hwc.csv",
        }
    if catalog is None:
        return {
            "available": False,
            "message": "PHL CSV dosyası henüz projeye eklenmemiş.",
            "source_url": PHL_SOURCE,
            "expected_file": "data/hwc.csv",
        }
    return {"available": True, **phl_summary(planet_name, catalog), "source_url": PHL_SOURCE}


def ranked_phl_candidates(catalog):
    """Return unique PHL candidates, grouped by class and ordered by ESI within each class."""
    unique = {item["name"]: item for item in catalog.values()}
    candidates = [
        item for item in unique.values()
        if item.get("habitability_class") in {1, 2}
    ]
    candidates.sort(key=lambda item: (
        item["habitability_class"],
        item["esi"] is None,
        -(item["esi"] or 0),
        item["name"].casefold(),
    ))
    return candidates
