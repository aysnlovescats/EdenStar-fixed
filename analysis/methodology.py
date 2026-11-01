"""Weight rationale in an API/AI-ready shape: every weight with its reason and sources."""
from .scenarios import INDICATORS, SCENARIOS, WEIGHT_DERIVATION_NOTE, WEIGHT_RATIONALE, WEIGHT_SOURCES


# INDICATORS names the temperature criterion after the exoplanet equilibrium value, but
# only a measured surface temperature is scored (see score_scenario), so say that here.
# Sıcaklık ölçütünün adını tabloda doğru göstermek için (puana yalnızca ölçülmüş yüzey sıcaklığı girer).
NAME_OVERRIDES = {"temperature": "Yüzey sıcaklığı (ölçülmüş; denge sıcaklığı puana girmez)"}


# Senaryonun ağırlıklarını büyükten küçüğe; her biri için yüzde payı, gerekçesi ve kaynaklarıyla döndürür.
def scenario_methodology(scenario_id):
    scenario = SCENARIOS[scenario_id]
    rationale = WEIGHT_RATIONALE[scenario_id]
    total = sum(scenario["weights"].values())
    weights = []
    for key, weight in sorted(scenario["weights"].items(), key=lambda item: -item[1]):
        entry = rationale["indicators"][key]
        weights.append({
            "key": key,
            "name": NAME_OVERRIDES.get(key, INDICATORS[key]["name"]),
            "weight": weight,
            "share_percent": round(weight / total * 100, 1),
            "reason": entry["reason"],
            "sources": [{"id": source_id, **WEIGHT_SOURCES[source_id]} for source_id in entry["sources"]],
        })
    return {
        "scenario": scenario_id,
        "name": scenario["name"],
        "basis": rationale["basis"],
        "derivation_note": WEIGHT_DERIVATION_NOTE,
        "weights": weights,
    }
