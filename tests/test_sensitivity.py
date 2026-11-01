"""Ağırlık gerekçeleri ve duyarlılık analizi testleri."""
import pytest

from analysis.methodology import scenario_methodology
from analysis.scenarios import SCENARIOS, WEIGHT_RATIONALE, WEIGHT_SOURCES
from analysis.scoring import score_scenario
from analysis.sensitivity import criterion_rows, weight_sensitivity, weighted_score


@pytest.mark.parametrize("scenario_id", list(SCENARIOS))
def test_every_weight_has_a_reason_and_known_sources(scenario_id):
    # Yeni bir ağırlık eklenirse gerekçesi yazılmadan test geçmez.
    rationale = WEIGHT_RATIONALE[scenario_id]["indicators"]
    assert set(rationale) == set(SCENARIOS[scenario_id]["weights"])
    for entry in rationale.values():
        assert entry["reason"].strip()
        assert entry["sources"] and all(source in WEIGHT_SOURCES for source in entry["sources"])


def test_methodology_is_sorted_and_shares_add_up():
    result = scenario_methodology("surface")
    weights = [item["weight"] for item in result["weights"]]
    assert weights == sorted(weights, reverse=True)
    assert sum(item["share_percent"] for item in result["weights"]) == pytest.approx(100, abs=0.5)
    assert result["weights"][0]["sources"][0]["label"]


def body(name, **values):
    return ("Test", name, {**values, "provenance": {key: {"kind": "archive"} for key in values}})


def orbital_records():
    return [
        body("A", insolation=1.0, escape_velocity=4.0, hill_window=30.0, access=10.0),
        body("B", insolation=0.6, escape_velocity=10.0, hill_window=20.0, access=50.0),
        body("C", insolation=2.0, escape_velocity=15.0, hill_window=5.0, access=500.0),
        body("D", insolation=1.4, escape_velocity=8.0),
        ("Test", "Empty", {"provenance": {}}),
    ]


def test_weighted_score_reproduces_scenario_score():
    rows = criterion_rows(orbital_records(), "orbital")
    for row, (_, _, metrics) in zip(rows, orbital_records()):
        expected = score_scenario(metrics, "orbital")["score"]
        assert round(weighted_score(row, SCENARIOS["orbital"]["weights"])) == expected


def test_zero_coverage_bodies_are_left_out():
    names = [row["planet"] for row in criterion_rows(orbital_records(), "orbital")]
    assert "Empty" not in names and len(names) == 4


def test_sensitivity_is_reproducible_and_bounded():
    rows = criterion_rows(orbital_records(), "orbital")
    first = weight_sensitivity(rows, "orbital", runs=30, top_n=2)
    second = weight_sensitivity(rows, "orbital", runs=30, top_n=2)
    assert first == second                                   # sabit tohum → aynı sonuç
    assert -1 <= first["spearman_min"] <= first["spearman_mean"] <= 1
    assert 0 <= first["top_retention_min"] <= first["top_retention_mean"] <= 1
    assert [item["base_rank"] for item in first["top_bodies"]] == [1, 2]
    for item in first["top_bodies"]:
        assert item["rank_min"] <= item["base_rank"] <= item["rank_max"]
    assert {item["key"] for item in first["one_at_a_time"]} == set(SCENARIOS["orbital"]["weights"])


def test_zero_spread_changes_nothing():
    rows = criterion_rows(orbital_records(), "orbital")
    result = weight_sensitivity(rows, "orbital", runs=5, spread=0.0, top_n=2)
    assert result["spearman_min"] == pytest.approx(1.0)
    assert result["top_retention_min"] == 1.0
