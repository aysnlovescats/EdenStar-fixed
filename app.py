import csv
import os
from functools import lru_cache
from pathlib import Path

from flask import Flask, jsonify, redirect, request, send_from_directory
from analysis.metrics import derive_planet_metrics, number
from analysis.scenarios import SCENARIOS
from analysis.scoring import score_scenario

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
app = Flask(__name__, static_folder=None)


@lru_cache(maxsize=1)
def load_nasa_planets():
    files = sorted(DATA.glob("PS_*.csv"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not files:
        raise FileNotFoundError("data klasöründe PS_*.csv adlı NASA dosyası bulunamadı.")

    grouped = {}
    with files[0].open("r", encoding="utf-8-sig", newline="") as source:
        lines = (line for line in source if line.strip() and not line.lstrip().startswith("#"))
        for row in csv.DictReader(lines):
            if row.get("pl_controv_flag") == "1":
                continue
            host = (row.get("hostname") or "").strip()
            name = (row.get("pl_name") or "").strip()
            if host and name:
                key = (host.casefold(), name.casefold())
                grouped.setdefault(key, {"host": host, "name": name, "rows": []})["rows"].append(row)

    planets = {}
    fields = ("pl_rade", "pl_bmasse", "pl_insol", "pl_eqt", "pl_orbsmax", "st_lum", "st_rad", "st_teff", "sy_dist")
    for key, item in grouped.items():
        rows = sorted(item["rows"], key=lambda row: row.get("default_flag") != "1")
        merged = {
            field: next((row.get(field) for row in rows if number(row.get(field)) is not None), None)
            for field in fields
        }
        metrics, flux_estimated, temp_estimated = derive_planet_metrics(merged)
        planets[key] = {**item, **merged, "metrics": metrics,
                        "flux_estimated": flux_estimated, "temp_estimated": temp_estimated}
    return planets


@app.get("/")
def home():
    return redirect("/index/index.html")


@app.get("/api/analyze")
def analyze():
    host = request.args.get("host", "")
    planet_name = request.args.get("planet", "")
    estimated = []

    if host.casefold() == "güneş sistemi":
        radius_km = number(request.args.get("radius"))
        temperature_c = number(request.args.get("temperature"))
        gravity_ms = number(request.args.get("gravity"))
        au = number(request.args.get("au"))
        radius = radius_km / 6371 if radius_km is not None and radius_km > 0 else None
        metrics = {
            "radius": radius,
            "gravity": gravity_ms / 9.81 if gravity_ms is not None else None,
            "density": None,
            "insolation": 1 / au ** 2 if au is not None and au > 0 else None,
            "temperature": temperature_c + 273.15 if temperature_c is not None else None,
            "radiation": None, "water": None, "access": None,
            "geothermal": None, "geology": None,
        }
        if metrics["insolation"] is not None:
            estimated.append("Yıldız enerjisi 1/AU² ile hesaplandı")
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
        if item["flux_estimated"]:
            estimated.append("Yıldız enerjisi, yıldız parlaklığı ve yörünge uzaklığından tahmin edildi")
        if item["temp_estimated"]:
            estimated.append("Denge sıcaklığı, Dünya benzeri yansıtıcılık varsayımıyla tahmin edildi")
        source = "NASA Exoplanet Archive CSV dosyası"

    scenarios = [score_scenario(metrics, scenario_id) for scenario_id in SCENARIOS]
    return jsonify({
        "planet": planet_name, "metrics": metrics, "scenarios": scenarios,
        "estimated": estimated, "source": source,
        "note": "Skor; NASA arşivindeki ölçümlerden, analiz/scenarios.py dosyasındaki senaryo ağırlıklarıyla hesaplanan tekrarlanabilir bir uygunluk endeksidir. Olasılık veya koloni başarısı tahmini değildir. Eksik ölçütler sıfır sayılmaz; kalan ağırlıklar normalize edilir ve veri kapsamı ayrıca gösterilir."
    })


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


if __name__ == "__main__":
    app.run(debug=os.environ.get("EXOHABITAT_DEBUG") == "1", host="127.0.0.1", port=5000)
