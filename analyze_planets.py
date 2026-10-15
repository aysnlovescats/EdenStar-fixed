"""Create a CSV report using the same scenario model as the web app."""
import csv
from pathlib import Path

from analysis.metrics import derive_planet_metrics
from analysis.scenarios import SCENARIOS
from analysis.scoring import score_scenario

ROOT = Path(__file__).resolve().parent
files = sorted((ROOT / "data").glob("PS_*.csv"), key=lambda path: path.stat().st_mtime, reverse=True)
if not files:
    raise SystemExit("data klasöründe PS_*.csv bulunamadı.")

results = []
with files[0].open("r", encoding="utf-8-sig", newline="") as source:
    lines = (line for line in source if line.strip() and not line.lstrip().startswith("#"))
    for row in csv.DictReader(lines):
        if row.get("default_flag") not in ("", "1") or row.get("pl_controv_flag") == "1":
            continue
        metrics, flux_estimated, temp_estimated = derive_planet_metrics(row)
        record = {"Gezegen": row.get("pl_name", ""), "Yıldız sistemi": row.get("hostname", "")}
        for scenario_id, scenario in SCENARIOS.items():
            result = score_scenario(metrics, scenario_id)
            record[f"{scenario['name']} skoru"] = result["score"]
            record[f"{scenario['name']} veri kapsamı (%)"] = result["coverage"]
        record["Yıldız enerjisi tahmini"] = "Evet" if flux_estimated else "Hayır"
        record["Sıcaklık tahmini"] = "Evet" if temp_estimated else "Hayır"
        results.append(record)

results.sort(key=lambda row: (row["Yüzey yerleşimi skoru"] is None, -(row["Yüzey yerleşimi skoru"] or 0)))
output = ROOT / "data" / "colony_scenarios.csv"
with output.open("w", encoding="utf-8-sig", newline="") as destination:
    fields = list(results[0]) if results else ["Gezegen", "Yıldız sistemi"]
    writer = csv.DictWriter(destination, fieldnames=fields)
    writer.writeheader()
    writer.writerows(results)
print(f"{len(results)} gezegen değerlendirildi. Sonuç: {output}")
