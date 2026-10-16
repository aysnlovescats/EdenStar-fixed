"""Transparent, deterministic suitability scoring with missing-data handling."""
import math

from .scenarios import INDICATORS, SCENARIOS, SCENARIO_GUIDANCE, SURFACE_GUARDRAILS


def _rounded_score(value):
    """Round non-negative scores the same way JavaScript Math.round does."""
    return math.floor(value + 0.5)


def _criterion_score(value, definition):
    if value is None:
        return None
    ideal, tolerance = definition["ideal"], definition["tolerance"]
    if definition.get("scale") == "normalized":
        # These scenario indicators are normalized suitability estimates from 0 to 1.
        return max(0.0, min(1.0, value))
    if ideal == 0:
        return max(0.0, 1.0 - max(0.0, value) / tolerance)
    return max(0.0, 1.0 - abs(value - ideal) / tolerance)


def _surface_pressure_score(pressure_bar):
    """Habitat pressure-load proxy (matches README).

    Below 1 bar the shell load is mild, so the score falls only slowly toward 0.8
    at vacuum; from 1 bar upward it falls logarithmically and reaches 0 at 100 bar.
    """
    pressure_bar = max(0.0, pressure_bar)
    if pressure_bar < 1.0:
        return 0.8 + 0.2 * pressure_bar
    return max(0.0, 1.0 - math.log10(pressure_bar) / 2.0)


def _surface_critical_checks(metrics):
    checks = []
    for key, name, unit, guardrail_key in (
        ("temperature", "Yüzey sıcaklığı", "K", "temperature_kelvin"),
        ("surface_pressure_bar", "Yüzey basıncı", "bar", "surface_pressure_bar"),
    ):
        value = metrics.get(key)
        low, high = SURFACE_GUARDRAILS[guardrail_key]
        temperature_is_equilibrium = key == "temperature" and metrics.get("temperature_kind") != "surface"
        modeled = key == "temperature" and metrics.get("temperature_kind") == "modeled_surface"
        if temperature_is_equilibrium:
            checks.append({
                "name": name,
                "value": None,
                "unit": unit,
                "status": "unknown",
                "summary": (
                    "Yalnızca PHL model tahmini var (Dünya benzeri atmosfer varsayımı); gerçek yüzey sıcaklığı bilinmiyor"
                    if modeled else "Yalnızca denge sıcaklığı var; gerçek yüzey sıcaklığı bilinmiyor"
                ),
            })
            continue
        checks.append({
            "name": name,
            "value": value,
            "unit": unit,
            "status": "unknown" if value is None else "ok" if low <= value <= high else "risk",
            "summary": f"Ön eleme aralığı {low:g}–{high:g} {unit}",
        })

    atmosphere = metrics.get("atmosphere_status")
    checks.append({
        "name": "Atmosfer / toksisite",
        "value": atmosphere,
        "unit": "",
        "status": "unknown" if atmosphere is None else "ok" if atmosphere == "breathable" else "risk",
        "summary": metrics.get("atmosphere_summary") or (
            "Solunabilir atmosfer ölçümü yok" if atmosphere is None
            else "İnsan için uygun atmosfer" if atmosphere == "breathable"
            else "Solunamaz veya zararlı atmosfer"
        ),
    })
    return checks


