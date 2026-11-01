import math
import os
from functools import lru_cache
from pathlib import Path

from flask import Flask, jsonify, redirect, request, send_from_directory
from werkzeug.exceptions import HTTPException
from analysis.classification import classify_metrics
from analysis.consistency import esi_consistency
from analysis.data_sources import scenario_data_sources
from analysis.dataset import load_planets as load_nasa_planets
from analysis.methodology import scenario_methodology
from analysis.metrics import number
from analysis.phl_catalog import load_phl_catalog, phl_comparison, ranked_phl_candidates, PHL_SOURCE
from analysis.scenarios import SCENARIOS
from analysis.scoring import score_scenario
from analysis.sensitivity import criterion_rows, weight_sensitivity
from analysis.surface_options import build_surface_options

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
app = Flask(__name__, static_folder=None)


@app.errorhandler(HTTPException)
def handle_http_error(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": error.description}), error.code
    return error


@app.errorhandler(Exception)
def api_unexpected_error(error):
    if request.path.startswith("/api/"):
        app.logger.exception("Unhandled API error")
        return jsonify({"error": "Sunucu analiz sırasında beklenmeyen bir hata verdi."}), 500
    return "Internal Server Error", 500

SOLAR_SURFACE_ENVIRONMENT = {
    "merkür": {
        "surface_pressure_bar": 0,
        "atmosphere_status": "hostile",
        "atmosphere_summary": "İhmal edilebilir ekzosfer; solunabilir atmosfer yok",
    },
    "venüs": {
        "surface_pressure_bar": 92,
        "atmosphere_status": "hostile",
        "atmosphere_summary": "CO₂ ağırlıklı, aşındırıcı atmosfer",
    },
    "dünya": {
        "surface_pressure_bar": 1,
        "atmosphere_status": "breathable",
        "atmosphere_summary": "N₂/O₂ ağırlıklı, solunabilir atmosfer",
    },
    "mars": {
        "surface_pressure_bar": 0.006,
        "atmosphere_status": "hostile",
        "atmosphere_summary": "Çok ince, CO₂ ağırlıklı atmosfer",
    },
    "titan": {
        "surface_pressure_bar": 1.5,
        "atmosphere_status": "hostile",
        "atmosphere_summary": "Yaklaşık %95 azot ve %5 metan; solunabilir oksijen yok",
    },
}

SOLAR_RANKING_BODIES = [
    ("Merkür", 2440, 167, 3.70, 0.387),
    ("Venüs", 6052, 464, 8.87, 0.723),
    ("Dünya", 6371, 15, 9.81, 1.000),
    ("Mars", 3390, -63, 3.71, 1.524),
    ("Jüpiter", 69911, None, 24.79, 5.203),
    ("Satürn", 58232, None, 10.44, 9.537),
    ("Ay", 1737, -23, 1.62, 1.000),
    ("Europa", 1561, -171, 1.31, 5.203),
    ("Titan", 2575, -179, 1.35, 9.537),
    ("Enceladus", 252, -198, 0.11, 9.537),
]


@app.get("/")
def home():
    return redirect("/index/workspace.html")

# güneş sistemi ve ötegezegenler için analiz ve sıralama API uç noktaları
@app.get("/api/analyze")
def analyze():
    host = request.args.get("host", "")
    planet_name = request.args.get("planet", "")
    estimated = []
    contested = False

    if host.casefold() == "güneş sistemi":
        radius_km = number(request.args.get("radius"))
        temperature_c = number(request.args.get("temperature"))
        gravity_ms = number(request.args.get("gravity"))
        au = number(request.args.get("au"))
        solar_entry = next((metrics for system, name, metrics in _solar_ranking_entries() if name.casefold() == planet_name.casefold()), None)
        if solar_entry is None:
            return jsonify({"error": "Güneş Sistemi gökcismi bulunamadı."}), 404
        metrics = dict(solar_entry)
        if radius_km is not None and radius_km > 0:
            metrics["radius"] = radius_km / 6371
        if gravity_ms is not None:
            metrics["gravity"] = gravity_ms / 9.81
        if au is not None and au > 0:
            metrics["insolation"] = 1 / au ** 2
        if temperature_c is not None:
            metrics["temperature"] = temperature_c + 273.15
        if metrics.get("insolation") is not None:
            estimated.append("Yıldız enerjisi yaklaşık yörünge uzaklığından hesaplandı")
        estimated.append("Güneş Sistemi yüzey sıcaklığı kullanılıyor; ötegezegen denge sıcaklığıyla aynı ölçüm değildir")
        source = "Projendeki Güneş Sistemi verileri"
    else:
        try:
            item = load_nasa_planets().get((host.casefold(), planet_name.casefold()))
        except (FileNotFoundError, OSError) as error:
            return jsonify({"error": str(error)}), 500
        if item is None:
            return jsonify({"error": "Bu gezegen NASA CSV dosyasında bulunamadı."}), 404
        metrics = item["metrics"]
        contested = item["contested"]
        if contested:
            estimated.append("NASA arşivinde doğrulaması sorgulanmış olarak işaretli; sonuç ihtiyatla yorumlanmalı")
        if item["flux_estimated"]:
            estimated.append("Yıldız enerjisi, yıldız parlaklığı ve yörünge uzaklığından tahmin edildi")
        if item["temp_estimated"]:
            estimated.append("Denge sıcaklığı, Dünya benzeri yansıtıcılık varsayımıyla tahmin edildi")
        if item.get("temp_modeled"):
            estimated.append("PHL model sıcaklığı (Dünya benzeri atmosfer varsayımı) ölçüm puanına katılmadı; yalnızca varsayımsal modelde kullanılır")
        source = "NASA Exoplanet Archive CSV dosyası"

    scenarios = [score_scenario(metrics, scenario_id) for scenario_id in SCENARIOS]
    data_sources = {
        scenario_id: scenario_data_sources(host, planet_name, scenario_id)
        for scenario_id in SCENARIOS
    }
    surface_scenario = next(item for item in scenarios if item["id"] == "surface")
    surface_options = build_surface_options(
        metrics,
        surface_scenario,
        is_venus=host.casefold() == "güneş sistemi" and planet_name.casefold() == "venüs",
    )
    return jsonify({
        "planet": planet_name, "contested": contested,
        "phl_comparison": phl_comparison(planet_name, "solar" if host.casefold() == "güneş sistemi" else "exoplanet"),
        "planet_class": classify_metrics(metrics),
        "metrics": metrics, "scenarios": scenarios, "surface_options": surface_options,
        "data_sources": data_sources,
        # Why each weight has its value; a report (human or AI) must cite this, not invent reasons.
        "methodology": {scenario_id: scenario_methodology(scenario_id) for scenario_id in SCENARIOS},
        "estimated": estimated, "source": source,
        "note": "Skor; NASA arşivindeki ölçümlerden ve analiz/scenarios.py dosyasındaki senaryo ağırlıklarından hesaplanan bir ön eleme endeksidir; olasılık veya koloni başarısı tahmini değildir. Eksik ölçütler veri kapsamını düşürür ve bilinmeyen değerler puanlanmaz. NASA kaynak kartları ek ölçüm ve modelleri gösterir; kapsamı gezegen geneline taşınamayan veriler skora otomatik katılmaz."
    })

#parametreleri doğrular, filtreler ve sıralar, ardından JSON döndürür
@app.get("/api/rankings")
def rankings():
    scenario_id = request.args.get("scenario", "surface")
    if scenario_id not in SCENARIOS:
        return jsonify({"error": "Geçersiz senaryo."}), 400
    try:
        min_coverage = max(0, min(100, int(request.args.get("min_coverage", "0"))))
        limit = max(1, min(200, int(request.args.get("limit", "100"))))
    except ValueError:
        return jsonify({"error": "Kapsam ve sonuç sayısı sayısal olmalıdır."}), 400
    query = request.args.get("q", "").strip().casefold()
    population = request.args.get("population", "all")
    if population not in {"all", "solar", "exoplanet"}:
        return jsonify({"error": "Geçersiz gök cismi grubu."}), 400

    try:
        ranked = _ranked_planets(scenario_id, min_coverage)
    except (FileNotFoundError, OSError) as error:
        return jsonify({"error": str(error)}), 500
    if query:
        ranked = [item for item in ranked if query in f"{item['host']} {item['planet']}".casefold()]
    if population != "all":
        ranked = [item for item in ranked if item["population"] == population]
    results = []
    for record in ranked[:limit]:
        enriched = dict(record)
        enriched["phl"] = phl_comparison(record["planet"], record["population"])
        results.append(enriched)
    return jsonify({
        "scenario": scenario_id,
        "population": population,
        "results": results,
        "result_count": len(ranked),
        "min_coverage": min_coverage,
        "note": "Sıralama bir ön elemedir. Veri kapsamı ve ölçütlerin kaynak/durum bilgisi puanla birlikte değerlendirilmelidir.",
    })

#phl katoluğunu yükler,adayları ayırır
@app.get("/api/phl-candidates")
def phl_candidates():
    query = request.args.get("q", "").strip().casefold()
    try:
        catalog = load_phl_catalog()
    except (OSError, ValueError) as error:
        return jsonify({"error": f"PHL kataloğu okunamadı: {error}"}), 500
    if catalog is None:
        return jsonify({
            "available": False,
            "message": "PHL CSV dosyası bulunamadı.",
            "source_url": PHL_SOURCE,
            "expected_file": "data/hwc.csv",
        })

    candidates = ranked_phl_candidates(catalog)
    if query:
        candidates = [item for item in candidates if query in f"{item['name']} {item['host']}".casefold()]
    conservative = [item for item in candidates if item["habitability_class"] == 1]
    optimistic = [item for item in candidates if item["habitability_class"] == 2]
    return jsonify({
        "available": True,
        "source_url": PHL_SOURCE,
        "candidate_count": len(conservative) + len(optimistic),
        "conservative_count": len(conservative),
        "optimistic_count": len(optimistic),
        "conservative": conservative,
        "optimistic": optimistic,
        "note": "PHL sınıfları önce gruplandırılır; grupların içinde ESI yüksekten düşüğe sıralanır. ESI Dünya benzerliğini ölçer, yaşanabilirlik olasılığı değildir.",
    })

#senary ağırlıklarının ve toleranslarının PHL katalog verileriyle tutarlılığını kontrol eder
@app.get("/api/esi-consistency")
def esi_consistency_check():
    scenario_id = request.args.get("scenario", "surface")
    if scenario_id not in SCENARIOS:
        return jsonify({"error": "Geçersiz senaryo."}), 400
    try:
        result = _esi_consistency(scenario_id)
    except (FileNotFoundError, OSError, ValueError) as error:
        return jsonify({"error": str(error)}), 500
    if result is None:
        return jsonify({
            "available": False,
            "message": "PHL CSV dosyası bulunamadı.",
            "source_url": PHL_SOURCE,
            "expected_file": "data/hwc.csv",
        })
    return jsonify({
        "available": True,
        **result,
        "source_url": PHL_SOURCE,
        "note": "ESI, Dünya benzerliğini ölçer; proje puanı senaryo ölçütlerine göre ön elemedir. Karşılaştırma doğrulama değil, genel bir tutarlılık kontrolüdür. Kapsamı %0 olan gezegenler dahil edilmez.",
    })

#dosya önbellekleme ile PHL katalog verilerini yükler 
@lru_cache(maxsize=3)
def _esi_consistency(scenario_id):
    catalog = load_phl_catalog()
    if catalog is None:
        return None
    return esi_consistency(load_nasa_planets(), catalog, scenario_id)

#ağırlık gerekçeleri
@app.get("/api/methodology")
def methodology():
    scenario_id = request.args.get("scenario", "surface")
    if scenario_id not in SCENARIOS:
        return jsonify({"error": "Geçersiz senaryo."}), 400
    return jsonify(scenario_methodology(scenario_id))


SENSITIVITY_SPREADS = {"20": 0.2, "50": 0.5}

#senaryo değişim ve oranlarını doğrular
@app.get("/api/weight-sensitivity")
def weight_sensitivity_check():
    scenario_id = request.args.get("scenario", "surface")
    if scenario_id not in SCENARIOS:
        return jsonify({"error": "Geçersiz senaryo."}), 400
    spread_key = request.args.get("spread", "20")
    if spread_key not in SENSITIVITY_SPREADS:
        return jsonify({"error": "Değişim oranı 20 veya 50 olmalıdır."}), 400
    try:
        result = _weight_sensitivity(scenario_id, spread_key)
    except (FileNotFoundError, OSError) as error:
        return jsonify({"error": str(error)}), 500
    return jsonify({
        **result,
        "note": "Her ağırlık rastgele bir katsayıyla çarpılıp (sabit tohum, tekrarlanabilir) sıralama yeniden hesaplandı. Yalnızca kapsamı %0'dan büyük cisimler dahildir. Ötegezegenlerin çoğunda aynı ölçütler eksik olduğundan, bu ölçütlerin ağırlığını değiştirmek onların puanını birlikte kaydırır ama aralarındaki sırayı değiştirmez; yüksek kararlılığın bir kısmı bu eksik veriden gelir.",
    })

#duyarlılık analizi ve önbellek
@lru_cache(maxsize=6)
def _weight_sensitivity(scenario_id, spread_key):
    records = list(_solar_ranking_entries())
    records.extend((item["host"], item["name"], item["metrics"]) for item in load_nasa_planets().values())
    return weight_sensitivity(criterion_rows(records, scenario_id), scenario_id, spread=SENSITIVITY_SPREADS[spread_key])

#ışık yılı ile uzaklık hesabı
@app.get("/api/destinations")
def destinations():
    """Return Solar System targets and nearby catalogued exoplanets for mission planning."""
    query = request.args.get("q", "").strip().casefold()
    try:
        limit = max(1, min(1000, int(request.args.get("limit", "300"))))
    except ValueError:
        return jsonify({"error": "Sonuç sayısı sayısal olmalıdır."}), 400

    selected_host = request.args.get("selected_host", "").strip().casefold()
    selected_planet = request.args.get("selected_planet", "").strip().casefold()
    results = []
    au_in_light_years = 149597870.7 / 9.460730472e12
    for host, name, metrics in _solar_ranking_entries():
        flux = metrics.get("insolation")
        orbit_au = math.sqrt(1 / flux) if flux and flux > 0 else None
        if name.casefold() == "dünya":
            distance_ly = 0.0
        elif name.casefold() == "ay":
            distance_ly = 384400 / 9.460730472e12
        else:
            distance_ly = abs(orbit_au - 1) * au_in_light_years if orbit_au is not None else None
        results.append({
            "host": host, "planet": name, "distance_ly": distance_ly,
            "orbit_au": orbit_au, "insolation": flux, "destination_type": "solar-system",
        })

    try:
        nasa = load_nasa_planets()
    except (FileNotFoundError, OSError) as error:
        return jsonify({"error": str(error)}), 500
    for item in nasa.values():
        results.append({
            "host": item["host"], "planet": item["name"],
            "distance_ly": item["metrics"].get("access"),
            "orbit_au": number(item.get("pl_orbsmax")),
            "insolation": item["metrics"].get("insolation"),
            "contested": item["contested"],
            "destination_type": "exoplanet",
        })

    if query:
        results = [item for item in results if query in f"{item['host']} {item['planet']}".casefold()]
    results.sort(key=lambda item: (
        item["distance_ly"] is None,
        item["distance_ly"] if item["distance_ly"] is not None else float("inf"),
        item["host"].casefold(),
        item["planet"].casefold(),
    ))
    selected = next((item for item in results
                     if item["host"].casefold() == selected_host
                     and item["planet"].casefold() == selected_planet), None)
    limited_results = results[:limit]
    if selected is not None and selected not in limited_results:
        limited_results.append(selected)
    return jsonify({"results": limited_results, "result_count": len(results)})

#kubbe senaroysu hesabı
@app.get("/api/map-scores")
def map_scores():
    """Single Python-produced source for the score and indicators shown on the star map."""
    records = [
        {"host": host, "planet": name, "population": "solar", "metrics": metrics,
         "contested": False, "flux_estimated": False, "temp_estimated": False}
        for host, name, metrics in _solar_ranking_entries()
    ]
    try:
        records.extend({
            "host": item["host"], "planet": item["name"], "population": "exoplanet",
            "metrics": item["metrics"], "contested": item["contested"],
            "flux_estimated": item["flux_estimated"], "temp_estimated": item["temp_estimated"],
        } for item in load_nasa_planets().values())
    except (FileNotFoundError, OSError) as error:
        return jsonify({"error": str(error)}), 500

    results = []
    for item in records:
        scenario = score_scenario(item["metrics"], "surface")
        results.append({
            "host": item["host"], "planet": item["planet"],
            "population": item["population"], "contested": item["contested"],
            "score": scenario["score"], "score_min": scenario["score_min"], "score_max": scenario["score_max"],
            "coverage": scenario["coverage"], "score_status": scenario["score_status"],
            "planet_class": classify_metrics(item["metrics"]),
            "applicable": scenario["applicable"],
            "applicability_note": scenario["applicability_note"],
            "indicators": scenario["indicators"],
            "critical_checks": scenario["critical_checks"],
            "flux_estimated": item["flux_estimated"], "temp_estimated": item["temp_estimated"],
            "metrics": {
                "temperature_kind": item["metrics"].get("temperature_kind"),
                "surface_pressure_bar": item["metrics"].get("surface_pressure_bar"),
                "atmosphere_summary": item["metrics"].get("atmosphere_summary"),
            },
        })
    return jsonify({"results": results})

#birim değişimi yapar, kullanıcı girdilerini doğrular ve senaryoları puanlar
@app.post("/api/custom-planet/analyze")
def analyze_custom_planet():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Gezegen girdileri JSON biçiminde gönderilmelidir."}), 400

    planet_name = str(payload.get("name", "")).strip()[:80] or "Özel gezegen"
    metrics = {
        "radius": None, "gravity": None, "insolation": None, "temperature": None,
        "temperature_kind": "surface", "surface_pressure_bar": None,
        "atmosphere_status": None, "atmosphere_summary": None,
        "access": None, "radiation": None, "water": None,
        "geothermal": None, "geology": None, "provenance": {},
    }
    input_fields = {
        "temperature_c": ("temperature", -273.15, 10000, 273.15, "Yüzey sıcaklığı (°C) kullanıcı girdisi"),
        "radius_earth": ("radius", 0.001, 1000, 0, "Yarıçap (Dünya = 1) kullanıcı girdisi"),
        "gravity_earth": ("gravity", 0, 100, 0, "Yerçekimi (Dünya = 1) kullanıcı girdisi"),
        "insolation_earth": ("insolation", 0, 1000000, 0, "Yıldız enerjisi (Dünya = 1) kullanıcı girdisi"),
        "surface_pressure_bar": ("surface_pressure_bar", 0, 1000000, 0, "Yüzey basıncı kullanıcı girdisi"),
        "radiation_safety": ("radiation", 0, 1, 0, "Radyasyon güvenliği kullanıcı tahmini (0–1)"),
        "water_availability": ("water", 0, 1, 0, "Su/kaynak uygunluğu kullanıcı tahmini (0–1)"),
        "geothermal_suitability": ("geothermal", 0, 1, 0, "Yer altı ısı uygunluğu kullanıcı tahmini (0–1)"),
        "geology_stability": ("geology", 0, 1, 0, "Jeolojik kararlılık kullanıcı tahmini (0–1)"),
        "distance_ly": ("access", 0, 1000000000, 0, "Dünya uzaklığı kullanıcı girdisi (ışık yılı)"),
    }
    for field, (metric, minimum, maximum, offset, label) in input_fields.items():
        raw = payload.get(field)
        if raw is None or str(raw).strip() == "":
            continue
        if isinstance(raw, bool):
            return jsonify({"error": f"{field} sayısal bir değer olmalıdır."}), 400
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return jsonify({"error": f"{field} sayısal bir değer olmalıdır."}), 400
        if not math.isfinite(value) or value < minimum or value > maximum:
            return jsonify({"error": f"{field} {minimum:g} ile {maximum:g} arasında olmalıdır."}), 400
        metrics[metric] = value + offset
        metrics["provenance"][metric] = {"kind": "user", "label": label}

    atmosphere = payload.get("atmosphere_status", "")
    if atmosphere not in ("", None, "breathable", "hostile"):
        return jsonify({"error": "Atmosfer seçimi geçersiz."}), 400
    if atmosphere:
        metrics["atmosphere_status"] = atmosphere
        metrics["atmosphere_summary"] = "Kullanıcı tarafından girilen atmosfer değerlendirmesi"
        metrics["provenance"]["atmosphere_suitability"] = {
            "kind": "user", "label": "Atmosfer değerlendirmesi kullanıcı girdisi",
        }

    scenarios = [score_scenario(metrics, scenario_id) for scenario_id in SCENARIOS]
    return jsonify({
        "planet": planet_name,
        "metrics": metrics,
        "scenarios": scenarios,
        "note": "Bu gezegenin değerleri kullanıcı girdisidir; ölçüm veya NASA arşiv verisi olarak doğrulanmamıştır.",
    })

#tüm cisimleri puanlar, eleme yapar ve sıralar
@lru_cache(maxsize=9)
def _ranked_planets(scenario_id, min_coverage):
    records = [
        {"host": host, "planet": name, "metrics": metrics, "population": "solar", "contested": False}
        for host, name, metrics in _solar_ranking_entries()
    ]
    nasa = load_nasa_planets()
    records.extend({
        "host": item["host"], "planet": item["name"], "metrics": item["metrics"],
        "population": "exoplanet", "contested": item["contested"],
    } for item in nasa.values())
    ranked = []
    for record in records:
        host, name, metrics = record["host"], record["planet"], record["metrics"]
        scenario = score_scenario(metrics, scenario_id)
        if scenario["score"] is None or scenario["coverage"] < min_coverage:
            continue
        measured = [item for item in scenario["indicators"] if item["available"]]
        strengths = sorted(measured, key=lambda item: item["score"], reverse=True)[:2]
        gaps = [item["name"] for item in scenario["indicators"] if not item["available"]]
        ranked.append({
            "host": host, "planet": name,
            "population": record["population"], "contested": record["contested"],
            "score": scenario["score"], "score_min": scenario["score_min"], "score_max": scenario["score_max"],
            "coverage": scenario["coverage"], "scope_note": scenario["scope_note"],
            "confidence": scenario["confidence"], "status": scenario["status"],
            "applicability_note": scenario["applicability_note"],
            "planet_class": classify_metrics(metrics)["label"],
            "strengths": [{"name": item["name"], "score": item["score"]} for item in strengths],
            "missing": gaps,
        })
    ranked.sort(key=lambda item: (item["score"], item["coverage"]), reverse=True)
    return tuple(ranked)

#ortam verileri ve ölçütleri birleştirir, Güneş Sistemi cisimlerini döndürür
def _solar_ranking_entries():
    entries = []
    for name, radius_km, temperature_c, gravity_ms, au in SOLAR_RANKING_BODIES:
        environment = SOLAR_SURFACE_ENVIRONMENT.get(name.casefold(), {})
        metrics = {
            "radius": radius_km / 6371 if radius_km else None,
            "gravity": gravity_ms / 9.81 if gravity_ms else None,
            "density": None,
            "insolation": 1 / au ** 2 if au else None,
            "temperature": temperature_c + 273.15 if temperature_c is not None else None,
            "temperature_kind": "surface",
            "surface_pressure_bar": environment.get("surface_pressure_bar"),
            "atmosphere_status": environment.get("atmosphere_status"),
            "atmosphere_summary": environment.get("atmosphere_summary"),
            "radiation": None, "water": None, "access": 0,
            "geothermal": None, "geology": None,
            "provenance": {
                "radius": {"kind": "project", "label": "Projede kayıtlı Güneş Sistemi boyut bilgisi"},
                "gravity": {"kind": "project", "label": "Projede kayıtlı yaklaşık yerçekimi değeri"},
                "insolation": {"kind": "derived", "label": "Güneş enerjisi AU uzaklığından 1/AU² ile hesaplandı"},
                "temperature": {"kind": "project", "label": "Projede kayıtlı yaklaşık sıcaklık değeri"} if temperature_c is not None else None,
                "surface_pressure_bar": {"kind": "project", "label": "Projede kayıtlı yaklaşık ortam verisi"} if environment.get("surface_pressure_bar") is not None else None,
                "atmosphere_suitability": {"kind": "project", "label": "Projede kayıtlı atmosfer özeti"} if environment.get("atmosphere_status") is not None else None,
                "access": {"kind": "project", "label": "Güneş Sistemi içi referans uzaklığı"},
            },
        }
        entries.append(("Güneş Sistemi", name, metrics))
    return entries


def serve(folder, filename, allowed_extensions):
    if Path(filename).suffix.lower() not in allowed_extensions:
        return "Dosya türüne izin verilmiyor.", 404
    return send_from_directory(ROOT / folder, filename)


@app.get("/index/<path:filename>")
def index_files(filename):
    return serve("index", filename, {".html"})


@app.get("/css/<path:filename>")
def css_files(filename):
    return serve("css", filename, {".css"})


@app.get("/js/<path:filename>")
def js_files(filename):
    return serve("js", filename, {".js"})


@app.get("/data/<path:filename>")
def data_files(filename):
    return serve("data", filename, {".csv"})


@app.get("/assets/<path:filename>")
def asset_files(filename):
    return serve("assets", filename, {".jpg", ".jpeg", ".png", ".webp"})


if __name__ == "__main__":
    app.run(debug=os.environ.get("EDENSTAR_DEBUG") == "1", host="127.0.0.1", port=5000)
