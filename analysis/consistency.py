"""Project scores vs. PHL Earth Similarity Index: a consistency check, not a validation."""
import math

from .phl_catalog import normalize_planet_name
from .scoring import score_scenario

#degerleri sıralar, eşit değerler kendi pozisyonlarının ortalamasını paylaşır.
def _average_ranks(values):
    """Rank values from 1..n; tied values share the mean of their positions."""
    order = sorted(range(len(values)), key=lambda index: values[index])
    ranks = [0.0] * len(values)
    start = 0
    while start < len(order):
        end = start
        while end + 1 < len(order) and values[order[end + 1]] == values[order[start]]:
            end += 1
        shared_rank = (start + end) / 2 + 1
        for position in range(start, end + 1):
            ranks[order[position]] = shared_rank
        start = end + 1
    return ranks


def spearman(xs, ys):
    """Spearman rank correlation (Pearson on average ranks); None when undefined."""
    if len(xs) != len(ys) or len(xs) < 3:
        return None
    rx, ry = _average_ranks(xs), _average_ranks(ys)
    mean_x, mean_y = sum(rx) / len(rx), sum(ry) / len(ry)
    covariance = sum((a - mean_x) * (b - mean_y) for a, b in zip(rx, ry))
    spread_x = math.sqrt(sum((a - mean_x) ** 2 for a in rx))
    spread_y = math.sqrt(sum((b - mean_y) ** 2 for b in ry))
    if spread_x == 0 or spread_y == 0:
        return None
    return covariance / (spread_x * spread_y)

#esı sı olan gezegenleri, her biri için senaryo puanıyla eşleştirir; 0% kapsamlı gezegenler atlanır.
def esi_score_pairs(planets, catalog, scenario_id):
    """Pair each NASA planet that has an ESI with its scenario score.

    Planets with 0% coverage are left out: their score is missing evidence,
    not a measured result, so it would only add a column of zeros.
    """
    pairs = []
    for item in planets.values():
        phl = catalog.get(normalize_planet_name(item["name"]))
        if phl is None or phl.get("esi") is None:
            continue
        scenario = score_scenario(item["metrics"], scenario_id)
        if scenario["score"] is None or scenario["coverage"] == 0:
            continue
        pairs.append({
            "host": item["host"], "planet": item["name"],
            "esi": phl["esi"], "score": scenario["score"], "coverage": scenario["coverage"],
            "phl_class": phl.get("habitability_class"),
        })
    return pairs

#hesaplama yaparak PHL ESI ile proje senaryosu puanları arasındaki tutarlılığı döndürür; eşleşen gezegen sayısı ve Spearman korelasyon katsayısı dahil.
def esi_consistency(planets, catalog, scenario_id):
    pairs = esi_score_pairs(planets, catalog, scenario_id)
    rho = spearman([item["esi"] for item in pairs], [item["score"] for item in pairs])
    return {
        "scenario": scenario_id,
        "pair_count": len(pairs),
        "spearman": None if rho is None else round(rho, 3),
        "points": pairs,
    }
