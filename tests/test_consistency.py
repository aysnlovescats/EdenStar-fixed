"""analysis/consistency.py için birim testleri."""
import pytest

from analysis.consistency import _average_ranks, esi_consistency, spearman


def test_average_ranks_share_ties():
    assert _average_ranks([10, 20, 20, 30]) == [1, 2.5, 2.5, 4]


def test_spearman_perfect_monotonic_relations():
    xs = [1, 2, 3, 4, 5]
    assert spearman(xs, [1, 4, 9, 16, 25]) == pytest.approx(1.0)   # doğrusal olmasa da sıra aynı
    assert spearman(xs, [5, 4, 3, 2, 1]) == pytest.approx(-1.0)


def test_spearman_known_value_with_ties():
    # Elle hesap: x sıraları [1, 2, 3, 4], y sıraları [1, 2.5, 2.5, 4] → ρ ≈ 0.9487
    assert spearman([1, 2, 3, 4], [1, 2, 2, 3]) == pytest.approx(0.9487, abs=1e-4)


@pytest.mark.parametrize("xs, ys", [
    ([1, 2], [1, 2]),          # 3'ten az nokta
    ([1, 2, 3], [5, 5, 5]),    # varyans yok
    ([1, 2, 3], [1, 2]),       # uzunluklar farklı
])
def test_spearman_undefined_cases(xs, ys):
    assert spearman(xs, ys) is None


def planet(name, insolation):
    return {
        "host": "Test", "name": name,
        "metrics": {"insolation": insolation, "provenance": {"insolation": {"kind": "archive"}}},
    }


def test_esi_consistency_pairs_only_matched_planets_with_coverage():
    planets = {
        ("test", "a"): planet("A", 1.0),
        ("test", "b"): planet("B", 2.0),
        ("test", "c"): planet("C", 0.4),
        ("test", "no-phl"): planet("No PHL", 1.0),
        ("test", "no-data"): {"host": "Test", "name": "No Data", "metrics": {"provenance": {}}},
    }
    catalog = {
        "a": {"esi": 0.9, "habitability_class": 1},
        "b": {"esi": 0.5, "habitability_class": None},
        "c": {"esi": 0.7, "habitability_class": 2},
        "no data": {"esi": 0.8, "habitability_class": None},   # kapsamı %0 → dışarıda
    }
    result = esi_consistency(planets, catalog, "orbital")
    assert result["pair_count"] == 3
    assert {item["planet"] for item in result["points"]} == {"A", "B", "C"}
    # Yörünge puanı akıya göre A > C > B, ESI de A > C > B → tam uyum
    assert result["spearman"] == pytest.approx(1.0)
