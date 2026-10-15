"""Transparent, deterministic suitability scoring with missing-data handling."""
from .scenarios import INDICATORS, SCENARIOS


def _criterion_score(value, definition):
    if value is None:
        return None
    ideal, tolerance = definition["ideal"], definition["tolerance"]
    if ideal == 0:
        return max(0.0, 1.0 - max(0.0, value) / tolerance)
    return max(0.0, 1.0 - abs(value - ideal) / tolerance)


def score_scenario(metrics, scenario_id):
    scenario = SCENARIOS[scenario_id]
    total_weight = sum(scenario["weights"].values())
    included_weight = 0
    weighted_points = 0.0
    indicators = []
    for key, weight in scenario["weights"].items():
        definition = INDICATORS[key]
        value = metrics.get(key)
        score = _criterion_score(value, definition)
        available = score is not None
        if available:
            included_weight += weight
            weighted_points += score * weight
        indicators.append({
            "key": key, "name": definition["name"], "unit": definition["unit"],
            "value": value, "score": round(score * 100) if available else None,
            "weight": weight, "available": available,
        })

    coverage = included_weight / total_weight if total_weight else 0
    # At least two measured indicators and 30% of scenario weight are required.
    measured_count = sum(item["available"] for item in indicators)
    score = round(weighted_points / included_weight * 100) if measured_count >= 2 and coverage >= 0.30 else None
    return {
        "id": scenario_id, "name": scenario["name"], "description": scenario["description"],
        "score": score, "coverage": round(coverage * 100),
        "confidence": "Yüksek" if coverage >= .8 else "Orta" if coverage >= .6 else "Düşük",
        "indicators": indicators,
        "status": "Yeterli veri yok; skor gösterilmiyor" if score is None else "Veri bulunan ölçütlerin ağırlıklı puanı",
    }
