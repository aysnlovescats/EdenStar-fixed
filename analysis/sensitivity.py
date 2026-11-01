"""How much does the ranking depend on the scenario weights?

Two checks on the same data:
- Monte Carlo: every weight is multiplied by a random factor in [1 - spread, 1 + spread]
  and the whole ranking is recomputed; repeated many times with a fixed seed.
- One at a time: a single weight is raised by `spread`, the others stay fixed.
- Equal weights: every criterion gets the same weight (no judgement about importance).

Only the evidence score is perturbed (the same verified criteria and classification
penalty as score_scenario). Scores are kept unrounded here so that tiny weight changes
are not hidden by integer rounding. Planets with 0% coverage are left out: they all
score 0 regardless of the weights and would inflate the agreement.
"""
import random

from .consistency import spearman
from .scenarios import INDICATORS, SCENARIOS
from .scoring import score_scenario


# Her cisim için score_scenario'yu bir kez çalıştırıp doğrulanmış ölçüt puanlarını (0–1) ve sınıf cezasını saklar.
# Sonra farklı ağırlıklar denenirken bu hesap tekrarlanmaz; analiz bu sayede hızlı çalışır.
def criterion_rows(records, scenario_id):
    """records: iterable of (host, planet, metrics). Returns verified criterion scores per body."""
    rows = []
    for host, planet, metrics in records:
        result = score_scenario(metrics, scenario_id)
        if not result["applicable"] or result["coverage"] == 0:
            continue
        rows.append({
            "host": host, "planet": planet,
            "penalty": result["classification_penalty"] or 1.0,
            "criteria": {
                item["key"]: item["criterion_score"]
                for item in result["indicators"] if item["available"]
            },
        })
    return rows


# score_scenario ile aynı kural, farklı ağırlıklarla: Σ(ağırlık × ölçüt puanı) / Σ(ağırlık) × 100 × ceza.
def weighted_score(row, weights):
    """Same rule as score_scenario: missing criteria add 0, divide by all weights."""
    total = sum(weights.values())
    points = sum(weights[key] * value for key, value in row["criteria"].items())
    return points / total * 100 * row["penalty"]


# Puanları büyükten küçüğe sıralayıp cisimlerin sırasını (indeks listesi) döndürür; eşitlikte giriş sırası korunur.
def _ranking(scores):
    """Indices ordered best first; ties broken by input order so runs are comparable."""
    return sorted(range(len(scores)), key=lambda index: (-scores[index], index))


# Yeni sıralamayı orijinalle karşılaştırır: Spearman ρ, orijinal ilk 10'un ne kadarının ilk 10'da kaldığı
# ve her cismin yeni sırası.
def _compare(base_scores, base_top, scores, top_n):
    order = _ranking(scores)
    position = {index: rank + 1 for rank, index in enumerate(order)}
    top = set(order[:top_n])
    return {
        "spearman": spearman(base_scores, scores),
        "top_retention": len(top & set(base_top)) / len(base_top) if base_top else None,
        "position": position,
    }


# Listenin verilen yüzdelik değerini döndürür (ör. 0,05 → en kötü %5'lik dilimin sınırı).
def _percentile(values, fraction):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(fraction * len(ordered)))]


# Duyarlılık analizinin tamamı:
# 1) Monte Carlo: her ağırlığı [1 − spread, 1 + spread] arası rastgele katsayıyla çarp, sıralamayı yeniden hesapla
#    (runs kez, sabit tohum → her seferinde aynı sonuç).
# 2) Tek tek: yalnızca bir ağırlığı spread kadar artır.  3) Eşit ağırlık: tüm ölçütlere aynı ağırlık.
# Ortalama/en kötü ρ, ilk 10 korunma oranı ve ilk 10'un görülen sıra aralıklarını döndürür.
def weight_sensitivity(rows, scenario_id, runs=100, spread=0.2, top_n=10, seed=42):
    base_weights = SCENARIOS[scenario_id]["weights"]
    if len(rows) < 3:
        return {"scenario": scenario_id, "body_count": len(rows), "available": False}
    base_scores = [weighted_score(row, base_weights) for row in rows]
    base_order = _ranking(base_scores)
    base_top = base_order[:min(top_n, len(rows))]

    rng = random.Random(seed)
    rhos, retentions = [], []
    rank_seen = {index: [] for index in base_top}
    for _ in range(runs):
        # Her ağırlık rastgele bir katsayıyla çarpılır (ör. spread 0,2 → 0,8 ile 1,2 arası).
        weights = {key: weight * rng.uniform(1 - spread, 1 + spread) for key, weight in base_weights.items()}
        result = _compare(base_scores, base_top, [weighted_score(row, weights) for row in rows], len(base_top))
        rhos.append(result["spearman"])
        retentions.append(result["top_retention"])
        for index in base_top:
            rank_seen[index].append(result["position"][index])

    one_at_a_time = []
    for key, weight in sorted(base_weights.items(), key=lambda item: -item[1]):
        weights = {**base_weights, key: weight * (1 + spread)}
        result = _compare(base_scores, base_top, [weighted_score(row, weights) for row in rows], len(base_top))
        one_at_a_time.append({
            "key": key, "name": INDICATORS[key]["name"], "weight": weight,
            "spearman": round(result["spearman"], 4),
            "top_retention": round(result["top_retention"], 3),
        })

    # Equal weights: what the ranking would be with no judgement about importance at all.
    equal = _compare(base_scores, base_top, [weighted_score(row, dict.fromkeys(base_weights, 1)) for row in rows], len(base_top))

    top_bodies = []
    for base_rank, index in enumerate(base_top, start=1):
        seen = rank_seen[index]
        top_bodies.append({
            "host": rows[index]["host"], "planet": rows[index]["planet"],
            "base_rank": base_rank, "base_score": round(base_scores[index], 1),
            "rank_min": min(seen), "rank_max": max(seen),
            "top_share": round(sum(rank <= len(base_top) for rank in seen) / runs, 3),
        })

    return {
        "scenario": scenario_id,
        "available": True,
        "body_count": len(rows),
        "runs": runs, "spread": spread, "top_n": len(base_top), "seed": seed,
        "spearman_mean": round(sum(rhos) / runs, 4),
        "spearman_p5": round(_percentile(rhos, 0.05), 4),
        "spearman_min": round(min(rhos), 4),
        "top_retention_mean": round(sum(retentions) / runs, 3),
        "top_retention_min": round(min(retentions), 3),
        "equal_weights": {
            "spearman": round(equal["spearman"], 4),
            "top_retention": round(equal["top_retention"], 3),
        },
        "top_bodies": top_bodies,
        "one_at_a_time": one_at_a_time,
    }
