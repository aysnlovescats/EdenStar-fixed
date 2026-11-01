// Sayfa geçişleri, olay dinleyicileri ve başlangıç. En son yüklenmelidir.

// Adres çubuğundaki #sayfa değerine göre ilgili bölümü gösterir, menüde işaretler ve o sayfanın verisini yükler.
function setPage(page) {
  activePage = pageTitles[page] ? page : "overview";
  document.body.dataset.page = activePage;
  $("pageTitle").textContent = pageTitles[activePage];
  document.querySelectorAll(".workspace-page").forEach(section => { section.hidden = section.id !== `page-${activePage}`; });
  document.querySelectorAll(".workspace-nav [data-page]").forEach(link => {
    const active = link.dataset.page === activePage;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
  if (activePage === "overview") loadOverview();
  if (activePage === "catalog") loadCatalog();
  if (activePage === "phl-ranking") loadPhlCandidates();
  if (activePage === "rankings") loadRankings();
  if (activePage === "custom-planet") loadCustomPlanetScores();
  if (activePage === "comparison") loadComparison();
  if (activePage === "method") { loadEsiConsistency(); loadWeightCheck(); }
  if (activePage === "life-support") {
    if (!lifeDestinations.length) loadLifeSupportDestinations();
    else { updateLifeJourney(); updateLifeSupport(); }
  }
  if (activePage === "engineering") {
    if (!engineeringDestinations.length) loadEngineeringDestinations();
    else if (engineeringAnalysis) renderEngineeringPage();
  }
}

// Olay dinleyicileri: sayfa geçişi, filtreler, arama kutuları (250 ms gecikmeli), karşılaştırma,
// formlar ve hesaplayıcılar.
window.addEventListener("hashchange", () => setPage(window.location.hash.slice(1)));
$("overviewScenario").addEventListener("change", loadOverview);
$("catalogScenario").addEventListener("change", loadCatalog);
$("catalogCoverage").addEventListener("change", loadCatalog);
$("catalogSearch").addEventListener("input", () => { clearTimeout(catalogTimer); catalogTimer = setTimeout(loadCatalog, 250); });
$("phlCandidateSearch").addEventListener("input", () => { clearTimeout(phlCandidateTimer); phlCandidateTimer = setTimeout(loadPhlCandidates, 250); });
$("rankingScenario").addEventListener("change", loadRankings);
$("rankingCoverage").addEventListener("change", loadRankings);
$("rankingSearch").addEventListener("input", () => { clearTimeout(rankingTimer); rankingTimer = setTimeout(loadRankings, 250); });
document.querySelectorAll("[data-guide-scenario]").forEach(button => button.addEventListener("click", () => {
  $("rankingScenario").value = button.dataset.guideScenario;
  if (activePage === "rankings") loadRankings();
  window.location.hash = "rankings";
}));
$("rankingResults").addEventListener("change", event => {
  const input = event.target.closest("input[data-compare-key]");
  if (!input) return;
  const record = latestRankedRecords.find(item => recordKey(item) === input.dataset.compareKey);
  if (input.checked && selectedForComparison.size < 3 && record) selectedForComparison.set(recordKey(record), record);
  else selectedForComparison.delete(input.dataset.compareKey);
  updateCompareCount();
  if (activePage === "rankings") loadRankings();
  if (activePage === "comparison") loadComparison();
});
$("compareSelectedButton").addEventListener("click", () => { window.location.hash = "comparison"; });
$("comparisonScenario").addEventListener("change", loadComparison);
$("esiScenario").addEventListener("change", loadEsiConsistency);
$("esiCheckChart").addEventListener("mousemove", showEsiTooltip);
$("esiCheckChart").addEventListener("mouseleave", hideEsiTooltip);
$("esiCheckChart").addEventListener("click", openEsiPoint);
$("weightScenario").addEventListener("change", loadWeightCheck);
$("weightSpread").addEventListener("change", loadWeightCheck);
$("customPlanetForm").addEventListener("input", scheduleCustomPlanetScores);
$("customPlanetForm").addEventListener("change", scheduleCustomPlanetScores);
$("customPlanetForm").addEventListener("submit", event => { event.preventDefault(); loadCustomPlanetScores(); });
$("resetCustomPlanet").addEventListener("click", () => {
  $("customPlanetForm").reset();
  localStorage.removeItem("edenstar-custom-planet-v1");
  customRequest++;
  $("customPlanetResults").innerHTML = '<div class="custom-empty"><span>✧</span><h3>Henüz değer girilmedi</h3><p>Bir veya daha fazla alan doldur; senaryo puanları ve veri kapsamı burada görünsün.</p></div>';
});

$("lifeSupportForm").addEventListener("input", updateLifeSupport);
$("lifeSupportForm").addEventListener("change", updateLifeSupport);
$("lifeDestination").addEventListener("change", () => {
  lifeDestination = lifeDestinations[Number($("lifeDestination").value)] || null;
  suggestLifeDeltaV(true);
  updateLifeJourney();
  updateLifeSupport();
  loadLifeSupportDestinationAnalysis();
});
$("lifeScenario").addEventListener("change", loadLifeSupportDestinationAnalysis);
$("engineeringSearch").addEventListener("input", () => {
  clearTimeout(engineeringTimer);
  engineeringTimer = setTimeout(() => loadEngineeringDestinations($("engineeringSearch").value.trim()), 300);
});
$("engineeringDestination").addEventListener("change", loadEngineeringAnalysis);
$("engineeringScenario").addEventListener("change", renderEngineeringPage);
["engineeringShieldArea", "engineeringShieldDepth", "engineeringShieldDensity", "engineeringInternalPressure", "engineeringDomeRadius", "engineeringDomeThickness"].forEach(id => $(id).addEventListener("input", updateEngineeringCalculator));
["engineeringHeatArea", "engineeringInteriorTemp", "engineeringEmissivity"].forEach(id => $(id).addEventListener("input", updateEngineeringHeatEstimate));
$("lifeCruiseSpeed").addEventListener("input", () => { updateLifeJourney(); updateLifeSupport(); });
$("lifeIncludeReturn").addEventListener("change", () => { updateLifeJourney(); updateLifeSupport(); });
$("lifeMissionDeltaV").addEventListener("input", () => {
  $("lifeMissionDeltaV").dataset.userEdited = "true";
  updateRocketEstimate();
});
["lifeVehicleMass", "lifeEngineIsp", "lifeOxFuelRatio"].forEach(id => $(id).addEventListener("input", updateRocketEstimate));

// Başlangıç: kayıtlı formu geri yükle, sayaçları güncelle ve adresteki sayfayı aç.
restoreCustomPlanet();
updateCompareCount();
setPage(window.location.hash.slice(1) || "overview");
