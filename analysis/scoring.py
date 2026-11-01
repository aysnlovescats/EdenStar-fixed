"""Transparent, deterministic suitability scoring with missing-data handling."""
import math

from .classification import classify_metrics
from .scenarios import INDICATORS, SCENARIOS, SCENARIO_GUIDANCE, SURFACE_GUARDRAILS


# Sayıyı JavaScript'in Math.round'u gibi yuvarlar (Python round 2,5'i 2 yapar; burada 3 olur).
# Böylece Python ve arayüz aynı sayıyı gösterir.
def _rounded_score(value):
    """Round non-negative scores the same way JavaScript Math.round does."""
    return math.floor(value + 0.5)


# Bir ölçüt değerini 0–1 arası puana çevirir:
# normalize → değeri 0–1'e kırp; lower_better → 1 − değer/eşik; higher_better → değer/eşik;
# diğerleri → max(0, 1 − |değer − ideal| / tolerans). Değer yoksa None (veri yok).
def _criterion_score(value, definition):
    if value is None:
        return None
    if definition.get("scale") == "normalized":
        # These scenario indicators are normalized suitability estimates from 0 to 1.
        return max(0.0, min(1.0, value))
    if definition.get("direction") == "lower_better":
        return max(0.0, min(1.0, 1.0 - value / definition["threshold"]))
    if definition.get("direction") == "higher_better":
        return max(0.0, min(1.0, value / definition["threshold"]))
    ideal, tolerance = definition["ideal"], definition["tolerance"]
    if ideal == 0:
        return max(0.0, 1.0 - max(0.0, value) / tolerance)
    return max(0.0, 1.0 - abs(value - ideal) / tolerance)


# Dış basınç puanı: 1 bar altı 0,8 + 0,2·p (vakumda 0,8), 1 bar üstü max(0, 1 − log10(p)/2)
# (10 bar → 0,5; 100 bar → 0).
def _surface_pressure_score(pressure_bar):
    """Habitat pressure-load proxy (matches README).

    Below 1 bar the shell load is mild, so the score falls only slowly toward 0.8
    at vacuum; from 1 bar upward it falls logarithmically and reaches 0 at 100 bar.
    """
    pressure_bar = max(0.0, pressure_bar)
    if pressure_bar < 1.0:
        return 0.8 + 0.2 * pressure_bar
    return max(0.0, 1.0 - math.log10(pressure_bar) / 2.0)


