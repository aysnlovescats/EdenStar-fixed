"""NASA CSV okuma ve gezegen kayıtlarını tek bir kuralla birleştirme."""
import csv
from functools import lru_cache
from pathlib import Path

from .metrics import derive_planet_metrics, number
from .phl_catalog import load_phl_catalog, normalize_planet_name

DATA = Path(__file__).resolve().parent.parent / "data"
# Aynı gezegenin farklı yayın satırlarından birleştirilecek NASA sütunları
# (yarıçap, kütle, akı, denge sıcaklığı, yörünge, yıldız parametreleri, uzaklık).
MERGE_FIELDS = (
    "pl_rade", "pl_bmasse", "pl_insol", "pl_eqt", "pl_orbsmax",
    "st_lum", "st_rad", "st_teff", "st_mass", "sy_dist",
)

# NASA CSV'sinde TRAPPIST-1 uzaklığı boş. NASA'nın yayımladığı yaklaşık 40 ışık yılı
# ile uyumlu 12.43 pc değeri; tam kaynak ve tarih data_sources.py içinde tutuluyor.
MANUAL_DISTANCE_PC = {"trappist-1": 12.43}


# data/ klasöründeki PS_*.csv dosyalarından en son değiştirileni seçer; yeni NASA dosyası eklenince otomatik onu kullanır.
def _latest_csv():
    files = sorted(DATA.glob("PS_*.csv"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not files:
        raise FileNotFoundError("data klasöründe PS_*.csv adlı NASA dosyası bulunamadı.")
    return files[0]


# NASA CSV'sini okuyup her gezegeni tek kayda indirir. lru_cache sayesinde sunucu başına yalnızca bir kez çalışır.
# Adımlar: # ile başlayan açıklama satırlarını atla → (yıldız, gezegen) çiftine göre grupla →
# NASA'nın varsayılan satırını (default_flag=1) öne al → her alan için ilk dolu değeri seç →
# derive_planet_metrics ile ölçümleri üret → PHL bilgisini ekle.
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
        # default_flag=1 olan satır (NASA'nın önerdiği çözüm) başa gelir: False < True olduğu için sıralama bunu sağlar.
        rows = sorted(item["rows"], key=lambda row: row.get("default_flag") != "1")
        # Her alan için sıradaki ilk dolu değeri al: varsayılan satırda boş olan alan başka yayından tamamlanır.
        merged = {
            field: next((number(row.get(field)) for row in rows if number(row.get(field)) is not None), None)
            for field in MERGE_FIELDS
        }
        mass_row = next((row for row in rows if number(row.get("pl_bmasse")) is not None), None)
        merged["pl_bmassprov"] = (mass_row or {}).get("pl_bmassprov")
        merged["st_spectype"] = next(
            (row.get("st_spectype", "").strip() for row in rows if row.get("st_spectype", "").strip()),
            None,
        )
        if merged["sy_dist"] is None:
            merged["sy_dist"] = MANUAL_DISTANCE_PC.get(item["host"].casefold())
        metrics, flux_estimated, temp_estimated = derive_planet_metrics(merged)
        # PHL's Tsurf is a MODEL estimate (Earth-like albedo and greenhouse), not a measurement.
        # Keep it visible for context; only the exploratory model may use modeled values.
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
            # Herhangi bir satırda pl_controv_flag=1 ise gezegen 'tartışmalı' işaretlenir; silinmez, arayüzde uyarıyla gösterilir.
            "contested": any(row.get("pl_controv_flag") == "1" for row in rows),
            "flux_estimated": flux_estimated, "temp_estimated": temp_estimated,
            "temp_modeled": temp_modeled,
        }
    return planets
