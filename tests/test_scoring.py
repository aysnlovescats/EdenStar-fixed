"""analysis/scoring.py için birim testleri.

Çalıştırma: python -m pytest
"""
import pytest

from analysis.scenarios import INDICATORS
from analysis.scoring import (
    _criterion_score,
    _rounded_score,
    _surface_pressure_score,
    score_scenario,
)


def make_metrics(values, kind="archive", **extra):
    """Verilen değerlerin hepsini aynı kaynak türüyle işaretleyen ölçüm sözlüğü."""
    return {
        **values,
        "provenance": {key: {"kind": kind} for key in values},
        **extra,
    }


def indicator(result, key):
    return next(item for item in result["indicators"] if item["key"] == key)


# --- Yardımcı fonksiyonlar ---------------------------------------------------

def test_rounded_score_matches_javascript_math_round():
    # Python round() 2.5'i 2'ye yuvarlar; arayüzle tutarlılık için 3 olmalı.
    assert _rounded_score(2.5) == 3
    assert _rounded_score(84.49) == 84


@pytest.mark.parametrize("value, expected", [
    (1.0, 1.0),     # ideal değer
    (1.75, 0.5),    # toleransın yarısı kadar uzak
    (2.5, 0.0),     # tolerans sınırı
    (10.0, 0.0),    # sınırın dışı negatif olmaz
])
def test_criterion_score_ideal_tolerance_formula(value, expected):
    assert _criterion_score(value, INDICATORS["insolation"]) == pytest.approx(expected)


def test_criterion_score_one_directional_rules():
    assert _criterion_score(10, INDICATORS["escape_velocity"]) == pytest.approx(0.5)
    assert _criterion_score(25, INDICATORS["escape_velocity"]) == 0.0
    assert _criterion_score(15, INDICATORS["hill_window"]) == pytest.approx(0.5)
    assert _criterion_score(60, INDICATORS["hill_window"]) == 1.0


def test_criterion_score_missing_value_is_none():
    assert _criterion_score(None, INDICATORS["radius"]) is None


@pytest.mark.parametrize("pressure, expected", [
    (0.0, 0.8),     # vakum: kabuk yükü hafif
    (0.5, 0.9),
    (1.0, 1.0),
    (10.0, 0.5),    # logaritmik düşüş
    (100.0, 0.0),
    (1000.0, 0.0),
])
def test_surface_pressure_score(pressure, expected):
    assert _surface_pressure_score(pressure) == pytest.approx(expected)


# --- Senaryo puanı ----------------------------------------------------------

def test_orbital_score_with_full_coverage():
    metrics = make_metrics({
        "insolation": 1.0,        # 1.0 × 35
        "escape_velocity": 10.0,  # 0.5 × 30
        "hill_window": 30.0,      # 1.0 × 25
        "access": 0.0,            # 1.0 × 10
    })
    result = score_scenario(metrics, "orbital")
    assert result["score"] == 85
    assert result["coverage"] == 100
    assert result["score_min"] == result["score_max"] == 85


def test_missing_criteria_count_as_zero_not_renormalized():
    # Tek ölçüt bilinirse puan 100'e ölçeklenmez; yalnızca kendi ağırlığı kadar katkı yapar.
    result = score_scenario(make_metrics({"insolation": 1.0}), "orbital")
    assert result["score"] == 35
    assert result["coverage"] == 35
    assert result["score_min"] == 35
    assert result["score_max"] == 100
    assert indicator(result, "escape_velocity")["available"] is False


def test_no_data_gives_zero_score_and_zero_coverage():
    result = score_scenario({"provenance": {}}, "orbital")
    assert result["score"] == 0
    assert result["coverage"] == 0
    assert result["score_max"] == 100
    assert result["confidence"] == "Düşük"


@pytest.mark.parametrize("kind", ["estimated", "modeled", "user"])
def test_unverified_sources_stay_out_of_evidence_score(kind):
    result = score_scenario(make_metrics({"insolation": 1.0}, kind=kind), "orbital")
    assert result["score"] == 0
    assert result["coverage"] == 0
    assert indicator(result, "insolation")["available"] is False


def test_equilibrium_temperature_is_not_used_as_surface_temperature():
    metrics = make_metrics({"temperature": 288.0}, temperature_kind="equilibrium")
    result = score_scenario(metrics, "surface")
    assert indicator(result, "temperature")["available"] is False
    assert result["coverage"] == 0


def test_measured_surface_temperature_is_scored():
    metrics = make_metrics({"temperature": 288.0}, temperature_kind="surface")
    result = score_scenario(metrics, "surface")
    assert indicator(result, "temperature")["score"] == 100
    assert result["coverage"] == 20


def test_gas_giant_gets_no_surface_or_underground_score():
    metrics = make_metrics({"radius": 11.0})
    for scenario_id in ("surface", "underground"):
        result = score_scenario(metrics, scenario_id)
        assert result["applicable"] is False
        assert result["score"] is None
    assert score_scenario(metrics, "orbital")["applicable"] is True


def test_transition_class_penalty_is_applied():
    # Yarıçap 2: ölçüt puanı 1 - 1/1.5 = 0.333 → 15 ağırlıkla 5 puan; %15 ihtiyat → 4.
    result = score_scenario(make_metrics({"radius": 2.0}), "surface")
    assert result["classification_penalty"] == pytest.approx(0.85)
    assert result["score"] == 4


def test_scenario_weights_are_returned_with_indicators():
    result = score_scenario({"provenance": {}}, "underground")
    assert sum(item["weight"] for item in result["indicators"]) == 100
