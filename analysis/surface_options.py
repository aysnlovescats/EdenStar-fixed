"""Surface habitat approaches and their data requirements."""
from .scenarios import SURFACE_GUARDRAILS


# Yüzey yaklaşımlarını hazırlar: açık yüzey (sıcaklık + basınç + atmosfer ön elemesi), basınçlı kubbe (kubbe puanı),
# regolitle örtülü habitat (yerel veri gerektirir, puan yok) ve yalnızca Venüs için yüksek irtifa platformu (konsept, puan yok).
def build_surface_options(metrics, dome_scenario, is_venus=False):
    if dome_scenario.get("applicable") is False:
        return [{
            "id": "not_applicable",
            "name": "Yüzey yerleşimi",
            "status": "Bu gezegen sınıfına uygulanamaz",
            "summary": dome_scenario.get("applicability_note") or "Yüzey yerleşimi için uygun sınıf değil.",
            "score": None,
            "checks": [],
        }]
    temperature = metrics.get("temperature")
    observed_surface_temperature = metrics.get("temperature_kind") == "surface"
    pressure = metrics.get("surface_pressure_bar")
    atmosphere = metrics.get("atmosphere_status")
    temp_low, temp_high = SURFACE_GUARDRAILS["temperature_kelvin"]
    pressure_low, pressure_high = SURFACE_GUARDRAILS["surface_pressure_bar"]

    direct_checks = [
        {
            "name": "Yüzey sıcaklığı",
            "value": temperature if observed_surface_temperature else None,
            "unit": "K",
            "status": "unknown" if not observed_surface_temperature or temperature is None
            else "ok" if temp_low <= temperature <= temp_high else "risk",
            "summary": f"Proje ön eleme aralığı {temp_low:g}–{temp_high:g} K",
        },
        {
            "name": "Yüzey basıncı",
            "value": pressure,
            "unit": "bar",
            "status": "unknown" if pressure is None
            else "ok" if pressure_low <= pressure <= pressure_high else "risk",
            "summary": f"Proje ön eleme aralığı {pressure_low:g}–{pressure_high:g} bar",
        },
        {
            "name": "Atmosfer",
            "value": atmosphere,
            "unit": "",
            "status": "unknown" if atmosphere is None
            else "ok" if atmosphere == "breathable" else "risk",
            "summary": metrics.get("atmosphere_summary") or "Atmosfer bileşimi bilinmiyor",
        },
    ]
    # Bir koşul aralık dışındaysa açık yüzey uygun değil; biri bilinmiyorsa karar verilemez; hepsi uygunsa ön koşullar uygun.
    if any(check["status"] == "risk" for check in direct_checks):
        direct_status = "Açık yüzeyde yaşama uygun görünmüyor"
        direct_summary = "Ölçülen koşullardan en az biri insan için korumasız yaşam sınırlarının dışında."
    elif any(check["status"] == "unknown" for check in direct_checks):
        direct_status = "Belirlemek için veri yetersiz"
        direct_summary = "Yüzey sıcaklığı, basınç ve solunabilir atmosfer ölçümleri birlikte gerekli."
    else:
        direct_status = "Ön koşullar uygun görünüyor"
        direct_summary = "Bu yalnızca temel çevre ön elemesidir; radyasyon, su ve diğer yaşam gereksinimleri doğrulanmış değildir."

    options = [
        {
            "id": "open_surface",
            "name": "Açık yüzeyde doğrudan yaşam",
            "status": direct_status,
            "summary": direct_summary,
            "score": None,
            "checks": direct_checks,
        },
        {
            "id": "dome",
            "name": "Basınçlı kubbe / habitat modülü",
            "status": "Kademeli yerleşim puanı" if dome_scenario["score"] is not None else "Bu senaryo için ölçüm yok",
            "summary": "Dış ortam yaşanabilir olmak zorunda değildir; basınç, sıcaklık ve atmosfer yükleri puana kademeli yansır.",
            "score": dome_scenario["score"],
            "coverage": dome_scenario["coverage"],
            "scenario_id": "surface",
        },
        {
            "id": "shielded_surface",
            "name": "Regolit ile örtülü / korumalı habitat",
            "status": "Yerel saha verisi gerekli",
            "summary": "Yüzey malzemesiyle koruma bir aday yaklaşımdır; skor için yerel radyasyon, zemin ve malzeme verisi gerekir.",
            "score": None,
            "missing_data": ["Yerel radyasyon dozu", "Regolit özellikleri", "Zemin ve yapı kararlılığı"],
        },
    ]
    if is_venus:
        options.append({
            "id": "venus_aerostat",
            "name": "Venüs atmosferinde yüksek irtifa platformu",
            "status": "Araştırma konsepti · puan hesaplanmıyor",
            "summary": "NASA'nın HAVOC çalışması yaklaşık 50 km irtifadaki hava platformunu ele aldı. Bu yüzey yerleşimi değildir; irtifaya bağlı sıcaklık, basınç, rüzgâr ve asitli bulut verileri gerekir.",
            "score": None,
            "missing_data": ["İrtifaya göre atmosfer profili", "Rüzgâr ve bulut koşulları", "Asit dayanımlı yapı verileri"],
        })
    return options
