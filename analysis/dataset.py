"""NASA CSV okuma ve gezegen kayıtlarını tek bir kuralla birleştirme."""
import csv
from functools import lru_cache
from pathlib import Path

from .metrics import derive_planet_metrics, number
from .phl_catalog import load_phl_catalog, normalize_planet_name

DATA = Path(__file__).resolve().parent.parent / "data"
MERGE_FIELDS = (
    "pl_rade", "pl_bmasse", "pl_insol", "pl_eqt", "pl_orbsmax",
    "st_lum", "st_rad", "st_teff", "sy_dist",
)

# NASA CSV'sinde TRAPPIST-1 uzaklığı boş. NASA'nın yayımladığı yaklaşık 40 ışık yılı
# ile uyumlu 12.43 pc değeri; tam kaynak ve tarih data_sources.py içinde tutuluyor.
MANUAL_DISTANCE_PC = {"trappist-1": 12.43}


def _latest_csv():
    files = sorted(DATA.glob("PS_*.csv"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not files:
        raise FileNotFoundError("data klasöründe PS_*.csv adlı NASA dosyası bulunamadı.")
    return files[0]


@lru_cache(maxsize=1)
def load_planets():
    """Return merged (host, planet) records; contested planets remain explicitly marked."""
    grouped = {}
    with _latest_csv().open("r", encoding="utf-8-sig", newline="") as source:
        lines = (line for line in source if line.strip() and not line.lstrip().startswith("#"))
        for row in csv.DictReader(lines):
            host = (row.get("hostname") or "").strip()
            name = (row.get("pl_name") or "").strip()
            if not host or not name:
                continue
            key = (host.casefold(), name.casefold())
            grouped.setdefault(key, {"host": host, "name": name, "rows": []})["rows"].append(row)

    planets = {}
    phl_catalog = load_phl_catalog() or {}
    for key, item in grouped.items():
        rows = sorted(item["rows"], key=lambda row: row.get("default_flag") != "1")
        merged = {
            field: next((number(row.get(field)) for row in rows if number(row.get(field)) is not None), None)
            for field in MERGE_FIELDS
        }
        if merged["sy_dist"] is None:
            merged["sy_dist"] = MANUAL_DISTANCE_PC.get(item["host"].casefold())
        metrics, flux_estimated, temp_estimated = derive_planet_metrics(merged)
        # PHL's Tsurf is a MODEL estimate (Earth-like albedo and greenhouse), not a measurement.
        # It is kept as its own kind so scoring can count it without presenting it as observed.
        metrics["equilibrium_temperature"] = metrics["temperature"]
        phl_item = phl_catalog.get(normalize_planet_name(item["name"]))
        phl_surface = phl_item.get("surface_temperature") if phl_item else None
        temp_modeled = phl_surface is not None and phl_surface > 0
        if temp_modeled:
            metrics["temperature"] = phl_surface
            metrics["temperature_kind"] = "modeled_surface"
            metrics["provenance"]["temperature"] = {
                "kind": "modeled",
                "label": "PHL modeli: Dünya benzeri atmosfer varsayımıyla tahmini yüzey sıcaklığı (ölçüm değil)",
            }
            temp_estimated = False
        if item["host"].casefold() == "trappist-1" and merged["sy_dist"] == MANUAL_DISTANCE_PC["trappist-1"]:
            metrics["provenance"]["access"] = {
                "kind": "estimated",
                "label": "NASA yaklaşık 40 ışık yılı der; CSV'de değer yok, 12.43 pc yaklaşık yedek değer kullanıldı",
            }
        planets[key] = {
            **item, **merged, "metrics": metrics,
            "contested": any(row.get("pl_controv_flag") == "1" for row in rows),
            "flux_estimated": flux_estimated, "temp_estimated": temp_estimated,
            "temp_modeled": temp_modeled,
        }
    return planets