# Kubbe senaryosu için sıcaklık, basınç ve atmosferi 'ok / risk / unknown' olarak kontrol eder.
# Denge veya model sıcaklığı yüzey ölçümü olmadığı için 'unknown' sayılır. Puanı değiştirmez, uyarı olarak gösterilir.
def _surface_critical_checks(metrics):
    checks = []
    for key, name, unit, guardrail_key in (
        ("temperature", "Yüzey sıcaklığı", "K", "temperature_kelvin"),
        ("surface_pressure_bar", "Yüzey basıncı", "bar", "surface_pressure_bar"),
    ):
        value = metrics.get(key)
        low, high = SURFACE_GUARDRAILS[guardrail_key]
        temperature_is_equilibrium = key == "temperature" and metrics.get("temperature_kind") != "surface"
        temperature_is_user_input = (
            key == "temperature"
            and (metrics.get("provenance", {}).get("temperature") or {}).get("kind") == "user"
        )
        if temperature_is_equilibrium or temperature_is_user_input:
            checks.append({
                "name": name,
                "value": None,
                "unit": unit,
                "status": "unknown",
                "summary": (
                    "Yalnızca PHL model tahmini var (Dünya benzeri atmosfer varsayımı); gerçek yüzey sıcaklığı bilinmiyor"
                    if metrics.get("temperature_kind") == "modeled_surface"
                    else "Yalnızca NASA denge sıcaklığı var; gerçek yüzey sıcaklığı bilinmiyor"
                    if metrics.get("temperature_kind") == "equilibrium"
                    else "Kullanıcı girdisi; doğrulanmış yüzey sıcaklığı ölçümü değil"
                    if temperature_is_user_input
                    else "Sıcaklık verisinin yüzey ölçümü olduğu doğrulanmamış"
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


# Varsayımsal model: tahmin, PHL modeli ve kullanıcı girdilerini de kullanarak bir puan ARALIĞI üretir.
# Bilinmeyen ölçüt alt sınırda 0, üst sınırda 100 sayılır; yıldız sınıfı ön kabulü 10 ağırlıkla eklenir;
# sıcaklık akıdan türediyse çift sayılmasın diye ağırlığı çıkarılır. Ana puandan ayrı tutulur.
def _exploratory_model(metrics, scenario):
    """Estimate-based scenario RANGE with a small stellar-class prior.

    Unknown criteria get no neutral value: the lower bound counts them as 0 and the
    upper bound as 100. Inputs that only repeat stellar energy (flux-derived
    temperature) are dropped from both the points and the weight total.
    """
    star_weight = 10
    base_weight = sum(scenario["weights"].values())
    known_weight = 0
    unknown_weight = 0
    excluded_weight = 0
    known_points = 0.0
    assumptions = []
    provenance = metrics.get("provenance", {})

    for key, weight in scenario["weights"].items():
        definition = INDICATORS[key]
        if key == "atmosphere_suitability":
            atmosphere = metrics.get("atmosphere_status")
            value = None if atmosphere is None else 1.0 if atmosphere == "breathable" else 0.5
        else:
            value = metrics.get("density_score_input") if key == "density" else metrics.get(key)
        source = provenance.get(key) or {}
        kind = source.get("kind", "unknown")
        temperature_kind = metrics.get("temperature_kind")
        # Flux-derived temperature repeats the stellar-energy criterion: do not count it twice.
        if key == "temperature" and temperature_kind in ("modeled_surface", "equilibrium") and metrics.get("insolation") is not None:
            excluded_weight += weight
            assumptions.append({
                "name": definition["name"], "value": value, "unit": definition["unit"],
                "kind": "correlated_input_excluded",
                "label": "Yıldız enerjisinden türediği için ayrıca sayılmadı; ağırlığı hesaptan çıkarıldı",
                "weight": weight, "score": None,
            })
            continue
        score = None
        if value is not None and kind != "unknown":
            score = _surface_pressure_score(value) if key == "surface_pressure_bar" else _criterion_score(value, definition)
        if score is None:
            unknown_weight += weight
            assumptions.append({
                "name": definition["name"], "value": None, "unit": definition["unit"],
                "kind": "unknown_input",
                "label": "Veri yok; aralığın alt ucunda 0, üst ucunda 100 sayıldı",
                "weight": weight, "score": None,
            })
            continue
        known_weight += weight
        known_points += score * weight
        if kind in ("estimated", "modeled", "user"):
            assumptions.append({
                "name": definition["name"], "value": value, "unit": definition["unit"],
                "kind": kind, "label": source.get("label", "Tahmin/model"),
                "weight": weight, "score": _rounded_score(score * 100),
            })

    star_prior = metrics.get("stellar_habitability_prior")
    star_source = provenance.get("stellar_habitability_prior") or {}
    if star_prior is not None and star_source.get("kind") != "unknown":
        known_weight += star_weight
        known_points += star_prior * star_weight
        assumptions.append({
            "name": "Yıldız sınıfı ön kabulü", "value": metrics.get("stellar_type"),
            "unit": "spektral sınıf", "kind": "project_assumption",
            "label": "Proje varsayımı; ölçüm veya yaşanabilirlik olasılığı değil",
            "weight": star_weight, "score": _rounded_score(star_prior * 100),
        })
    else:
        unknown_weight += star_weight
        assumptions.append({
            "name": "Yıldız sınıfı ön kabulü", "value": None,
            "unit": "spektral sınıf", "kind": "unknown_input",
            "label": "Yıldız türü bilinmiyor; aralığın alt ucunda 0, üst ucunda 100 sayıldı",
            "weight": star_weight, "score": None,
        })

    denominator = base_weight + star_weight - excluded_weight
    has_range = known_weight > 0 and denominator > 0
    return {
        "score_min": _rounded_score(known_points / denominator * 100) if has_range else None,
        "score_max": _rounded_score((known_points + unknown_weight) / denominator * 100) if has_range else None,
        "coverage": _rounded_score(known_weight / denominator * 100) if denominator > 0 else 0,
        "star_type": metrics.get("stellar_type"),
        "star_factor": _rounded_score(star_prior * 100) if star_prior is not None else None,
        "star_weight": star_weight,
        "assumptions": assumptions,
        "note": "Tahmin ve PHL model değerleri yalnızca bu keşif modelinde kullanılır. Bilinmeyen ölçütlere nötr değer verilmez: alt sınırda 0, üst sınırda 100 sayılır. Yıldız enerjisini tekrar eden girdiler ayrıca sayılmaz. Yıldız sınıfı katsayısı proje varsayımıdır; yaşanabilirlik olasılığı değildir.",
    }


# Ana puanlama fonksiyonu. Adımlar:
# 1) Gezegeni sınıflandır; gaz devine yüzey/yer altı puanı verilmez, geçiş sınıfına ceza katsayısı uygulanır.
# 2) Her ölçütü puanla; yalnızca kaynağı archive/project/derived olanlar puana girer (available).
# 3) puan = Σ(ölçüt puanı × ağırlık) / Σ(tüm ağırlıklar) × 100 → eksik ölçüt 0 katkı yapar, yeniden ölçekleme yok.
# 4) Kapsam, alt–üst sınır, güven etiketi, kritik kontroller ve açıklama metinlerini ekleyip sözlük döndürür.
def score_scenario(metrics, scenario_id):
    scenario = SCENARIOS[scenario_id]
    classification = classify_metrics(metrics)
    applicable = not (
        scenario_id == "surface" and classification["surface_applicable"] is False
        or scenario_id == "underground" and classification["underground_applicable"] is False
    )
    penalty = classification.get("penalty", 1.0) if scenario_id in ("surface", "underground") else 1.0
    total_weight = sum(scenario["weights"].values())
    included_weight = 0
    weighted_points = 0.0
    indicators = []
    provenance = metrics.get("provenance", {})
    for key, weight in scenario["weights"].items():
        definition = INDICATORS[key]
        # Yüzey senaryosunda yalnızca ölçülmüş yüzey sıcaklığı karşılaştırılabilir; denge sıcaklığı puanlanmaz.
        comparable = not (key == "temperature" and metrics.get("temperature_kind") != "surface")
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
        source = provenance.get(key) or {}
        source_kind = source.get("kind", "unknown")
        # Evidence score accepts catalog/project values and values derived from them by
        # plain formulas (metrics.py downgrades "derived" to "estimated" if any input is
        # an estimate). Estimated, modeled and user-entered values stay in the exploratory model.
        available = score is not None and source_kind in ("archive", "project", "derived")
        if available:
            included_weight += weight
            weighted_points += score * weight
        name = definition["name"]
        if key == "temperature" and metrics.get("temperature_kind") == "surface":
            name = "Yüzey sıcaklığı"
        elif key == "subsurface_temperature":
            name = "Denge sıcaklığı (yer altı ısı vekili; gerçek yer altı ölçümü değil)"
        elif key == "temperature" and metrics.get("temperature_kind") == "modeled_surface":
            name = "PHL model sıcaklığı (ölçüm puanına katılmaz)"
        elif key == "temperature" and not comparable:
            name = "Sıcaklık (yüzey ölçümü doğrulanmadı)"
        indicators.append({
            "key": key, "name": name, "unit": definition["unit"],
            "value": value, "score": _rounded_score(score * 100) if available else None,
            "criterion_score": round(score, 6) if available else None,
            "weight": weight, "available": available,
            "data_status": (
                "PHL model tahmini var (Dünya benzeri atmosfer varsayımı); ölçüm değil, yalnızca varsayımsal modele katıldı"
                if key == "temperature" and metrics.get("temperature_kind") == "modeled_surface" else
                "Denge sıcaklığı var; yüzey sıcaklığı yerine geçmedi ve puana katılmadı"
                if key == "temperature" and metrics.get("temperature_kind") == "equilibrium" and value is not None else
                "Yüzey ölçümü olduğu doğrulanmadı; puana katılmadı"
                if key == "temperature" and not comparable and value is not None else
                "pl_bmassprov=Mass kütlesi ve arşiv yarıçapından formülle hesaplandı; yerçekimi kendi ağırlığıyla puanlandı, yarıçap ölçütü ayrıca değerlendirilir"
                if key == "gravity" and source_kind == "derived" else
                "Gerçek kütle (pl_bmassprov=Mass) ve ölçülmüş yarıçap gereklidir; Msini ve tahmini girdiler puanlanmaz"
                if key in ("density", "escape_velocity", "hill_window") and value is None else
                "Denge sıcaklığı yer altını ölçmez; doğrulanmış ana puana değil, varsayımsal keşif modeline kaba termal vekil olarak girer"
                if key == "subsurface_temperature" else
                source.get("label", "Kaynak doğrulanamadı; puana katılmadı")
                if key == "gravity" and source_kind == "unknown" and value is not None else
                f"{source.get('label', 'Kaynağı doğrulanmamış')} · tahmin/model, puana katılmadı"
                if value is not None and source_kind in ("estimated", "modeled") else
                source.get("label", "Kaynağı doğrulanmamış; puana katılmadı") if value is not None else "Veri yok; ana puanda 0 kabul edildi"
            ),
            "data_kind": source_kind if value is not None else "unknown",
            "contribution": round(score * weight, 2) if available else 0,
            "scoring_rule": (
                "Denge veya model sıcaklığı gerçek yüzey sıcaklığını doğrulamadığından yüzey senaryosunda puana katılmaz"
                if key == "temperature" and not comparable else
                "1 bar altında 0,8 + 0,2 × basınç; 1 bar ve üstünde max(0, 1 − log10(basınç)/2) formülüyle puanlanır"
                if key == "surface_pressure_bar" else
                "0–1 uygunluk girdisi; yüksek değer daha uygun"
                if definition.get("scale") == "normalized" else
                f"Düşük değer daha iyi; {definition['threshold']} {definition['unit']} ve üstü 0 puan (proje eşiği)"
                if definition.get("direction") == "lower_better" else
                f"Yüksek değer daha iyi; {definition['threshold']} {definition['unit']} ve üstü 100 puan (proje eşiği)"
                if definition.get("direction") == "higher_better" else
                f"İdeal {definition['ideal']} ± {definition['tolerance']} aralığına göre"
                if definition["ideal"] is not None else "Karşılaştırılabilir ölçüm gerekli"
            ),
        })

    # Kapsam: ağırlığın ne kadarının doğrulanmış veriyle desteklendiği (0–1).
    coverage = included_weight / total_weight if total_weight else 0
    measured_count = sum(1 for item in indicators if item["available"])
    has_evidence = measured_count > 0
    # Each observed criterion contributes only its configured share of the full
    # scenario weight. Missing criteria add no points and never inflate the score
    # by renormalizing one available criterion to 100%.
    raw_score = _rounded_score(weighted_points / total_weight * 100) if total_weight else None
    missing_weight = max(0, total_weight - included_weight)
    raw_score_min = _rounded_score(weighted_points / total_weight * 100) if total_weight else None
    # Üst sınır: bilinmeyen ölçütlerin hepsi tam puan (1) alsaydı puan ne olurdu.
    raw_score_max = (
        _rounded_score((weighted_points + missing_weight) / total_weight * 100)
        if total_weight else None
    )
    # Sınıf cezası (ör. süper-Dünya için 0,85) en sonda çarpılır; uygulanamayan senaryoda puan None.
    score = _rounded_score(raw_score * penalty) if applicable and raw_score is not None else None
    score_min = _rounded_score(raw_score_min * penalty) if applicable and raw_score_min is not None else None
    score_max = _rounded_score(raw_score_max * penalty) if applicable and raw_score_max is not None else None
    measured_names = [item["name"] for item in indicators if item["available"]]
    scope_note = None
    if not applicable and classification.get("surface_applicable") is False and scenario_id == "surface":
        scope_note = "Katı yüzeyi olmayan gezegen sınıfında yüzey puanı hesaplanmaz."
    elif not has_evidence:
        scope_note = (
            "Doğrulanmış ölçüm yok; eksik ölçütler ana puanda 0 kabul edildi. Veri kapsamı %0 olduğundan puan güvenilir bir uygunluk tahmini değildir."
        )
    elif score is not None and coverage < 1.0:
        scope_note = (
            "Bu kısmi puanda yalnızca kaynağı doğrulanmış " + ", ".join(measured_names)
            + " ölçütleri kendi senaryo ağırlıkları kadar katkı sağlar; eksik ölçütler puana katkı sağlamaz."
            if measured_names else
            "Bu senaryo için yeterli ölçüm yok; puan karşılaştırma amacıyla kullanılmamalı."
        )
    critical_checks = _surface_critical_checks(metrics) if scenario_id == "surface" else []
    critical_risks = [check for check in critical_checks if check["status"] == "risk"]
    critical_unknowns = [check for check in critical_checks if check["status"] == "unknown"]
    surface_size_risk = scenario_id == "surface" and metrics.get("radius") is not None and metrics["radius"] >= 2.5
    exploratory_model = _exploratory_model(metrics, scenario)
    if not applicable:
        exploratory_model = {
            **exploratory_model,
            "score_min": None, "score_max": None,
            "assumptions": [],
            "note": "Bu gökcismi sınıflandırması bu yerleşim senaryosuna uygulanamaz; varsayımsal puan verilmedi.",
        }
    elif penalty < 1 and exploratory_model["score_min"] is not None:
        exploratory_model = {
            **exploratory_model,
            "score_min": _rounded_score(exploratory_model["score_min"] * penalty),
            "score_max": _rounded_score(exploratory_model["score_max"] * penalty),
        }
    applicability_note = None
    if not applicable:
        applicability_note = classification["reason"] + " Bu nedenle bu senaryoya puan verilmedi."
    elif penalty < 1:
        reduction_percent = round((1 - penalty) * 100)
        applicability_note = f"{classification['label']} için puana %{reduction_percent} sınıflandırma ihtiyatı uygulandı."
    return {
        "id": scenario_id, "name": scenario["name"], "description": scenario["description"],
        "score": score, "score_min": score_min, "score_max": score_max,
        "coverage": round(coverage * 100), "scope_note": scope_note,
        "measured_indicator_count": measured_count,
        "score_status": (
            "Puan uygulanamaz"
            if not applicable else
            "Doğrulanmış ölçüm yok · eksikler 0 kabul edildi"
            if not has_evidence else
            f"Puanlanan {measured_count}/{len(indicators)} ölçüt · kapsam %{round(coverage * 100)}"
        ),
        "exploratory_model": exploratory_model,
        "classification": classification,
        "applicable": applicable,
        "applicability_note": applicability_note,
        "classification_penalty": penalty if penalty < 1 else None,
        # Güven: kritik veri yoksa Düşük; kapsam ≥ %80 Yüksek, ≥ %60 Orta, aksi halde Düşük.
        "confidence": "Düşük" if critical_unknowns or not has_evidence else "Yüksek" if coverage >= .8 else "Orta" if coverage >= .6 else "Düşük",
        "indicators": indicators,
        "guidance": SCENARIO_GUIDANCE[scenario_id],
        "interpretation": scenario["interpretation"],
        "critical_checks": critical_checks,
        "status": (
            applicability_note
            if applicability_note
            else "Doğrulanmış ölçüm yok; eksik ölçütler ana puanda 0 kabul edildi"
            if not has_evidence and applicable
            else "Doğrulanmış ölçüm yok; girilen tahminler yalnızca varsayımsal modelde gösterilir"
            if score is None and exploratory_model["score_min"] is not None
            else "Bu senaryo için ölçüm yok; skor hesaplanamıyor"
            if score is None
            else "Kubbe için zorlu yüzey koşulları var; etkileri kademeli puanlandı"
            if critical_risks
            else "Boyut yüzey yerleşimini zorlaştırabilir; yarıçap puanına yansıtıldı"
            if surface_size_risk
            else "Kritik yüzey verileri eksik; puan yalnızca ölçülebilen fiziksel ölçütleri kapsıyor"
            if critical_unknowns
            else "Ölçülen ölçütler kendi ağırlıkları kadar katkı sağlar; eksik ölçütler puana katkı sağlamaz"
            if coverage < 1.0
            else "Tüm senaryo ölçütleri doğrulanmış veriye dayanıyor"
        ),
    }
