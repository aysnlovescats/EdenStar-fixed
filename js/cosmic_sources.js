// Small, source-linked starter set for the optional map layer.
// Galactic distances are plotted in 3D (with the map's existing distance compression).
// Extragalactic/transient sources are direction-only markers on a reference shell.
window.COSMIC_SOURCES = [
  {
    id: "vela-snr", name: "Vela süpernova kalıntısı", category: "Süpernova kalıntısı",
    ra: 128.836, dec: -45.176, distanceLy: 800, distanceLabel: "≈800 ışık yılı",
    mapMode: "galactic", color: "#ff9b62",
    note: "Yaklaşık 11.000 yıl önceki süpernovanın kalıntısı; merkezinde Vela pulsarı bulunur.",
    references: [{ label: "NASA · Vela kalıntısı", url: "https://science.nasa.gov/image-article/apod-2008-march-6-vela-supernova-remnant/" }, { label: "SIMBAD · koordinatlar", url: "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Vela%20Pulsar" }]
  },
  {
    id: "geminga", name: "Geminga", category: "Pulsar · gama ışını", ra: 98.4756, dec: 17.7703,
    distanceLy: 800, distanceLabel: "≈800 ışık yılı", mapMode: "galactic", color: "#ffcf70",
    note: "Yakın ve parlak bir gama ışını pulsarı; ışınımı uzak gezegenler için doğrudan risk puanı anlamına gelmez.",
    references: [{ label: "NASA · Geminga", url: "https://www.nasa.gov/universe/nasas-fermi-mission-links-nearby-pulsars-gamma-ray-halo-to-antimatter-puzzle/" }, { label: "Fermi · koordinatlar", url: "https://fermi.gsfc.nasa.gov/ssc/data/analysis/scitools/pulsar_gating_tutorial.html" }]
  },
  {
    id: "crab", name: "Yengeç Bulutsusu (M1)", category: "Süpernova kalıntısı · pulsar", ra: 83.6331, dec: 22.0145,
    distanceLy: 6500, distanceLabel: "≈6.500 ışık yılı", mapMode: "galactic", color: "#ff7c78",
    note: "1054 yılında gözlenen süpernovanın kalıntısı; merkezindeki pulsar X-ışını ve gama ışını yayıyor.",
    references: [{ label: "NASA · Yengeç Bulutsusu ve koordinatlar", url: "https://science.nasa.gov/asset/hubble/crab-nebula-2/" }]
  },
  {
    id: "gaia-bh1", name: "Gaia BH1", category: "Kara delik · yıldız ikilisi", ra: 262.1712, dec: -0.5810,
    distanceLy: 1560, distanceLabel: "≈1.560 ışık yılı", mapMode: "galactic", color: "#c9a7ff",
    note: "Bilinen en yakın kara delik sistemlerinden biri. Şu an sakin/durgun; kara delik etiketi tek başına yoğun radyasyon demek değildir.",
    references: [{ label: "Max Planck · Gaia BH1", url: "https://www.mpia.de/news/science/2022-16-gaia-bh1" }, { label: "SIMBAD · koordinatlar", url: "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Gaia%20BH1" }]
  },
  {
    id: "cygnus-x1", name: "Cygnus X-1", category: "Kara delik · X-ışını kaynağı", ra: 299.5903, dec: 35.2016,
    distanceLy: 6000, distanceLabel: "≈6.000 ışık yılı", mapMode: "galactic", color: "#bda5ff",
    note: "Madde çeken aktif bir yıldız-kara delik ikilisi; güçlü X-ışını kaynağıdır.",
    references: [{ label: "NASA · Cygnus X-1", url: "https://www.nasa.gov/universe/nasas-ixpe-reveals-shape-orientation-of-hot-matter-around-black-hole/" }, { label: "SIMBAD · koordinatlar", url: "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Cygnus%20X-1" }]
  },
  {
    id: "3c273", name: "3C 273", category: "Kuasar · aktif galaksi çekirdeği", ra: 187.2779, dec: 2.0525,
    distanceLy: 2500000000, distanceLabel: "≈2,5 milyar ışık yılı", mapMode: "sky", color: "#79dded",
    note: "Uzak bir kuasar. Haritadaki işaret yalnızca gökyüzü yönünü gösterir; mesafesi galaktik yıldızlarla aynı 3B ölçekte çizilmez.",
    references: [{ label: "NASA · 3C 273", url: "https://science.nasa.gov/asset/hubble/quasar-3c-273-2/" }]
  },
  {
    id: "grb-221009a", name: "GRB 221009A", category: "Gama ışını patlaması · geçici olay", ra: 288.254, dec: 19.809,
    distanceLy: null, distanceLabel: "Ev sahibi galaksinin kırmızıya kayması z ≈ 0,151", redshift: 0.151,
    mapMode: "sky", color: "#ffd56d",
    note: "9 Ekim 2022'de gözlenen geçici patlama. İşaret olayın gökyüzü yönünü gösterir; patlama kalıcı bir gökcismi değildir.",
    references: [{ label: "NASA Swift · olay koordinatları ve kırmızıya kayma", url: "https://swift.gsfc.nasa.gov/archive/grb_table.html/fullview/221009A/" }]
  }
];