def score_scenario(metrics, scenario_id):
    scenario = SCENARIOS[scenario_id]
    total_weight = sum(scenario["weights"].values())
    included_weight = 0
    weighted_points = 0.0
    indicators = []
    provenance = metrics.get("provenance", {})
    for key, weight in scenario["weights"].items():
        definition = INDICATORS[key]
        comparable = not (key == "temperature" and metrics.get("temperature_kind") in ("equilibrium", "modeled_surface"))
        if key == "atmosphere_suitability":
            atmosphere = metrics.get("atmosphere_status")
            value = None if atmosphere is None else 1.0 if atmosphere == "breathable" else 0.5
            score = _criterion_score(value, definition) if comparable else None
        else:
            value = metrics.get(key)
            score = (
                None if not comparable else
                _surface_pressure_score(value) if key == "surface_pressure_bar" and value is not None else
                _criterion_score(value, definition)
            )
        available = score is not None
        if available:
            included_weight += weight
            weighted_points += score * weight
        name = definition["name"]
        if key == "temperature" and metrics.get("temperature_kind") == "surface":
            name = "Yüzey sıcaklığı"
        elif key == "temperature" and metrics.get("temperature_kind") == "modeled_surface":
            name = "PHL model sıcaklığı (puana katılmaz)"
        indicators.append({
            "key": key, "name": name, "unit": definition["unit"],
            "value": value, "score": _rounded_score(score * 100) if available else None,
            "weight": weight, "available": available,
            "data_status": (
                "PHL model tahmini var (Dünya benzeri atmosfer varsayımı); ölçüm değil, puana katılmadı"
                if key == "temperature" and metrics.get("temperature_kind") == "modeled_surface" else
                "Denge sıcaklığı var; yüzey sıcaklığı yerine geçmedi ve puana katılmadı"
                if key == "temperature" and not comparable and value is not None else
                provenance.get(key, {}).get("label", "Veri yok") if value is not None else "Veri yok"
            ),
            "data_kind": provenance.get(key, {}).get("kind", "unknown") if value is not None else "unknown",
            "contribution": round(score * weight, 2) if available else None,
            "scoring_rule": (
                "Denge veya model sıcaklığı gerçek yüzey sıcaklığını doğrulamadığından puana katılmaz"
                if key == "temperature" and not comparable else
                "1 bar altında 0,8 + 0,2 × basınç; 1 bar ve üstünde max(0, 1 − log10(basınç)/2) formülüyle puanlanır"
                if key == "surface_pressure_bar" else
                "0–1 uygunluk girdisi; yüksek değer daha uygun"
                if definition.get("scale") == "normalized" else
                f"İdeal {definition['ideal']} ± {definition['tolerance']} aralığına göre"
                if definition["ideal"] is not None else "Karşılaştırılabilir ölçüm gerekli"
            ),
        })

    coverage = included_weight / total_weight if total_weight else 0
    # Keep the full scenario weight as the denominator so sparse data cannot look excellent.
    # A measured criterion still yields a partial score; no measured criteria yields None.
    score = _rounded_score(weighted_points / total_weight * 100) if included_weight and total_weight else None
    missing_weight = max(0, total_weight - included_weight)
    score_max = (
        _rounded_score((weighted_points + missing_weight) / total_weight * 100)
        if score is not None and total_weight else None
    )
    measured_names = [item["name"] for item in indicators if item["available"]]
    scope_note = None
    if score is not None and coverage < .60:
        scope_note = (
            "Bu puan yalnızca " + ", ".join(measured_names)
            + " ölçütlerine dayanıyor; senaryonun tamamını temsil etmez."
            if measured_names else
            "Bu senaryo için yeterli ölçüm yok; puan karşılaştırma amacıyla kullanılmamalı."
        )
    critical_checks = _surface_critical_checks(metrics) if scenario_id == "surface" else []
    critical_risks = [check for check in critical_checks if check["status"] == "risk"]
    critical_unknowns = [check for check in critical_checks if check["status"] == "unknown"]
    surface_size_risk = scenario_id == "surface" and metrics.get("radius") is not None and metrics["radius"] >= 2.5
    return {
        "id": scenario_id, "name": scenario["name"], "description": scenario["description"],
        "score": score, "score_min": score, "score_max": score_max,
        "coverage": round(coverage * 100), "scope_note": scope_note,
        "confidence": "Düşük" if critical_unknowns else "Yüksek" if coverage >= .8 else "Orta" if coverage >= .6 else "Düşük",
        "indicators": indicators,
        "guidance": SCENARIO_GUIDANCE[scenario_id],
        "critical_checks": critical_checks,
        "status": (
            "Bu senaryo için ölçüm yok; skor hesaplanamıyor"
            if score is None
            else "Kubbe için zorlu yüzey koşulları var; etkileri kademeli puanlandı"
            if critical_risks
            else "Boyut yüzey yerleşimini zorlaştırabilir; yarıçap puanına yansıtıldı"
            if surface_size_risk
            else "Kritik yüzey verileri eksik; puan yalnızca ölçülebilen fiziksel ölçütleri kapsıyor"
            if critical_unknowns
            else "Eksik ölçütler puana katkı sağlamaz; puan düşük veri kapsamını yansıtır"
            if coverage < .50
            else "Veri bulunan ölçütlerin ağırlıklı puanı"
        ),
    }
