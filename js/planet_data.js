// IndexedDB önbellek ayarları. CACHE_KEY değişirse tarayıcı CSV'yi yeniden işler.
const CACHE_DB="EdenStarCache", CACHE_STORE="datasets", CACHE_KEY="nasa-ps-2026-v3";
// Haritada adı her zaman gösterilen öne çıkan sistemler.
const FEATURED=new Set(["proxima cen","trappist-1","toi-700","kepler-186","gj 357"]);
// NASA CSV'sinde uzaklığı boş olan popüler sistemler için manuel yama (Parsek cinsinden)
const KNOWN_DIST = {"trappist-1": 12.43, "kepler-186": 178.5, "kepler-452": 551.7};

// Güvenli sayı dönüşümü: boş veya sayı olmayan değer null olur.
const num=v=>v===null||v===undefined||String(v).trim()===""?null:(Number.isFinite(Number(v))?Number(v):null);

// Tarayıcının IndexedDB veritabanını açar (yoksa oluşturur).
function dbOpen(){return new Promise((ok,no)=>{const q=indexedDB.open(CACHE_DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(CACHE_STORE))q.result.createObjectStore(CACHE_STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
// Daha önce işlenmiş sistem listesini önbellekten okur.
async function cacheRead(){const db=await dbOpen();return new Promise((ok,no)=>{const q=db.transaction(CACHE_STORE).objectStore(CACHE_STORE).get(CACHE_KEY);q.onsuccess=()=>ok(q.result||null);q.onerror=()=>no(q.error)})}
// İşlenmiş sistem listesini önbelleğe yazar; sonraki açılışta CSV yeniden işlenmez.
async function cacheWrite(v){const db=await dbOpen();return new Promise((ok,no)=>{const q=db.transaction(CACHE_STORE,"readwrite").objectStore(CACHE_STORE).put(v,CACHE_KEY);q.onsuccess=()=>ok();q.onerror=()=>no(q.error)})}

// Harita ve sistem görünümü için NASA verisini hazırlar:
// 1) Önbellekte varsa onu döndür. 2) Yoksa PapaParse ile CSV'yi Web Worker'da (sayfayı dondurmadan) ayrıştır.
// 3) Tartışmalı gezegenleri atla, satırları yıldız sistemine göre grupla, eksik alanları diğer satırlardan doldur.
// 4) Konumu ve uzaklığı bilinen sistemleri kısa dizilere çevir (parsek × 3,26156 = ışık yılı) ve önbelleğe yaz.
window.loadPlanetSystems=async function(){
 try{const old=await cacheRead();if(old)return old}catch(e){console.warn("Önbellek okunamadı; CSV okunacak.",e)}
 const url=new URL("../data/PS_2026.10.14_04.38.21.csv",location.href).href;
 const result=await new Promise((ok,no)=>Papa.parse(url,{download:true,header:true,dynamicTyping:false,skipEmptyLines:true,comments:"#",worker:true,complete:ok,error:no}));
 if(!result.data.length)throw Error("NASA CSV boş veya okunamadı.");

 const groups=new Map();
 const orderedRows=[...result.data].sort((a,b)=>(Number(b.default_flag)===1?1:0)-(Number(a.default_flag)===1?1:0));

 for(const row of orderedRows){
  const host=String(row.hostname||"").trim();if(!host)continue;if(num(row.pl_controv_flag)===1)continue;
  if(!groups.has(host))groups.set(host,{host,ra:null,dec:null,dist:null,teff:null,starRadius:null,starMass:null,starLum:null,planets:new Map()});
  const s=groups.get(host);

  for(const [key,value] of [["ra",row.ra],["dec",row.dec],["dist",row.sy_dist],["teff",row.st_teff],["starRadius",row.st_rad],["starMass",row.st_mass],["starLum",row.st_lum]]){
      let val = num(value);
      if (key === "dist" && val == null && KNOWN_DIST[host.toLowerCase()]) val = KNOWN_DIST[host.toLowerCase()];
      if(s[key]==null && val!=null) s[key]=val;
  }

  const name=String(row.pl_name||"").trim();if(!name)continue;if(!s.planets.has(name))s.planets.set(name,{name,r:null,m:null,t:null,a:null,period:null,flux:null});
  const p=s.planets.get(name);
  for(const [key,value] of [["r",row.pl_rade],["m",row.pl_bmasse],["t",row.pl_eqt],["a",row.pl_orbsmax],["period",row.pl_orbper],["flux",row.pl_insol]])if(p[key]==null&&num(value)!=null)p[key]=num(value);
 }

 // Her sistem: [ad, RA, Dec, ışık yılı, yıldız sıcaklığı, yıldız yarıçapı, öne çıkan mı, gezegenler, yıldız kütlesi, parlaklık].
 // Her gezegen: [ad, yarıçap km, yerçekimi m/s², sıcaklık °C, yörünge AU, bayraklar, periyot, akı].
 const systems=[...groups.values()].filter(s=>s.ra!=null&&s.dec!=null&&s.dist!=null&&s.planets.size).map(s=>[
  s.host,s.ra,s.dec,s.dist*3.26156,s.teff,s.starRadius,FEATURED.has(s.host.toLowerCase())?1:0,
  [...s.planets.values()].map(p=>{const r=p.r>0?p.r:null,m=p.m>0?p.m:null,g=r&&m?9.81*m/(r*r):null,t=p.t>0?p.t-273.15:null,a=p.a>0?p.a:null;const flags=(r?1:0)|(t!=null?2:0)|(g?4:0);return[p.name,r? r*6371:null,g,t,a,flags,p.period,p.flux]}),s.starMass,s.starLum
 ]);

 if(!systems.length)throw Error("CSV'de konum ve uzaklık verisi olan sistem bulunamadı.");
 try{await cacheWrite(systems)}catch(e){console.warn("Önbelleğe yazılamadı.",e)}return systems;
};