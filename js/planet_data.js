const CACHE_DB="ExoHabitatCache", CACHE_STORE="datasets", CACHE_KEY="nasa-ps-2026-v4";
const FEATURED=new Set(["proxima cen","trappist-1","toi-700","kepler-186","gj 357"]);
const num=v=>v===null||v===undefined||String(v).trim()===""?null:(Number.isFinite(Number(v))?Number(v):null);
function dbOpen(){return new Promise((ok,no)=>{const q=indexedDB.open(CACHE_DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(CACHE_STORE))q.result.createObjectStore(CACHE_STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function cacheRead(){const db=await dbOpen();return new Promise((ok,no)=>{const q=db.transaction(CACHE_STORE).objectStore(CACHE_STORE).get(CACHE_KEY);q.onsuccess=()=>ok(q.result||null);q.onerror=()=>no(q.error)})}
async function cacheWrite(v){const db=await dbOpen();return new Promise((ok,no)=>{const q=db.transaction(CACHE_STORE,"readwrite").objectStore(CACHE_STORE).put(v,CACHE_KEY);q.onsuccess=()=>ok();q.onerror=()=>no(q.error)})}
window.loadPlanetSystems=async function(){
 try{const old=await cacheRead();if(old)return old}catch(e){console.warn("Önbellek okunamadı; CSV okunacak.",e)}
 const url=new URL("../data/PS_2026.10.14_04.38.21.csv",location.href).href;
 const result=await new Promise((ok,no)=>Papa.parse(url,{download:true,header:true,dynamicTyping:false,skipEmptyLines:true,comments:"#",worker:true,complete:ok,error:no}));
 if(!result.data.length)throw Error("NASA CSV boş veya okunamadı.");
 const groups=new Map();
 const orderedRows=[...result.data].sort((a,b)=>(Number(b.default_flag)===1?1:0)-(Number(a.default_flag)===1?1:0));
 for(const row of orderedRows){const host=String(row.hostname||"").trim();if(!host)continue;
  if(!groups.has(host))groups.set(host,{host,ra:null,dec:null,dist:null,teff:null,starRadius:null,starMass:null,starLum:null,planets:new Map()});const s=groups.get(host);
  for(const [key,value] of [["ra",row.ra],["dec",row.dec],["dist",row.sy_dist],["teff",row.st_teff],["starRadius",row.st_rad],["starMass",row.st_mass],["starLum",row.st_lum]])if(s[key]==null&&num(value)!=null)s[key]=num(value);
  const name=String(row.pl_name||"").trim();if(!name)continue;if(!s.planets.has(name))s.planets.set(name,{name,r:null,m:null,t:null,a:null,period:null,flux:null,contested:num(row.pl_controv_flag)===1});const p=s.planets.get(name);
  p.contested=p.contested||num(row.pl_controv_flag)===1;
  for(const [key,value] of [["r",row.pl_rade],["m",row.pl_bmasse],["t",row.pl_eqt],["a",row.pl_orbsmax],["period",row.pl_orbper],["flux",row.pl_insol]])if(p[key]==null&&num(value)!=null)p[key]=num(value);
 }
 const MANUAL_DISTANCE_PC={"trappist-1":12.43};
 for(const s of groups.values())if(s.dist==null&&MANUAL_DISTANCE_PC[s.host.toLowerCase()])s.dist=MANUAL_DISTANCE_PC[s.host.toLowerCase()];
 const systems=[...groups.values()].filter(s=>s.ra!=null&&s.dec!=null&&s.dist!=null&&s.planets.size).map(s=>[
  s.host,s.ra,s.dec,s.dist*3.26156,s.teff,s.starRadius,FEATURED.has(s.host.toLowerCase())?1:0,
  [...s.planets.values()].map(p=>{const r=p.r>0?p.r:null,m=p.m>0?p.m:null,g=r&&m?9.81*m/(r*r):null,t=p.t>0?p.t-273.15:null,a=p.a>0?p.a:null;const flags=(r?1:0)|(t!=null?2:0)|(g?4:0);return[p.name,r? r*6371:null,g,t,a,flags,p.period,p.flux,p.contested?1:0]}),s.starMass,s.starLum
 ]);
 if(!systems.length)throw Error("CSV'de konum ve uzaklık verisi olan sistem bulunamadı.");try{await cacheWrite(systems)}catch(e){console.warn("Önbelleğe yazılamadı; veri kullanılmaya devam edecek.",e)}return systems;
};
