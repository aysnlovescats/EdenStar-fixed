"""Create a CSV report using the same scenario model as the web app."""
import csv
from pathlib import Path

from analysis.classification import classify_metrics
from analysis.dataset import load_planets
from analysis.scenarios import SCENARIOS
from analysis.scoring import score_scenario

ROOT = Path(__file__).resolve().parent
files = sorted((ROOT / "data").glob("PS_*.csv"), key=lambda path: path.stat().st_mtime, reverse=True)
if not files:
    raise SystemExit("data klasöründe PS_*.csv bulunamadı.")

# Her gezegeni üç senaryoda puanlayıp rapor için bir satır oluşturur.
results = []
for item in load_planets().values():
    metrics = item["metrics"]
    record = {
        "Gezegen": item["name"],
        "Yıldız sistemi": item["host"],
        "Boyut sınıfı": classify_metrics(metrics)["label"],
        "Doğrulama durumu": "Tartışmalı" if item["contested"] else "İşaretli değil",
    }
    for scenario_id, scenario in SCENARIOS.items():
        result = score_scenario(metrics, scenario_id)
        record[f"{scenario['name']} skoru"] = result["score"]
        record[f"{scenario['name']} olası alt sınır"] = result["score_min"]
        record[f"{scenario['name']} olası üst sınır"] = result["score_max"]
        record[f"{scenario['name']} veri kapsamı (%)"] = result["coverage"]
    record["Yıldız enerjisi tahmini"] = "Evet" if item["flux_estimated"] else "Hayır"
    record["Sıcaklık tahmini"] = "Evet" if item["temp_estimated"] else "Hayır"
    record["Yüzey sıcaklığı PHL modeli"] = "Evet" if item.get("temp_modeled") else "Hayır"
    results.append(record)

surface_score_field = f"{SCENARIOS['surface']['name']} skoru"
# Kubbe puanına göre büyükten küçüğe sırala; puanı olmayanlar sona.
results.sort(key=lambda row: (row[surface_score_field] is None, -(row[surface_score_field] or 0)))
# Sonucu data/colony_scenarios.csv dosyasına yazar (utf-8-sig: Excel'de Türkçe karakterler bozulmasın).
output = ROOT / "data" / "colony_scenarios.csv"
with output.open("w", encoding="utf-8-sig", newline="") as destination:
    fields = list(results[0]) if results else ["Gezegen", "Yıldız sistemi"]
    writer = csv.DictWriter(destination, fieldnames=fields)
    writer.writeheader()
    writer.writerows(results)
print(f"{len(results)} gezegen değerlendirildi. Sonuç: {output}")
